import { useState, useCallback } from 'react';
import { searchChunks, SearchResult, CompletenessInfo } from '../lib/searchApi';

export function DeepSearch() {
  const [query, setQuery] = useState('');
  const [deep, setDeep] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setCompleteness(null);
    setTookMs(null);
    setExpandedIds(new Set());

    try {
      const data = await searchChunks(trimmed, { deep, limit: 10 });
      setResults(data.results);
      setCompleteness(data.completeness ?? null);
      setTookMs(data.took_ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba');
    } finally {
      setLoading(false);
    }
  }, [query, deep]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSuggestedQuery = (q: string) => {
    setQuery(q);
  };

  return (
    <div className="deep-search">
      {/* Search controls */}
      <div className="ds-controls">
        <div className="ds-input-row">
          <input
            className="ds-input"
            type="text"
            placeholder="Hľadajte v dokumentoch výziev..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="ds-search-btn"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? '⏳ Hľadám...' : '🔍 Hľadať'}
          </button>
        </div>

        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={deep}
            onChange={e => setDeep(e.target.checked)}
          />
          <span className="ds-toggle-label">
            Detailné vyhľadávanie
            <span className="ds-toggle-hint">(reranker + analýza kompletnosti)</span>
          </span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="ds-error">
          ❌ {error}
        </div>
      )}

      {/* Results meta */}
      {tookMs !== null && !loading && (
        <div className="ds-meta">
          {results.length} výsledkov za {(tookMs / 1000).toFixed(1)}s
          {deep && ' (detailné vyhľadávanie)'}
        </div>
      )}

      {/* Completeness info (deep search only) */}
      {completeness && (
        <div className={`ds-completeness ${completeness.complete ? 'complete' : 'partial'}`}>
          <div className="ds-completeness-header">
            <span className="ds-completeness-icon">
              {completeness.complete ? '✅' : '⚠️'}
            </span>
            <span>
              {completeness.complete
                ? 'Kompletná odpoveď'
                : 'Čiastočná odpoveď'}
              <span className="ds-confidence">
                (istota: {Math.round(completeness.confidence * 100)}%)
              </span>
            </span>
          </div>

          {completeness.missing.length > 0 && (
            <div className="ds-missing">
              <strong>Chýbajúce informácie:</strong>
              <ul>
                {completeness.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {completeness.suggested_queries.length > 0 && (
            <div className="ds-suggested">
              <strong>Skúste tiež:</strong>
              <div className="ds-suggested-list">
                {completeness.suggested_queries.map((sq, i) => (
                  <button
                    key={i}
                    className="ds-suggested-btn"
                    onClick={() => handleSuggestedQuery(sq)}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="ds-results">
          {results.map(r => {
            const isExpanded = expandedIds.has(r.id);
            const contentPreview = r.chunk_content.length > 300 && !isExpanded
              ? r.chunk_content.slice(0, 300) + '...'
              : r.chunk_content;

            return (
              <div key={r.id} className="ds-result-card">
                <div className="ds-result-header">
                  <span className="ds-call-title">{r.call_title}</span>
                  <span className="ds-doc-type">{r.doc_type}</span>
                </div>

                <div className="ds-scores">
                  <span className="ds-score">
                    Podobnosť: {(r.similarity * 100).toFixed(1)}%
                  </span>
                  {r.rerank_score !== undefined && (
                    <span className="ds-score rerank">
                      Rerank: {r.rerank_score}/10
                    </span>
                  )}
                  <span className="ds-rank">
                    #{r.rank}
                  </span>
                </div>

                {r.rerank_reason && (
                  <div className="ds-rerank-reason">
                    💡 {r.rerank_reason}
                  </div>
                )}

                <div className="ds-content">
                  <pre>{contentPreview}</pre>
                  {r.chunk_content.length > 300 && (
                    <button
                      className="ds-expand-btn"
                      onClick={() => toggleExpand(r.id)}
                    >
                      {isExpanded ? '▲ Skryť' : '▼ Zobraziť celý text'}
                    </button>
                  )}
                </div>

                {r.source && (
                  <a
                    className="ds-source-link"
                    href={r.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📄 Zdroj
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && tookMs !== null && results.length === 0 && !error && (
        <div className="ds-empty">
          Žiadne výsledky pre "{query}". Skúste iný dotaz.
        </div>
      )}

      {/* Initial state */}
      {tookMs === null && !loading && !error && (
        <div className="ds-initial">
          <div className="ds-initial-icon">🔍</div>
          <p>Vyhľadávajte v dokumentoch grantových výziev</p>
          <p className="ds-initial-hint">
            Zadajte kľúčové slová alebo otázku, napr. "voda", "fotovoltaika pre obce", "oprávnené výdavky na zatepľovanie"
          </p>
        </div>
      )}
    </div>
  );
}
