import { useState, useEffect } from 'react';
import {
  fetchCallById, fetchAttributes, fetchAttachments,
  GrantCall, GrantAttribute, GrantAttachment
} from '../lib/supabase';
import { generateCallMonitoringPdf } from '../lib/reportPdf';

interface Props {
  callId: string | number;
  onClose: () => void;
}

export function DetailModal({ callId, onClose }: Props) {
  const [call, setCall] = useState<GrantCall | null>(null);
  const [attrs, setAttrs] = useState<GrantAttribute[]>([]);
  const [attachments, setAttachments] = useState<GrantAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch call directly by ID; attributes and attachments are non-fatal
    Promise.all([
      fetchCallById(callId),
      fetchAttributes(callId).catch(() => [] as GrantAttribute[]),
      fetchAttachments(callId).catch(() => [] as GrantAttachment[]),
    ])
      .then(([c, a, att]) => {
        setCall(c);
        setAttrs(a);
        setAttachments(att);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [callId]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('sk-SK') : '—';
  const formatAmount = (n: string | number | null) => {
    if (!n) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return String(n);
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
  };

  // Key attributes to show prominently
  const keyAttrs = ['Program', 'Kód', 'Miesto realizácie', 'Oprávnení žiadatelia',
    'Celková alokácia', 'Podpora pre projekt', 'Typ výzvy', 'Druh výzvy',
    'Poskytovateľ', 'Vyhlasovateľ výzvy'];

  const importantAttrs = attrs.filter(a => keyAttrs.some(k => a.key.includes(k)));
  const _otherAttrs = attrs.filter(a => !keyAttrs.some(k => a.key.includes(k)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading ? (
          <div className="loading">Načítavam...</div>
        ) : !call ? (
          <div>Výzva nenájdená</div>
        ) : (
          <>
            <h2>{call.title}</h2>

            <div style={{ display: 'flex', gap: 8, margin: '10px 0 18px' }}>
              <button
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #3b82f6", background: "#2563eb", color: "white", cursor: "pointer" }}
                onClick={async () => {
                  try {
                    await generateCallMonitoringPdf(call, attrs);
                  } catch (e) {
                    console.error('PDF generation failed', e);
                    alert('Nepodarilo sa vygenerovať PDF.');
                  }
                }}
              >
                ⬇️ Stiahnuť sumár (PDF)
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-field">
                <label>Zdroj</label>
                <span>{call.source}</span>
              </div>
              <div className="detail-field">
                <label>Poskytovateľ</label>
                <span>{call.provider || '—'}</span>
              </div>
              <div className="detail-field">
                <label>Dátum vyhlásenia</label>
                <span>{formatDate(call.announced_at)}</span>
              </div>
              <div className="detail-field">
                <label>Uzávierka</label>
                <span>{formatDate(call.deadline_at)}</span>
              </div>
              <div className="detail-field">
                <label>Alokácia</label>
                <span>{formatAmount(call.total_allocation)}</span>
              </div>
              <div className="detail-field">
                <label>Typ výzvy</label>
                <span>{call.call_type || '—'}</span>
              </div>
              <div className="detail-field">
                <label>Stav</label>
                <span className={`status-badge ${(call.status || '').toLowerCase().includes('otvoren') ? 'open' : ''}`}>
                  {call.status || '—'}
                </span>
              </div>
              <div className="detail-field">
                <label>URL výzvy</label>
                <a href={call.call_url} target="_blank" rel="noopener noreferrer">
                  Otvoriť originál ↗
                </a>
              </div>
            </div>

            {importantAttrs.length > 0 && (
              <div className="detail-section">
                <h3>Doplňujúce údaje</h3>
                <div className="attrs-list">
                  {importantAttrs.map(a => (
                    <div key={a.id} className="attr-row">
                      <span className="attr-key">{a.key}</span>
                      <span className="attr-value">{a.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="detail-section">
                <h3>📎 Prílohy ({attachments.length})</h3>
                <ul className="attachments-list">
                  {attachments.map(att => (
                    <li key={att.id}>
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                          {att.name || 'Stiahnuť'}
                          {att.file_type && <span className="file-type">{att.file_type}</span>}
                        </a>
                      ) : (
                        <span>{att.name} <em>(URL nedostupná)</em></span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
