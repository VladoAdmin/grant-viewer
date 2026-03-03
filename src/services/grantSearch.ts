import { supabase } from '../lib/supabase';

// --- Types ---

export interface ExtractedContext {
  sektor?: string;
  typ_projektu?: string;
  region?: string;
  klucove_slova?: string[];
  rozpocet?: number;
  popis?: string;
}

export interface GrantResult {
  call_id: string;
  title: string;
  deadline_at: string | null;
  total_allocation: string | number | null;
  provider: string | null;
  call_url: string | null;
  similarity: number;
}

// --- Helpers ---

/**
 * Build a natural-language search query from extracted context.
 * E.g. {sektor: 'IT', typ_projektu: 'digitalizácia', region: 'Bratislava'}
 *   → "digitalizácia IT podnikov Bratislava"
 */
export function buildSearchQuery(context: ExtractedContext): string {
  const parts: string[] = [];

  if (context.typ_projektu) parts.push(context.typ_projektu);
  if (context.sektor) parts.push(context.sektor);
  if (context.region) parts.push(context.region);
  if (context.klucove_slova?.length) parts.push(...context.klucove_slova);
  if (context.popis) parts.push(context.popis);

  return parts.join(' ').trim();
}

/**
 * Generate embedding via OpenAI text-embedding-3-small.
 */
async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing VITE_OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embedding error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.data[0].embedding as number[];
}

// --- Main function ---

/**
 * Search grants relevant to the given context.
 * 1. Build query from context
 * 2. Generate embedding
 * 3. Call Supabase RPC match_call_chunks
 * 4. Post-filter: remove expired, deduplicate by call_id, sort by similarity
 * 5. Return top results with grant metadata
 */
export async function searchGrants(
  context: ExtractedContext,
  maxResults = 10,
): Promise<GrantResult[]> {
  const query = buildSearchQuery(context);
  if (!query) return [];

  let useVectorSearch = true;
  let chunks: Array<{ call_id: string; similarity: number }> = [];

  // 1. Try embedding + vector search
  try {
    const embedding = await getEmbedding(query);

    const { data, error } = await supabase.rpc('match_call_chunks', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 20,
    });

    if (error) {
      console.warn('[grantSearch] RPC match_call_chunks unavailable, falling back to text search:', error.message);
      useVectorSearch = false;
    } else {
      chunks = data || [];
    }
  } catch (e) {
    console.warn('[grantSearch] Vector search failed, falling back to text search:', e);
    useVectorSearch = false;
  }

  // 2a. Vector path: deduplicate and fetch metadata
  if (useVectorSearch && chunks.length > 0) {
    const bestByCall = new Map<string, { call_id: string; similarity: number }>();
    for (const chunk of chunks) {
      const existing = bestByCall.get(chunk.call_id);
      if (!existing || chunk.similarity > existing.similarity) {
        bestByCall.set(chunk.call_id, {
          call_id: chunk.call_id,
          similarity: chunk.similarity,
        });
      }
    }

    const callIds = [...bestByCall.keys()];
    const { data: grants, error: grantError } = await supabase
      .from('grant_calls_v2')
      .select('id, title, deadline_at, total_allocation, provider, call_url')
      .in('id', callIds);

    if (grantError) {
      console.error('[grantSearch] grant fetch error:', grantError);
      throw grantError;
    }

    const today = new Date().toISOString().slice(0, 10);
    const results: GrantResult[] = [];

    for (const grant of grants || []) {
      if (grant.deadline_at && grant.deadline_at < today) continue;
      const match = bestByCall.get(grant.id);
      if (!match) continue;

      results.push({
        call_id: grant.id,
        title: grant.title,
        deadline_at: grant.deadline_at,
        total_allocation: grant.total_allocation,
        provider: grant.provider,
        call_url: grant.call_url,
        similarity: match.similarity,
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, maxResults);
  }

  // 2b. Fallback: text-based ilike search on title
  if (!useVectorSearch || chunks.length === 0) {
    const terms = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length >= 2);

    if (terms.length === 0) return [];

    const patterns = terms.map(t => `title.ilike.%${t}%`).join(',');

    const { data: grants, error: grantError } = await supabase
      .from('grant_calls_v2')
      .select('id, title, deadline_at, total_allocation, provider, call_url')
      .or(patterns)
      .in('status', ['Otvorená', 'Vyhlásená', 'Plánovaná', 'otvorená', 'vyhlásená', 'plánovaná'])
      .order('announced_at', { ascending: false, nullsFirst: false })
      .limit(maxResults * 3);

    if (grantError) {
      console.error('[grantSearch] text fallback error:', grantError);
      return [];
    }

    const today = new Date().toISOString().slice(0, 10);
    const results: GrantResult[] = [];

    for (const grant of grants || []) {
      if (grant.deadline_at && grant.deadline_at < today) continue;

      // Score by counting matching terms in title
      const titleNorm = grant.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const matchCount = terms.filter(t => titleNorm.includes(t)).length;

      results.push({
        call_id: grant.id,
        title: grant.title,
        deadline_at: grant.deadline_at,
        total_allocation: grant.total_allocation,
        provider: grant.provider,
        call_url: grant.call_url,
        similarity: matchCount / terms.length, // normalized 0-1
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.filter(r => r.similarity > 0).slice(0, maxResults);
  }

  return [];
}
