# GrantBot RAG Chatbot - PRD

## Prehľad
- **Problém:** Používatelia nevedia nájsť relevantné granty pre svoju situáciu, pretože musia manuálne prechádzať stovky výziev.
- **Používateľ:** Malý/stredný podnikateľ hľadajúci grantové financovanie na Slovensku.
- **Riešenie:** Conversational chatbot, ktorý vyhľadáva grantové výzvy z databázy a interaktívne pomáha používateľovi zúžiť výber.
- **Aha moment:** Používateľ zadá široké kritériá → chatbot okamžite zobrazí všetky relevantné granty → ponúkne možnosti zúženia (lokalita, sektor, typ projektu) → postupne spresňuje výber.

## User Stories (MVP)

- **US-1:** Ako podnikateľ chcem zadať široké kritériá (napr. "firma z Bratislavy, mliečne výrobky"), aby mi chatbot okamžite ukázal všetky relevantné granty.
- **US-2:** Ako podnikateľ chcem, aby mi chatbot po zobrazení výsledkov ponúkol možnosti zúženia výberu (lokalita, sektor, typ projektu), aby som našiel presnejšiu zhodu.
- **US-3:** Ako podnikateľ chcem postupne špecifikovať detaily a vidieť ako sa zúži výber grantov, aby som našiel najvhodnejšiu výzvu.
- **US-4:** Ako podnikateľ chcem vidieť konkrétne granty s názvom, deadlinom, alokáciou a odkazom, aby som mohal rovno podať žiadosť.
- **US-5:** Ako podnikateľ chcem klásť doplňujúce otázky o konkrétnom grante (oprávnenosť, podmienky), aby som vedel či sa kvalifikujem.
- **US-6:** Ako návštevník stormlevel.com chcem chatbot widget v pravom dolnom rohu, ktorý komunikuje s VPS backendom, aby všetka výpočtová práca prebiehala na serveri a nie v prehliadači.

## Dátový model

### Existujúce tabuľky (Supabase, nemeniť)
- **grant_calls_v2:** id, source, source_url, call_url, title, announced_at, deadline_at, provider, call_type, total_allocation, eligible_applicants, status, created_at, updated_at
- **call_chunks:** id, call_id (FK → grant_calls_v2), content, embedding (vector), metadata

### Nové tabuľky

**chat_sessions**
| Pole | Typ | Popis |
|------|-----|-------|
| id | uuid PK | Session ID |
| created_at | timestamptz | Vytvorenie |
| last_active_at | timestamptz | Posledná aktivita |
| user_context | jsonb | Extrahovaný kontext (sektor, región, veľkosť firmy, typ projektu) |
| message_count | int | Počet správ |

**chat_messages**
| Pole | Typ | Popis |
|------|-----|-------|
| id | uuid PK | Message ID |
| session_id | uuid FK → chat_sessions | Session |
| role | text | 'user' / 'assistant' |
| content | text | Obsah správy |
| metadata | jsonb | Referencované grant IDs, search scores |
| created_at | timestamptz | Timestamp |

**chat_analytics** (agregované, nie PII)
| Pole | Typ | Popis |
|------|-----|-------|
| id | uuid PK | |
| date | date | Deň |
| total_sessions | int | Počet sessions |
| total_messages | int | Počet správ |
| avg_messages_per_session | float | Priemer |
| top_sectors | jsonb | Top hľadané sektory |
| top_regions | jsonb | Top regióny |

## Architektúra

**Zásadné rozhodnutie:** Všetka výpočtová práca prebieha na VPS, stormlevel.com obsahuje len tenké GUI.

