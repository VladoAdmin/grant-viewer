import { useState, useEffect } from 'react';
import { fetchCalls, fetchAllCalls, GrantCall } from './lib/supabase';
import { ListView } from './components/ListView';
import { GanttView } from './components/GanttView';
import { DetailModal } from './components/DetailModal';
import { ChatWidget } from './components/chat/ChatWidget';
import './App.css';

function App() {
  const [calls, setCalls] = useState<GrantCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'gantt'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCalls = showAll ? fetchAllCalls() : fetchCalls();
    loadCalls
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showAll]);

  // Callback pre keywords z chatbotu
  const handleChatKeywords = (keywords: string[]) => {
    const query = keywords.join(' ');
    setSearchQuery(query);
    // Prepni na list view ak sme na gantt
    if (view !== 'list') {
      setView('list');
    }
  };

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
        </nav>
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
      </header>

      {loading ? (
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

      <ChatWidget 
        onGrantDetail={(id) => setSelectedId(id)} 
        onKeywords={handleChatKeywords}
      />
    </div>
  );
}

export default App;
