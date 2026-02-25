# GrantBot RAG Chatbot - Task Breakdown

## Pravidlá
- Max 1-2 hodiny na task
- 1 task = 1 commit
- Každý task má acceptance criteria

---

## Fáza 1: Setup & Infraštruktúra (Deň 1)

### TASK-001: Ollama setup na VPS + Multi-user Benchmark ⚠️ CRITICAL
**Popis:** Nainštalovať/overiť Ollama na VPS 31.97.46.222, stiahnuť llama3.2:3b, benchmark multi-user capacity.
**Acceptance Criteria:**
- `curl http://localhost:11434/api/generate -d '{"model":"llama3.2:3b","prompt":"test"}'` vracia odpoveď
- Model llama3.2:3b stiahnutý a funkčný
- **⚠️ Multi-user benchmark (kritické pre GO/NO-GO):**
  - 1 súčasný request: response time <2s
  - 5 súčasných requestov: response time <5s
  - 10 súčasných requestov: response time <10s (alebo queue nevyhnutný)
- Ollama beží ako systemd service (reštart po reboot)
- **Ak benchmark zlyhá:** Nahlásiť ako blokér, navrhnúť fallback (queue system alebo cloud LLM)

### TASK-002: API projekt scaffold (VPS Backend)
**Popis:** Vytvoriť Express.js API server pre chatbot na VPS 31.97.46.222. Stormlevel.com = len thin GUI, všetka logika na VPS.
**Acceptance Criteria:**
- Express.js + TypeScript server v `chatbot-api/` (separate od grant-viewer)
- `POST /api/chat` endpoint (skeleton, vráti mock odpoveď)
- `GET /api/chat/health` vracia `{"status":"ok","ollama":true}`
- CORS nastavený pre stormlevel.com origin (a localhost pre dev)
- Env vars: SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, OLLAMA_URL=http://localhost:11434
- Package.json so scripts: dev, build, start
- Server počúva na porte 3000 (alebo inom), nginx reverse proxy voliteľné

### TASK-003: DB migrácie (chat tabuľky)
**Popis:** Vytvoriť tabuľky chat_sessions a chat_messages v Supabase.
**Acceptance Criteria:**
- Tabuľky chat_sessions, chat_messages existujú v Supabase
- RLS policies: anonymous insert/select (session-based, bez auth)
- SQL migrácia uložená v `chatbot-api/migrations/`
- Test: insert + select funguje cez Supabase client

---

## Fáza 2: Core RAG Pipeline (Deň 2)

### TASK-004: Context Extraction modul
**Popis:** Implementovať LLM call #1, ktorý z konverzácie extrahuje štruktúrovaný kontext (sektor, región, veľkosť firmy, typ projektu).
**Acceptance Criteria:**
- Funkcia `extractContext(messages[]) → {sektor, región, veľkosť, typ_projektu, kontext_kompletný}`
- Volá Ollama API s context extraction system promptom
- Vracia validný JSON (s fallback ak LLM vráti invalid JSON)
- Test: pre "Som malá IT firma z Košíc" vráti `{sektor:"IT", región:"Košice", veľkosť:"malá", kontext_kompletný: false}` (chýba typ projektu)

### TASK-005: Vector Search integration
**Popis:** Napojenie na existujúcu `match_call_chunks` RPC funkciu. Zostaviť search query z extrahovaného kontextu.
**Acceptance Criteria:**
- Funkcia `searchGrants(context) → GrantResult[]`
- Generuje embedding pre search query (OpenAI text-embedding-3-small)
- Volá match_call_chunks, deduplikuje, vracia top 5 grantov s metadátami
- Post-filter: vylúči granty po deadlinu
- Test: pre kontext `{sektor:"IT", typ_projektu:"digitalizácia"}` vracia relevantné výsledky

### TASK-006: Response Generation modul (Broad → Narrow Flow)
**Popis:** Implementovať LLM call #2, ktorý generuje konverzačnú odpoveď. VŽDY zobrazí granty (ak nájde), ponúkne možnosti zúženia.
**Acceptance Criteria:**
- Funkcia `generateResponse(messages[], context, grants[]) → {message, refinement_options}`
- Ak grants.length > 10:
  - Zobrazí top 5-7 grantov v prehľade
  - Ponúkne refinement_options: `["Lokalita: ...", "Sektor: ...", "Typ projektu: ..."]`
- Ak grants.length 3-10:
  - Zobrazí všetky granty s detailami
  - Stále ponúkne refinement_options (voliteľné ďalšie zúženie)
- Ak grants.length < 3:
  - Zobrazí všetky detailne
  - Spýta sa či nechce uvoľniť kritériá (širšie hľadanie)
- Nehalucuje granty (len z dodaných dát)
- Odpoveď po slovensky, priateľský tón

### TASK-007: Chat endpoint (full pipeline)
**Popis:** Spojiť TASK-004/005/006 do kompletného POST /api/chat endpointu. Vždy vyhľadáva a zobrazuje granty (nie "čaká na kompletný kontext").
**Acceptance Criteria:**
- Flow: prijmi správu → načítaj históriu → extract context (akumuluj s predchádzajúcim) → search grants → generate response → ulož do DB
- Session management: vytvorí novú session ak chýba session_id
- Vracia: session_id, message, grants[], refinement_options, search_context
- Context akumulácia: každá správa pridáva info k existujúcemu kontextu (neresetuje sa)
- Max 10 správ histórie v kontexte (window)
- Error handling: timeout, Ollama down, DB down

