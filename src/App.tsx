import { useState, useEffect } from 'react';
import { fetchCallsWithChunks, fetchAllCallsWithChunks, GrantCall } from './lib/supabase';
import { ListView } from './components/ListView';
import { GanttView } from './components/GanttView';
import { DetailModal } from './components/DetailModal';
import { DeepSearch } from './components/DeepSearch';
import './App.css';

function App() {
  const [calls, setCalls] = useState<GrantCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'gantt' | 'search'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCalls = showAll ? fetchAllCallsWithChunks() : fetchCallsWithChunks();
    loadCalls
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showAll]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img
            className="brand-logo"
            src={import.meta.env.BASE_URL + 'stormlevel-logo.png'}
            alt="StormLevel"
          />
          <h1>Prehľad grantových výziev</h1>
        </div>
        <nav className="tabs">
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            📋 Zoznam
          </button>
          <button
            className={view === 'gantt' ? 'active' : ''}
            onClick={() => setView('gantt')}
          >
            📊 Časová os
          </button>
          <button
            className={view === 'search' ? 'active' : ''}
            onClick={() => setView('search')}
          >
            🔍 Kontextové vyhľadávanie
          </button>
        </nav>
        {view !== 'search' && (
          <>
            <label className="show-all-toggle">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => {
                  setShowAll(e.target.checked);
                  setLoading(true);
                }}
              />
              Zobraziť aj uzavreté
            </label>
            <span className="count">{calls.length} výziev</span>
          </>
        )}
      </header>

      {view === 'search' ? (
        <DeepSearch />
      ) : loading ? (
        <div className="loading">Načítavam dáta...</div>
      ) : view === 'list' ? (
        <ListView
          calls={calls}
          onSelect={setSelectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : (
        <GanttView calls={calls} onSelect={setSelectedId} />
      )}

      {selectedId && (
        <DetailModal callId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

export default App;
