# GrantBot + GrantViewer Integračný Plán
## Iteratívny "Broad → Narrow" Conversational Flow

---

## 🎯 Cieľ
Používateľ zadá široký popis → Chatbot extrahuje kľúčové slová → GrantViewer zobrazí všetky relevantné výzvy → Chatbot analyzuje výsledky a ponúka filtre → Používateľ špecifikuje → Zúženie výsledkov.

---

## 🔄 User Flow (Krok za krokom)

### Krok 1: Široký vstup
**Používateľ:** "Som firma z Bratislavy, robíme mliečne výrobky"

**Chatbot urobí:**
```typescript
// Extrakcia kľúčových slov (pravidlová alebo LLM)
const keywords = extractKeywords(message);
// Result: { region: "Bratislava", sector: "poľnohospodárstvo", 
//           subsector: "mliečne výrobky", type: "firma" }
```

**Chatbot pošle do GrantViewer:**
```typescript
onKeywords?.(['Bratislava', 'poľnohospodárstvo', 'mliečne výrobky', 'firma']);
```

### Krok 2: GrantViewer zobrazí výzvy
**GrantViewer urobí:**
```typescript
// Vyhľadá v Supabase cez pgvector + full-text search
const results = await searchGrants({
  keywords: ['poľnohospodárstvo', 'mliečne výrobky'],
  region: 'Bratislava',
  status: 'otvorena'
});
// Zobrazí všetky výzvy (napr. 15 výziev)
```

**Chatbot povie:**
> "Našiel som **15 grantov** pre poľnohospodárske podniky. Tu je prehľad:
> 
> 1. **Digitalizácia MSP 2026** — 5M€, deadline: 30.06.2026
> 2. **Agroinovácie 2025** — 3M€, deadline: 15.05.2025
> ...
> 
> Z týchto výziev vidím rôzne zamerania. Chcete špecifikovať?
> 
> **[Rozšírenie výroby]** **[Digitalizácia]** **[Kyberbezpečnosť]** **[Školenie zamestnancov]** **[Energetická efektívnosť]**"

### Krok 3: Analýza výsledkov a ponuka filtrov
**Chatbot analyzuje zobrazené výzvy:**
```typescript
// Zanalyzuje kategórie zobrazených výziev
const categories = analyzeCategories(displayedGrants);
// Result: ['Rozšírenie výroby', 'Digitalizácia', 'Kyberbezpečnosť', 
//          'Školenie zamestnancov', 'Energetická efektívnosť']
```

**Chatbot zobrazí tlačidlá na výber:**
- Každá kategória je klikateľné tlačidlo
- Kliknutie pošle novú query s pridaným filtrom

### Krok 4: Používateľ vyberie kategóriu
**Používateľ klikne:** "Kyberbezpečnosť"

**Chatbot pošle:**
```typescript
onKeywords?.(['Bratislava', 'poľnohospodárstvo', 'kyberbezpečnosť']);
```

**GrantViewer zúži výsledky:**
- Z 15 výziev → 3 výzvy (len tie s kyberbezpečnosťou)

### Krok 5: Iterácia pokračuje
Chatbot opäť analyzuje a ponúka ďalšie filtre alebo zobrazí detaily konkrétnych výziev.

---

## 🛠️ Implementačné kroky

### Fáza 1: Keyword Extraction (1 deň)
```typescript
// Jednoduchá pravidlová extrakcia (bez LLM pre rýchlosť)
const KEYWORDS = {
  regions: ['Bratislava', 'Košice', 'Prešov', ...],
  sectors: ['poľnohospodárstvo', 'IT', 'výroba', 'služby', ...],
  projectTypes: ['digitalizácia', 'rozšírenie', 'kyberbezpečnosť', ...],
};

function extractKeywords(message: string): string[] {
  const lower = message.toLowerCase();
  const found: string[] = [];
  
  // Hľadaj všetky kľúčové slová
  Object.values(KEYWORDS).flat().forEach(keyword => {
    if (lower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    }
  });
  
  return found;
}
```

### Fáza 2: GrantViewer Search Integration (1 deň)
```typescript
// V App.tsx už máš handleChatKeywords
const handleChatKeywords = (keywords: string[]) => {
  const query = keywords.join(' ');
  setSearchQuery(query);
  if (view !== 'list') setView('list');
};
```

