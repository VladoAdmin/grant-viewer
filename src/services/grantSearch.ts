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

  // 1. Embedding
  const embedding = await getEmbedding(query);

  // 2. Vector search via RPC
  const { data: chunks, error } = await supabase.rpc('match_call_chunks', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 20,
  });

  if (error) {
    console.error('[grantSearch] RPC error:', error);
    throw error;
  }

  if (!chunks?.length) return [];

  // 3. Deduplicate by call_id, keep best similarity
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

  // 4. Fetch grant metadata for matched call_ids
  const callIds = [...bestByCall.keys()];
  const { data: grants, error: grantError } = await supabase
    .from('grant_calls_v2')
    .select('id, title, deadline_at, total_allocation, provider, call_url')
    .in('id', callIds);

  if (grantError) {
    console.error('[grantSearch] grant fetch error:', grantError);
    throw grantError;
  }

  // 5. Post-filter: exclude expired grants
  const today = new Date().toISOString().slice(0, 10);
  const results: GrantResult[] = [];

  for (const grant of grants || []) {
    // Skip grants past deadline
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

  // 6. Sort by similarity desc, return top N
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, maxResults);
}
