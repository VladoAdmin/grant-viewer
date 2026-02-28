# CLAUDE.md — Grant Viewer Project Context

## Projekt
Frontend pre prehľad slovenských grantových výziev. React + TypeScript + Vite.

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase JS client (query grant_calls_v2, grant_call_attributes, grant_call_attachments)
- html2canvas + jsPDF pre PDF reporty (slovenské diakritiky!)
- Tailwind CSS

## Deploy
- **Produkcia:** https://stormlevel.com/grant-viewer/
- **FTP:** `sshpass -p '923005954b' scp -P 25254 -r dist/* uid1125075@shell.r5.websupport.sk:/data/c/4/c4830825-2b90-47cd-b33d-145e854f9393/stormlevel.com/web/grant-viewer/`
- **Build:** `npm run build` → dist/

## Git
- **Branch:** master
- **Remote:** github.com/VladoAdmin/grant-viewer (push OK)

## Kľúčové súbory
- `src/lib/reportPdf.ts` — PDF generátor (pickAttr matching, buildSections)
- `src/lib/search.ts` — semantic search + classifyQuery + guardrails
- `src/lib/supabase.ts` — DB client + typy
- `src/components/ListView.tsx` — hlavný zoznam výziev
- `src/components/DetailModal.tsx` — detail výzvy + PDF download

## Dôležité
- PDF: pickAttr() robí fuzzy match (includes) — nové DB keys sa pridávajú do buildSections()
- Search: button-triggered, nie keystroke. Rate limit 500ms. Max 200 chars. Injection detection.
- Vite base path: `/grant-viewer/` (v vite.config.ts)