---

## Fáza 3: Frontend ChatWidget (Deň 3)

### TASK-008: ChatWidget UI komponent
**Popis:** React komponent pre chat interface, embedded do existujúceho grant-vieweru.
**Acceptance Criteria:**
- Floating button (pravý dolný roh, fixná pozícia)
- Click otvára chat panel (slide-up, max 500px šírka, 600px výška)
- Message list: user bubbles (vpravo, modrá), bot bubbles (vľavo, sivá)
- Input field + send button (Enter aj klik)
- Typing indicator počas čakania na odpoveď
- Responzívny (mobile: full-width panel)
- Uvítacia správa pri otvorení

### TASK-009: Chat API integration (frontend)
**Popis:** Napojenie ChatWidget na backend API.
**Acceptance Criteria:**
- Session ID generovaný na frontende (uuid), uložený v localStorage
- POST /api/chat volanie s message + session_id
- Streaming response handling (progressive text rendering)
- Error state: "Prepáčte, niečo sa pokazilo. Skúste znova."
- "Nová konverzácia" button (resetne session ID)

### TASK-010: Grant Card komponent v chate
**Popis:** Keď chatbot vráti granty, zobraziť ich ako klikateľné karty v chate.
**Acceptance Criteria:**
- GrantCard: názov, deadline, alokácia, provider
- Klik otvorí detail grantu (existujúci DetailModal alebo nový tab na call_url)
- Vizuálne odlíšené od bežných správ (karta s rámčekom)
- Max 5 kariet na odpoveď

---

## Fáza 4: Integrácia & Prompt Tuning (Deň 4)

### TASK-011: End-to-end integrácia
**Popis:** Spojiť frontend a backend, vyriešiť CORS, networking, env vars.
**Acceptance Criteria:**
- Frontend na stormlevel.com/grant-viewer komunikuje s API na VPS
- CORS funguje bez chýb
- Env vars nastavené (SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, OLLAMA_URL)
- Celý flow funguje: user píše → bot odpovedá → granty sa zobrazujú

### TASK-012: Prompt tuning & testovanie konverzácií
**Popis:** Otestovať 10+ scenárov konverzácií, vyladiť prompty pre kvalitu odpovedí.
**Acceptance Criteria:**
- Testované scenáre:
  1. User dá málo info → bot sa opýta
  2. User dá veľa info naraz → bot hneď vyhľadá
  3. User sa pýta na konkrétny grant
  4. Žiadne relevantné výsledky → bot to povie
  5. User píše nezmysel / off-topic
  6. User píše po anglicky
- Prompty vyladené, odpovede sú prirodzené a presné
- Priemerný response time <3s

---

## Fáza 5: Deploy & Hardening (Deň 5)

### TASK-013: Production deploy na VPS
**Popis:** Nasadiť API server na VPS, nastaviť process manager, reverse proxy.
**Acceptance Criteria:**
- API beží na VPS cez PM2/systemd
- Nginx reverse proxy (HTTPS ak možné, inak HTTP s CORS)
- Auto-restart po crash/reboot
- Env vars v .env (nie v kóde)
- Health check endpoint dostupný

### TASK-014: Frontend deploy na stormlevel.com
**Popis:** Build a deploy grant-viewer s ChatWidget na stormlevel.com.
**Acceptance Criteria:**
- `npm run build` bez chýb
- Deploy na stormlevel.com/grant-viewer cez SSH/FTP
- ChatWidget viditeľný a funkčný na produkcii
- Testované na mobile aj desktop

### TASK-015: Rate limiting & error handling
**Popis:** Ochrana API pred zneužitím, robustné error handling.
**Acceptance Criteria:**
- Rate limit: max 20 správ/minútu per session
- Rate limit: max 100 sessions/hodina per IP
- Graceful handling: Ollama timeout → "Momentálne mám veľa práce, skúste o chvíľu"
- Graceful handling: Supabase nedostupný → cached response alebo error message
- Logging: request/response časy, error logy

### TASK-016: Základné analytics
**Popis:** Sledovanie používania chatbota (anonymné).
**Acceptance Criteria:**
- Endpoint alebo DB query pre: počet sessions za deň, priemerný počet správ, top hľadané sektory
- Denná agregácia do chat_analytics tabuľky (cron alebo trigger)
- Jednoduchý výpis cez API alebo priamy SQL query

---

## Zhrnutie

| Fáza | Tasky | Odhad |
|------|-------|-------|
| 1. Setup | TASK-001 až 003 | 1 deň |
| 2. Core RAG | TASK-004 až 007 | 1 deň |
| 3. Frontend | TASK-008 až 010 | 1 deň |
| 4. Integrácia | TASK-011 až 012 | 1 deň |
| 5. Deploy | TASK-013 až 016 | 1 deň |
| **Celkom** | **16 taskov** | **5 dní** |
