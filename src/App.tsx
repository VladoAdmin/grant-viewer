import { useState, useEffect } from 'react';
import { fetchCalls, GrantCall } from './lib/supabase';
import { ListView } from './components/ListView';
import { GanttView } from './components/GanttView';
import { DetailModal } from './components/DetailModal';
import './App.css';

function App() {
  const [calls, setCalls] = useState<GrantCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'gantt'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalls()
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img
            className="brand-logo"
            src="/stormlevel-logo.png"
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
        </nav>
        <span className="count">{calls.length} výziev</span>
      </header>

      {loading ? (
        <div className="loading">Načítavam dáta...</div>
      ) : view === 'list' ? (
        <ListView calls={calls} onSelect={setSelectedId} />
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
