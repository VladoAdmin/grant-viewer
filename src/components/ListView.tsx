import { useState, useMemo, useEffect } from 'react';
import { GrantCall } from '../lib/supabase';
import { matchesQuery, semanticSearchCalls, classifyQuery, sanitizeQuery, type QueryIntent } from '../lib/search';

interface Props {
  calls: GrantCall[];
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResultsChange?: (grantIds: string[]) => void;
}

export function ListView({ calls, onSelect, searchQuery, onSearchChange, onResultsChange }: Props) {
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [queryIntent, setQueryIntent] = useState<QueryIntent | null>(null);

  const sources = useMemo(() => [...new Set(calls.map(c => c.source))].sort(), [calls]);
  const statuses = useMemo(() => [...new Set(calls.map(c => c.status || 'N/A'))].sort(), [calls]);

  // Semantic search when query changes
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSemanticResults(null);
      setQueryIntent(null);
      return;
    }

    // Classify query intent
    const intent = classifyQuery(searchQuery);
    setQueryIntent(intent);

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await semanticSearchCalls(searchQuery, 20);
        // If semantic returned nothing, set null to fallback to text search
        setSemanticResults(results.length > 0 ? results : null);
      } catch (e) {
        console.error('Semantic search failed:', e);
        setSemanticResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filtered = useMemo(() => {
    // Check if semantic results actually intersect with loaded calls
    const loadedIds = new Set(calls.map(c => c.id));
    const hasUsableSemanticResults = semanticResults !== null
      && semanticResults.length > 0
      && semanticResults.some(id => loadedIds.has(id));

    return calls.filter(c => {
      // Use semantic results only if they match loaded calls
      if (hasUsableSemanticResults) {
        if (!semanticResults!.includes(c.id)) return false;
      } else if (searchQuery) {
        // Fallback to text search (includes when semantic returned no matching IDs)
        if (!matchesQuery([c.title, c.source, c.provider, c.eligible_applicants], searchQuery)) return false;
      }

      if (sourceFilter && c.source !== sourceFilter) return false;
      if (statusFilter && (c.status || 'N/A') !== statusFilter) return false;
      return true;
    });
  }, [calls, searchQuery, sourceFilter, statusFilter, semanticResults]);

  // Notify parent about currently displayed grants (for chatbot category analysis)
  useEffect(() => {
    if (!onResultsChange) return;
    onResultsChange(filtered.map(g => g.id));
  }, [filtered, onResultsChange]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('sk-SK');
  };

  const formatAmount = (n: number | null) => {
    if (!n) return '—';
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  };

  return (
    <div className="list-view">
      <div className="filters">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="🔍 Hľadať (sémantické vyhľadávanie - voda, inovácie, energia...)"
            maxLength={200}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => { onSearchChange(''); setSemanticResults(null); setQueryIntent(null); }}
              aria-label="Vymazať vyhľadávanie"
            >
              ✕
            </button>
          )}
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Všetky zdroje</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Aktívne (Otvorené/Vyhlásené)</option>
          <option value="Otvorená">Otvorená</option>
          <option value="Vyhlásená">Vyhlásená</option>
          <option value="Plánovaná">Plánovaná</option>
          <option value="Uzavretá">Uzavretá</option>
          <option value="Zrušená">Zrušená</option>
          <option value="">Všetky stavy</option>
        </select>
        <span className="result-count">
          {isSearching ? '🔍 Hľadám...' : `${filtered.length} z ${calls.length}`}
          {(() => {
            const loadedIds = new Set(calls.map(c => c.id));
            const usable = semanticResults !== null && semanticResults.length > 0 && semanticResults.some(id => loadedIds.has(id));
            if (usable) return ' (sémantické)';
            if (searchQuery.length >= 3) return ' (textové)';
            return '';
          })()}
        </span>
      </div>

      {queryIntent && (queryIntent.applicantTerms.length > 0 || queryIntent.locationTerms.length > 0 || queryIntent.sectorTerms.length > 0 || queryIntent.projectFocusTerms.length > 0) && (
        <div className="intent-badges">
          {queryIntent.applicantTerms.map(t => (
            <span key={`a-${t}`} className="intent-badge applicant">👤 {t}</span>
          ))}
          {queryIntent.locationTerms.map(t => (
            <span key={`l-${t}`} className="intent-badge location">📍 {t}</span>
          ))}
          {queryIntent.sectorTerms.map(t => (
            <span key={`s-${t}`} className="intent-badge sector">🏭 {t}</span>
          ))}
          {queryIntent.projectFocusTerms.map(t => (
            <span key={`p-${t}`} className="intent-badge focus">🎯 {t}</span>
          ))}
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Názov výzvy</th>
              <th>Zdroj</th>
              <th>Poskytovateľ</th>
              <th>Vyhlásená</th>
              <th>Uzávierka</th>
              <th>Alokácia</th>
              <th>Stav</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(call => (
              <tr key={call.id} onClick={() => onSelect(call.id)} className="clickable">
                <td className="title-cell">{call.title}</td>
                <td className="source-cell">{call.source}</td>
                <td>{call.provider || '—'}</td>
                <td className="date-cell">{formatDate(call.announced_at)}</td>
                <td className="date-cell">{formatDate(call.deadline_at)}</td>
                <td className="amount-cell">{formatAmount(call.total_allocation)}</td>
                <td>
                  <span className={`status-badge ${(call.status || '').toLowerCase().includes('vyhlásen') ? 'open' : ''}`}>
                    {call.status || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