```
┌─────────────────────────────────────────────────────────────────┐
│  STORMLEVEL.COM (Thin GUI — len prezentácia)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ChatWidget (React) — static files                     │   │
│  │  - Floating button (pravý dolný roh)                    │   │
│  │  - Chat panel (slide-up)                              │   │
│  │  - Message bubbles + typing indicator                 │   │
│  │  - Session ID v localStorage                            │   │
│  │  - ŽIADNY business logic, ŽIADNE LLM volania            │   │
│  └──────────────────────┬──────────────────────────────────┘   │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          │ HTTPS / WebSocket
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  VPS 31.97.46.222 (Backend + Compute + Database)                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  🌐 API Server (Node.js/Express alebo Next.js API)     │     │
│  │     ┌─────────────────────────────────────────────┐    │     │
│  │     │ POST /api/chat                                 │    │     │
│  │     │ 1. Prijmi správu + session_id                  │    │     │
│  │     │ 2. Načítaj chat_messages (posledných 10)       │    │     │
│  │     │ 3. Context Extraction (Ollama LLM #1)          │    │     │
│  │     │    → extrahuj: sektor, región, veľkosť, typ  │    │     │
│  │     │ 4. Vector Search (Supabase pgvector)           │    │     │
│  │     │    → match_call_chunks RPC (vráť VŠETKY granty)│    │     │
│  │     │ 5. Post-filter podľa kontextu                 │    │     │
│  │     │ 6. Response Generation (Ollama LLM #2)         │    │     │
│  │     │    → formátuj granty + ponúkni zúženie        │    │     │
│  │     │ 7. Ulož messages do DB                         │    │     │
│  │     └─────────────────────────────────────────────┘    │     │
│  └────────────────────────┬────────────────────────────────┘     │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ Ollama LLM  │  │ Ollama LLM  │  │ Supabase PostgreSQL │   │
│  │ Context Ex. │  │ Response Gen│  │ + pgvector          │   │
│  │ (1. call)   │  │ (2. call)   │  │                     │   │
│  │ localhost:  │  │ localhost:  │  │ kapgabgnezcurm...   │   │
│  │ 11434       │  │ 11434       │  │ supabase.co         │   │
│  └─────────────  └─────────────  └─────────────────────  │   │
│                                                                 │
│  NOTE: Ollama beží LOKÁLNE na VPS — žiadne cloud LLM API      │
│  Samostatné volania: extrakcia kontextu vs. generovanie       │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/chat
**Request:**
```json
{
  "session_id": "uuid (optional, vytvorí nový ak chýba)",
  "message": "Hľadám grant na digitalizáciu malej firmy v Košiciach"
}
```

**Response (JSON):**
```json
{
  "session_id": "uuid",
  "message": "Našiel som 23 grantov pre digitálnu transformáciu podnikov. Tu je prehľad najrelevantnejších:\n\n1. **Digitalizácia MSP 2026** — Deadline: 30.06.2026, Alokácia: 5M€...",
  "grants": [
    {
      "id": "uuid",
      "title": "Digitalizácia MSP 2026",
      "deadline_at": "2026-06-30",
      "total_allocation": 5000000,
      "provider": "MIRRI SR",
      "call_url": "https://...",
      "relevance_score": 0.95
    }
  ],
  "refinement_options": {
    "available": true,
    "suggestions": [
      "Lokalita: Bratislavský kraj",
      "Sektor: Služby",
      "Typ projektu: Nákup IT vybavenia",
      "Veľkosť firmy: Mikropodnik"
    ]
  },
  "search_context": {
    "extracted": {
      "sektor": "služby",
      "región": "Košice",
      "veľkosť": "malá",
      "typ_projektu": "digitalizácia"
    },
    "total_matches": 23,
    "shown": 5
  }
}
```

### GET /api/chat/health
Health check pre monitoring.

### GET /api/analytics (interný, optional pre MVP)
Základné štatistiky používania.

## LLM Prompt Engineering Stratégia

### System Prompt (Context Extractor)
```
Si asistent pre grantové poradenstvo na Slovensku. Tvojou úlohou je
analyzovať konverzáciu a extrahovať tieto údaje:
- sektor (IT, poľnohospodárstvo, výroba, služby, vzdelávanie, zdravotníctvo, ...)
- región (kraj alebo mesto)
- veľkosť_firmy (mikro <10, malá 10-49, stredná 50-249, veľká 250+, FO, obec, neziskovka)
- typ_projektu (digitalizácia, vzdelávanie, výskum, energia, infraštruktúra, ...)
- rozpočet (ak uvedený)