Potrebné: Rozšíriť `ListView` aby prijímal `searchQuery` a filtroval výzvy.

### Fáza 3: Category Analysis (1-2 dni)
```typescript
// Analýza zobrazených výziev a extrakcia kategórií
function analyzeCategories(grants: GrantCall[]): string[] {
  const categories = new Set<string>();
  
  grants.forEach(grant => {
    // Z tagov, sektorov, alebo summary
    if (grant.sector_tags) {
      grant.sector_tags.forEach(tag => categories.add(tag));
    }
    // Heuristika z názvu/summary
    if (grant.summary?.includes('kyber')) categories.add('Kyberbezpečnosť');
    if (grant.summary?.includes('digital')) categories.add('Digitalizácia');
    // ...
  });
  
  return Array.from(categories).slice(0, 5); // Max 5 kategórií
}
```

### Fáza 4: Chatbot API Server (2-3 dni)
Node.js Express API s endpointmi:
- `POST /api/chat` — hlavný endpoint
- `POST /api/extract-keywords` — extrakcia z message
- `POST /api/analyze-categories` — analýza zobrazených výziev

### Fáza 5: End-to-End Test (1 deň)
- Test celého flow: zadanie → extrakcia → zobrazenie → analýza → zúženie
- Deploy na stormlevel.com/grant-viewer/

---

## 📊 Aktuálny stav komponentov

| Komponent | Stav | Čo chýba |
|-----------|------|----------|
| **ChatWidget** | ✅ Ready | Pripojiť na API (teraz mock) |
| **ListView** | ✅ Ready | Funguje semantic search |
| **Keyword Extraction** | ❌ Chýba | Jednoduchý regex/keyword matcher |
| **Category Analysis** | ❌ Chýba | Funkcia na analýzu zobrazených výziev |
| **Chatbot API** | ❌ Chýba | Express server na VPS |
| **Ollama/LLM** | ❌ Chýba | Voliteľné pre vylepšenú extrakciu |

---

## 🚀 Odporúčaný začiatok

Začneme **bez LLM** (rýchlejšie, stabilnejšie):

1. **Keyword extraction** → pravidlový systém (regex + keyword matching)
2. **Category analysis** → analýza `sector_tags`, `area_tags`, `summary`
3. **Chatbot API** → jednoduchý Express server

Keď to bude fungovať, môžeme pridať LLM pre "inteligentnejšie" odpovede.

---

## 💡 Ukážka konverzácie (finálny cieľ)

```
[Používateľ] Som firma z Bratislavy, poľnohospodárstvo

[Chatbot] Našiel som 15 grantov pre poľnohospodárske podniky vo Bratislave.
        Zobrazujem ich v prehľade...

[GrantViewer] (zobrazí 15 výziev s prioritou podľa relevance)

[Chatbot] Z týchto výziev vidím rôzne zamerania:
        • 5 výziev na Rozšírenie výroby
        • 4 výzvy na Digitalizáciu  
        • 3 výzvy na Kyberbezpečnosť
        • 2 výzvy na Školenie zamestnancov
        • 1 výzva na Energetickú efektívnosť

        Na čo sa chcete zamerať?
        [Rozšírenie výroby] [Digitalizácia] [Kyberbezpečnosť] [Školenie] [Energetika]

[Používateľ klikne: Kyberbezpečnosť]

[GrantViewer] (zúži na 3 výzvy s kyberbezpečnosťou)

[Chatbot] Zúžil som výber na 3 výzvy pre kyberbezpečnosť:
        1. Digitalizácia MSP 2026 — 5M€, deadline: 30.06.2026
        2. Agroinovácie 2025 — 3M€, deadline: 15.05.2025  
        3. IT bezpečnosť pre MSP — 1M€, deadline: 20.03.2025

        Chcete detail niektorej výzvy alebo ďalšie zúženie?
```

---

## ✅ Next Steps

Ak súhlasíš s týmto plánom:
1. Spustím **Fázu 1** — Keyword Extraction (pravidlový, bez LLM)
2. Potom **Fázu 2** — pripojenie na existujúci semantic search
3. Potom **Fázu 3** — Category Analysis
4. Nakoniec **Fáza 4** — Chatbot API

**Začneme?** (odhad: 2-3 dni pre prvé 3 fázy)