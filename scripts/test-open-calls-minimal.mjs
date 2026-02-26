import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CHAT_API = 'https://api.stormlevel.com/api/chat';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL/SUPABASE_KEY in env');
  process.exit(1);
}

const STOP = new Set([
  'a','aj','ako','alebo','ani','asi','at','bez','bude','by','čo','do','je','jej','jeho','jej','ju','k','keď','ktoré','ktorý','ktorá',
  'na','nad','nie','o','od','po','pre','pri','sa','si','so','sú','ta','ten','tieto','toto','to','tu','v','vo','za','z','ze','žiadne',
  'ii','iii','iv','v','vi','vii','viii','ix','x',
  'do','pre','pri','pro','podpora','projektov','projekt','systému','vytvorenie','vybudovanie','rozvoj','posilnenie','riešenie','obnova'
]);

function tokenize(title) {
  // Keep diacritics (better matching with DB titles and embeddings)
  const clean = title
    .toLowerCase()
    .replace(/[^\p{L}0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  return clean.split(' ').filter(w => w.length >= 4 && !STOP.has(w));
}

function minimalQueryFromTitle(title) {
  const toks = tokenize(title);
  // Use as few keywords as possible, but at least 2 when available
  const chosen = toks.slice(0, Math.min(2, toks.length));
  if (chosen.length === 0) return 'dotacie otvorena vyzva';
  if (chosen.length === 1) return `${chosen[0]} vyzva`;
  return chosen.join(' ');
}

async function supabaseOpenCalls(limit = Number(process.env.LIMIT || 30)) {
  const url = `${SUPABASE_URL}/rest/v1/grant_calls_v2?select=id,title,status,provider,source&status=eq.otvoren%C3%A1&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return await res.json();
}

async function chat(query) {
  const session_id = crypto.randomUUID();
  const t0 = Date.now();
  const res = await fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message: query })
  });
  const ms = Date.now() - t0;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ms, json };
}

function includesExpected(grants, expectedId) {
  if (!Array.isArray(grants)) return false;
  return grants.some(g => g?.id === expectedId);
}

async function main() {
  const calls = await supabaseOpenCalls();
  console.log(`Open calls in DB: ${calls.length}`);

  let pass = 0;
  let fail = 0;
  const rows = [];

  for (const c of calls) {
    const expectedId = c.id;
    const title = c.title;
    const q = minimalQueryFromTitle(title);

    const { status, ms, json } = await chat(q);
    const ok = status === 200 && includesExpected(json.grants, expectedId);

    rows.push({ ok, ms, q, title, got: (json.grants || []).map(g => g.title).slice(0,3).join(' | ') });
    if (ok) pass++; else fail++;

    // small delay to avoid hammering
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nResults: PASS ${pass}, FAIL ${fail}`);
  console.log('--- FAILURES (top 20) ---');
  rows.filter(r => !r.ok).slice(0, 20).forEach(r => {
    console.log(`FAIL | ${r.ms}ms | q="${r.q}" | expected="${r.title}" | got="${r.got}"`);
  });

  // Write machine-readable report
  const fs = await import('node:fs/promises');
  await fs.writeFile('docs/open-calls-minimal-test.json', JSON.stringify({ pass, fail, rows }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
