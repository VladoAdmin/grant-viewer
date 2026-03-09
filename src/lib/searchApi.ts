const API_BASE = '/grant-viewer/api';

export interface SearchResult {
  id: number;
  call_id: number;
  call_title: string;
  chunk_content: string;
  source: string;
  doc_type: string;
  similarity: number;
  rank: number;
  rerank_score?: number;
  rerank_reason?: string;
}

export interface CompletenessInfo {
  complete: boolean;
  confidence: number;
  chunks_used: number;
  iterations: number;
  missing: string[];
  suggested_queries: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
  deep: boolean;
  took_ms: number;
  completeness?: CompletenessInfo;
}

export async function searchChunks(
  query: string,
  options?: { deep?: boolean; limit?: number; call_id?: number }
): Promise<SearchResponse> {
  const body: Record<string, unknown> = { query };
  if (options?.deep !== undefined) body.deep = options.deep;
  if (options?.limit !== undefined) body.limit = options.limit;
  if (options?.call_id !== undefined) body.call_id = options.call_id;

  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search API error ${response.status}: ${text}`);
  }

  return response.json();
}
