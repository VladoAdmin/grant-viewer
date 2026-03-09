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

/* ── helpers to look up attribute values by key ── */
function attrVal(attrs: GrantAttribute[], ...keys: string[]): string | null {
  for (const k of keys) {
    const found = attrs.find(a =>
      a.key === k || a.key.toLowerCase() === k.toLowerCase()
    );
    if (found?.value) return found.value;
  }
  return null;
}

function attrValIncludes(attrs: GrantAttribute[], substr: string): string | null {
  const found = attrs.find(a => a.key.toLowerCase().includes(substr.toLowerCase()));
  return found?.value || null;
}

/* keys that are rendered in the structured sections below (skip in "other") */
const STRUCTURED_KEYS = new Set([
  'program', 'kód výzvy', 'kod_vyzvy', 'druh výzvy', 'typ výzvy',
  'alokácia eú', 'alokácia šr', 'alokácia spolu', 'alokacia_eu',
  'celkova_alokacia', 'miesto realizácie', 'špecifický cieľ',
  'specificke_ciele', 'vyhlasovateľ výzvy', 'poskytovatel',
  'opravneni_ziadatelia', 'opravnene_aktivity', 'nazov_programu',
  'datum_vyhlasenia', 'deadline',
]);

function isStructuredKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (STRUCTURED_KEYS.has(lower)) return true;
  if (lower.includes('žiadatel') || lower.includes('ziadatel')) return true;
  if (lower.includes('oprávnen') || lower.includes('opravnen')) return true;
  return false;
}

export function DetailModal({ callId, onClose }: Props) {
  const [call, setCall] = useState<GrantCall | null>(null);
  const [attrs, setAttrs] = useState<GrantAttribute[]>([]);
  const [attachments, setAttachments] = useState<GrantAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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

  /* ── structured attribute values ── */
  const program = attrVal(attrs, 'Program', 'nazov_programu');
  const kodVyzvy = attrVal(attrs, 'Kód výzvy', 'kod_vyzvy');
  const druhVyzvy = attrVal(attrs, 'Druh výzvy');
  const typVyzvy = attrVal(attrs, 'Typ výzvy');
  const vyhlasovatel = attrVal(attrs, 'Vyhlasovateľ výzvy', 'poskytovatel');

  const alokaciaEU = attrVal(attrs, 'Alokácia EÚ', 'alokacia_eu');
  const alokaciaSR = attrVal(attrs, 'Alokácia ŠR');
  const alokaciaSpolu = attrVal(attrs, 'Alokácia spolu', 'celkova_alokacia');

  const miestoRealizacie = attrVal(attrs, 'Miesto realizácie');
  const specificCiel = attrVal(attrs, 'Špecifický cieľ', 'specificke_ciele');
  const opravneniZiadatelia = attrVal(attrs, 'Oprávnení žiadatelia', 'opravneni_ziadatelia') ||
    attrValIncludes(attrs, 'žiadatel') || attrValIncludes(attrs, 'ziadatel');
  const opravneneAktivity = attrVal(attrs, 'opravnene_aktivity');

  const hasBasicInfo = program || kodVyzvy || druhVyzvy || typVyzvy || vyhlasovatel;
  const hasFinancing = alokaciaEU || alokaciaSR || alokaciaSpolu;
  const hasStructured = hasBasicInfo || hasFinancing || miestoRealizacie ||
    specificCiel || opravneniZiadatelia || opravneneAktivity;

  /* remaining attrs not covered by structured sections */
  const otherAttrs = attrs.filter(a => !isStructuredKey(a.key));

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

            {/* ── Core fields grid (unchanged) ── */}
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

            {/* ── Structured ITMS21 attribute sections ── */}
            {hasStructured && (
              <>
                {hasBasicInfo && (
                  <div className="detail-section">
                    <h3>📋 Základné informácie</h3>
                    <div className="attrs-list">
                      {program && (
                        <div className="attr-row"><span className="attr-key">Program</span><span className="attr-value">{program}</span></div>
                      )}
                      {kodVyzvy && (
                        <div className="attr-row"><span className="attr-key">Kód výzvy</span><span className="attr-value">{kodVyzvy}</span></div>
                      )}
                      {druhVyzvy && (
                        <div className="attr-row"><span className="attr-key">Druh výzvy</span><span className="attr-value">{druhVyzvy}</span></div>
                      )}
                      {typVyzvy && (
                        <div className="attr-row"><span className="attr-key">Typ výzvy</span><span className="attr-value">{typVyzvy}</span></div>
                      )}
                      {vyhlasovatel && (
                        <div className="attr-row"><span className="attr-key">Vyhlasovateľ</span><span className="attr-value">{vyhlasovatel}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {hasFinancing && (
                  <div className="detail-section">
                    <h3>💰 Financovanie</h3>
                    <div className="attrs-list">
                      {alokaciaEU && (
                        <div className="attr-row"><span className="attr-key">Alokácia EÚ</span><span className="attr-value">{alokaciaEU}</span></div>
                      )}
                      {alokaciaSR && (
                        <div className="attr-row"><span className="attr-key">Alokácia ŠR</span><span className="attr-value">{alokaciaSR}</span></div>
                      )}
                      {alokaciaSpolu && (
                        <div className="attr-row"><span className="attr-key">Alokácia spolu</span><span className="attr-value">{alokaciaSpolu}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {miestoRealizacie && (
                  <div className="detail-section">
                    <h3>📍 Miesto realizácie</h3>
                    <div className="attrs-list">
                      <div className="attr-row" style={{ flexDirection: 'column', gap: 4 }}>
                        <span className="attr-value">{miestoRealizacie}</span>
                      </div>
                    </div>
                  </div>
                )}

                {opravneniZiadatelia && (
                  <div className="detail-section">
                    <h3>👥 Oprávnení žiadatelia</h3>
                    <div className="attrs-list">
                      <div className="attr-row" style={{ flexDirection: 'column', gap: 4 }}>
                        <span className="attr-value">{opravneniZiadatelia}</span>
                      </div>
                    </div>
                  </div>
                )}

                {specificCiel && (
                  <div className="detail-section">
                    <h3>🎯 Špecifický cieľ</h3>
                    <div className="attrs-list">
                      <div className="attr-row" style={{ flexDirection: 'column', gap: 4 }}>
                        <span className="attr-value">{specificCiel}</span>
                      </div>
                    </div>
                  </div>
                )}

                {opravneneAktivity && (
                  <div className="detail-section">
                    <h3>✅ Oprávnené aktivity</h3>
                    <div className="attrs-list">
                      <div className="attr-row" style={{ flexDirection: 'column', gap: 4 }}>
                        <span className="attr-value">{opravneneAktivity}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Other (non-structured) attributes ── */}
            {otherAttrs.length > 0 && (
              <div className="detail-section">
                <h3>Doplňujúce údaje</h3>
                <div className="attrs-list">
                  {otherAttrs.map(a => (
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
