import { supabase } from './supabase';

/**
 * Generate embedding for query using OpenAI API
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query
      })
    });
    
    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Semantic search using pgvector
 * Returns calls ordered by similarity to query
 */
export async function semanticSearchCalls(query: string, limit: number = 10): Promise<string[]> {
  // Get embedding for query
  const embedding = await getQueryEmbedding(query);
  if (!embedding) {
    console.warn('Could not generate embedding, falling back to text search');
    return [];
  }

  // Call Supabase RPC for vector search
  const { data, error } = await supabase.rpc('match_call_chunks', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: limit * 3
  });

  if (error) {
    console.error('Semantic search error:', error);
    return [];
  }

  // Deduplicate by call_id and return sorted list
  const seen = new Set<string>();
  const results: string[] = [];
  
  for (const row of data || []) {
    if (!seen.has(row.call_id)) {
      seen.add(row.call_id);
      results.push(row.call_id);
    }
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Old text-based search (fallback)
 */
export function normalizeForSearch(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesQuery(fields: Array<string | null | undefined>, query: string): boolean {
  const q = normalizeForSearch(query).trim();
  if (!q) return true;

  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = normalizeForSearch(fields.filter(Boolean).join(' '));

  return terms.every(t => haystack.includes(t));
}
