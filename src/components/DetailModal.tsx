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
  // Hide vs_ prefixed keys (vector search cached attributes)
  if (lower.startsWith('vs_')) return true;
  if (STRUCTURED_KEYS.has(lower)) return true;
  if (lower.includes('žiadatel') || lower.includes('ziadatel')) return true;
  if (lower.includes('oprávnen') || lower.includes('opravnen')) return true;
  return false;
}

/* ── Extracted attributes types ── */
interface ExtractedAttributes {
  [key: string]: string;
}

/**
 * Determine the API base URL for the Express backend.
 */
function getApiBaseUrl(): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  // Production: use PHP proxy path
  return '/grant-viewer';
}

/**
 * Fetch extracted attributes from vector search + GPT extraction backend.
 */
async function fetchExtractedAttributes(callId: string | number): Promise<ExtractedAttributes | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/calls/${callId}/extracted-attributes`);
    if (!response.ok) {
      console.warn(`[fetchExtractedAttributes] HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data as ExtractedAttributes;
  } catch (err) {
    console.error('[fetchExtractedAttributes] Error:', err);
    return null;
  }
}

/* ── Section rendering helper for extracted attrs ── */
interface AttrSection {
  icon: string;
  title: string;
  fields: { label: string; key: string }[];
  fullWidth?: boolean; // If true, render value as block text
}

const EXTRACTED_SECTIONS: AttrSection[] = [
  {
    icon: '📋',
    title: 'Základné informácie',
    fields: [
      { label: 'Kód výzvy', key: 'Kód výzvy' },
      { label: 'Program', key: 'Program' },
      { label: 'Fond', key: 'Fond' },
      { label: 'Opatrenie', key: 'Opatrenie' },
    ],
  },
  {
    icon: '🎯',
    title: 'Špecifický cieľ',
    fields: [{ label: 'Špecifický cieľ', key: 'Špecifický cieľ' }],
    fullWidth: true,
  },
  {
    icon: '💰',
    title: 'Financovanie',
    fields: [
      { label: 'Alokácia EÚ', key: 'Alokácia EÚ' },
      { label: 'Alokácia ŠR', key: 'Alokácia ŠR' },
      { label: 'Alokácia spolu', key: 'Alokácia spolu' },
    ],
  },
  {
    icon: '📍',
    title: 'Miesto realizácie',
    fields: [{ label: 'Miesto realizácie', key: 'Miesto realizácie' }],
    fullWidth: true,
  },
  {
    icon: '👥',
    title: 'Oprávnení žiadatelia',
    fields: [{ label: 'Oprávnení žiadatelia', key: 'Oprávnení žiadatelia' }],
    fullWidth: true,
  },
  {
    icon: '✅',
    title: 'Oprávnené aktivity / výdavky',
    fields: [
      { label: 'Oprávnené aktivity', key: 'Oprávnené aktivity' },
      { label: 'Oprávnené výdavky', key: 'Oprávnené výdavky' },
    ],
    fullWidth: true,
  },
  {
    icon: '📅',
    title: 'Posudzované obdobia',
    fields: [{ label: 'Posudzované obdobia', key: 'Posudzované obdobia' }],
    fullWidth: true,
  },
  {
    icon: '📞',
    title: 'Kontakt',
    fields: [{ label: 'Kontakt', key: 'Kontakt' }],
    fullWidth: true,
  },
];

export function DetailModal({ callId, onClose }: Props) {
  const [call, setCall] = useState<GrantCall | null>(null);
  const [attrs, setAttrs] = useState<GrantAttribute[]>([]);
  const [attachments, setAttachments] = useState<GrantAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  // Extracted attributes from vector search
  const [extractedAttrs, setExtractedAttrs] = useState<ExtractedAttributes | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);

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

    // Fetch extracted attributes from backend
    setExtractionLoading(true);
    fetchExtractedAttributes(callId)
      .then(setExtractedAttrs)
      .finally(() => setExtractionLoading(false));
  }, [callId]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('sk-SK') : '—';
  const formatAmount = (n: string | number | null) => {
    if (!n) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return String(n);
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
  };

  /* ── structured attribute values (from ITMS attrs table) ── */
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

  /* Check if extracted attrs have real data */
  const hasExtractedData = extractedAttrs && Object.entries(extractedAttrs).some(
    ([_, v]) => v && v !== '—' && v.trim() !== ''
  );

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

            {/* ── Vector Search Extracted Attributes ── */}
            {extractionLoading && (
              <div className="detail-section" style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                <div className="loading-spinner" style={{
                  display: 'inline-block',
                  width: 20,
                  height: 20,
                  border: '2px solid #4b5563',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: 10,
                  verticalAlign: 'middle',
                }} />
                Načítavam údaje z dokumentov...
              </div>
            )}

            {!extractionLoading && hasExtractedData && (
              <>
                {EXTRACTED_SECTIONS.map(section => {
                  // Filter to fields that have actual values
                  const validFields = section.fields.filter(f => {
                    const val = extractedAttrs![f.key];
                    return val && val !== '—' && val.trim() !== '';
                  });
                  if (validFields.length === 0) return null;

                  return (
                    <div className="detail-section" key={section.title}>
                      <h3>{section.icon} {section.title}</h3>
                      <div className="attrs-list">
                        {validFields.map(f => {
                          const val = extractedAttrs![f.key];
                          // Try to parse JSON objects (e.g. Kontakt) into key-value display
                          let displayVal: React.ReactNode = val;
                          if (val && val.startsWith('{')) {
                            try {
                              const parsed = JSON.parse(val);
                              if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                                displayVal = (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {Object.entries(parsed).map(([k, v]) => (
                                      <div key={k} style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ color: '#9ca3af', minWidth: 120, flexShrink: 0 }}>{k}:</span>
                                        <span>{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                            } catch { /* not JSON, show as-is */ }
                          }
                          if (section.fullWidth) {
                            return (
                              <div key={f.key} className="attr-row" style={{ flexDirection: 'column', gap: 4 }}>
                                {validFields.length > 1 && (
                                  <span className="attr-key" style={{ fontWeight: 600, marginBottom: 2 }}>{f.label}</span>
                                )}
                                <span className="attr-value" style={{ whiteSpace: 'pre-wrap' }}>{displayVal}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={f.key} className="attr-row">
                              <span className="attr-key">{f.label}</span>
                              <span className="attr-value">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Structured ITMS21 attribute sections (fallback if no extracted data) ── */}
            {!hasExtractedData && hasStructured && (
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

            {/* Doplňujúce údaje hidden — all data shown from vector search extraction above */}

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
