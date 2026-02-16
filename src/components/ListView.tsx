import { useState, useMemo } from 'react';
import { GrantCall } from '../lib/supabase';

interface Props {
  calls: GrantCall[];
  onSelect: (id: string) => void;
}

export function ListView({ calls, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const sources = useMemo(() => [...new Set(calls.map(c => c.source))].sort(), [calls]);
  const statuses = useMemo(() => [...new Set(calls.map(c => c.status || 'N/A'))].sort(), [calls]);

  const filtered = useMemo(() => {
    return calls.filter(c => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
          !(c.provider || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (statusFilter && (c.status || 'N/A') !== statusFilter) return false;
      return true;
    });
  }, [calls, search, sourceFilter, statusFilter]);

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
          placeholder="🔍 Hľadať podľa názvu alebo poskytovateľa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Všetky zdroje</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Všetky stavy</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="result-count">{filtered.length} z {calls.length}</span>
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
