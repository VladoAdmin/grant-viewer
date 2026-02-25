import { useState, useMemo, useEffect } from 'react';
import { GrantCall } from '../lib/supabase';
import { matchesQuery, semanticSearchCalls } from '../lib/search';

interface Props {
  calls: GrantCall[];
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ListView({ calls, onSelect, searchQuery, onSearchChange }: Props) {
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const sources = useMemo(() => [...new Set(calls.map(c => c.source))].sort(), [calls]);
  const statuses = useMemo(() => [...new Set(calls.map(c => c.status || 'N/A'))].sort(), [calls]);

  // Semantic search when query changes
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSemanticResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await semanticSearchCalls(searchQuery, 20);
        setSemanticResults(results);
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
    return calls.filter(c => {
      // If we have semantic results, use them
      if (semanticResults !== null) {
        if (!semanticResults.includes(c.id)) return false;
      } else if (searchQuery) {
        // Fallback to text search
        if (!matchesQuery([c.title, c.source, c.provider], searchQuery)) return false;
      }
      
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (statusFilter && (c.status || 'N/A') !== statusFilter) return false;
      return true;
    });
  }, [calls, searchQuery, sourceFilter, statusFilter, semanticResults]);

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
        <input
          type="text"
          placeholder="🔍 Hľadať (sémantické vyhľadávanie - voda, inovácie, energia...)"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="search-input"
        />
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
          {semanticResults !== null && ' (sémantické)'}
        </span>
      </div>

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