Vráť JSON: {"sektor": "...", "región": "...", "veľkosť": "...",
"typ_projektu": "...", "rozpočet": null, "kontext_kompletný": true/false}

Ak chýba sektor ALEBO typ_projektu, nastav kontext_kompletný na false.
```

### System Prompt (Conversational — Broad → Narrow)
```
Si GrantBot, priateľský poradca pre grantové výzvy na Slovensku.

PRAVIDLÁ:
1. Komunikuj po slovensky, zrozumiteľne, bez byrokracie.
2. VŽDY vyhľadaj granty s tým kontextom čo máš — nečakaj na kompletné informácie.
3. Ak nájdeš >10 grantov:
   - Zobraz prehľad top 5-7 najrelevantnejších
   - Ponúkni možnosti zúženia: "Chcete špecifikovať? Môžete pridať: [lokalitu] [sektor] [typ projektu]"
4. Ak nájdeš 3-10 grantov:
   - Zobraz všetky s detailmi (názov, deadline, alokácia, odkaz)
   - Stále ponúkni zúženie ak user chce ešte konkrétnejšie
5. Ak nájdeš <3 granty:
   - Zobraz všetky detailne
   - Spýtaj sa či nechce uvoľniť niektoré kritériá (širšie hľadanie)
6. Postupne akumuluj kontext z celej konverzácie — každá nová správa pridáva info.
7. Neodporúčaj granty po deadlinu.
8. Ak nenájdeš nič relevantné, povedz to a navrhni alternatívy (iný sektor, iný typ projektu).
```

### Conversational Flow (Broad → Narrow)

**Iterácia 1 — Široké hľadanie:**
1. User: "Som firma z Bratislavy, mliečne výrobky"
2. Context Extraction: `{sektor: "poľnohospodárstvo", región: "Bratislava", typ_projektu: null}`
3. Vector Search: vyhľadá všetky granty pre poľnohospodárstvo (bez ohľadu na typ projektu)
4. Response: "Našiel som 15 grantov pre poľnohospodárske podniky. Tu je prehľad..."
5. + Refinement options: Chcete špecifikovať? [Typ projektu] [Rozšírenie výroby] [Iné]

**Iterácia 2 — Zúženie:**
1. User: "Rozšírenie výroby"
2. Context Extraction: pridá `typ_projektu: "rozšírenie výroby"`
3. Post-filter: z 15 grantov → 7 grantov
4. Response: "Zúžil som výber na 7 grantov pre rozšírenie poľnohospodárskej výroby..."
5. + ďalšie refinement options alebo ukončenie

**Iterácia N — Konvergencia:**
- Pokračuje kým user nenapíše "ďakujem" alebo neklike na konkrétny grant
- Každá iterácia pridá 1 parameter a zobrazí zúžený zoznam

### Flow Logic (2-phase LLM)
1. **Phase 1 (Context Extraction):** Vstup: posledných N správ. Výstup: štruktúrovaný JSON s extrahovaným kontextom (akumulatívny — dopĺňa nové info k existujúcemu kontextu).
2. **Phase 2 (Response Generation):** Vždy volá vector search (s aktuálnym kontextom), potom generuje odpoveď. Ak >10 grantov, ponúkne refinement options. Ak ≤10, zobrazí všetky s detailami.

Rozdiel oproti pôvodnému návrhu: NIE ČAKÁME na kompletný kontext pred vyhľadaním. Vyhľadávame IHNEĎ s tým čo máme a následne ponúkame zúženie.

## Stránky / Obrazovky (MVP)

- **/grant-viewer** (existujúci) - pridanie ChatWidget komponentu
- **ChatWidget** - floating button + chat panel overlay
  - Uvítacia správa: "Ahoj! Som GrantBot. Pomôžem vám nájsť vhodné granty. Opíšte mi váš projekt alebo firmu."
  - Message list (scrollable)
  - Input field + send button
  - Typing indicator (3 dots animation)
  - Grant card (mini-preview v chate s odkazom na detail)
  - "Nová konverzácia" button

## Tech Stack

- **Frontend (stormlevel.com):** React + TypeScript (existujúci grant-viewer) + nový ChatWidget komponent — len GUI, žiadna logika
- **Backend API (VPS 31.97.46.222):** Express.js server na Node.js — všetka business logika, LLM volania, DB queries
- **LLM (VPS local):** Ollama (llama3.2:3b) na localhost:11434 — multi-user load TBD (potrebný benchmark)
- **Databáza:** Supabase PostgreSQL + pgvector (cloud, existujúce)
- **Embeddings:** OpenAI text-embedding-3-small pre query embedding (kompatibilita s existujúcimi chunk embeddingmi)
- **Deploy:** stormlevel.com (static frontend) + VPS 31.97.46.222 (API + Ollama)

### Ollama Multi-User Capacity (⚠️ Risk)
**Neznáme:** Dokáže Ollama na VPS obslúžiť X súčasných užívateľov?
- llama3.2:3b je malý model (~2GB RAM)
- VPS má 193GB disk, ale RAM/CPU profil neznámy
- **Potrebný benchmark:** 1, 5, 10 súčasných requestov → meranie response time
- **Mitigácia:** Ak pomalé → queue system alebo upgrade na väčší VPS

### Rozhodnutie: Embedding model
Momentálne sa používa OpenAI text-embedding-3-small pre embeddingy. Pre chatbot query embedding máme 2 možnosti:
1. **Ponechať OpenAI** - konzistentné s existujúcimi embeddingmi, ale platené
2. **Lokálny nomic-embed-text** - zadarmo, ale treba re-embed všetky chunks (iná dimenzia)

**Odporúčanie:** Ponechať OpenAI pre query embedding (kompatibilita s existujúcimi chunk embeddingmi). Cost je minimálny (~$0.01/1000 queries).

## Anti-scope (NIE JE v MVP)

- Registrácia/prihlásenie používateľov
- Ukladanie obľúbených grantov z chatu
- Multi-language support (len SK)
- Voice input
- PDF export konverzácie
- Notifikácie o nových grantoch
- Admin panel pre správu chatbota
- Fine-tuning LLM modelu
- Platený premium tier

## Riziká

| Riziko | Pravdepodobnosť | Dopad | Mitigácia |
|--------|-----------------|-------|-----------|
| **Ollama na VPS nezvláda multi-user load** | Vysoká | Vysoký | **CRITICAL:** Pred buildom nutný benchmark. Ak zlyhá → queue system alebo cloud LLM fallback (Groq free tier). |
| **Ollama nie je nainštalovaný/spustený na VPS** | Stredná | Vysoký | Overiť na začiatku TASK-001. Ak chýba → inštalácia + systemd service setup. |
| Halucinácie LLM (vymyslené granty) | Stredná | Vysoký | LLM generuje len na základe DB výsledkov (RAG). Granty vždy z reálnych dát. Prompt explicitne zakazuje vymýšľanie. |
| CORS/networking medzi stormlevel.com a VPS API | Nízka | Stredný | VPS API musí mať CORS pre stormlevel.com origin. |
| Latencia medzi stormlevel.com a VPS (2 network hops) | Nízka | Stredný | WebSocket alebo HTTP keep-alive. VPS v EU, stormlevel hosting tiež EU → malá latencia. |

## Odhad: 5 dní

- Deň 1: Setup (Ollama na VPS, API scaffold, DB migrácie)
- Deň 2: Core RAG pipeline (context extraction + vector search + response generation)
- Deň 3: ChatWidget frontend komponent
- Deň 4: Integrácia frontend-backend, prompt tuning
- Deň 5: Deploy, testovanie, hardening
