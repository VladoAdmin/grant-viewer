import { supabase } from './supabase';

/**
 * Input sanitization and guardrails
 */
const MAX_QUERY_LENGTH = 200;
const RATE_LIMIT_MS = 500;
let lastSearchTime = 0;

// Prompt injection patterns to block
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)/i,
  /system\s*prompt/i,
  /you\s+are\s+(now|a)/i,
  /forget\s+(everything|all|previous)/i,
  /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)\s+/i,
  /<script/i,
  /javascript:/i,
  /on(error|load|click)=/i,
  /\{\{.*\}\}/,  // template injection
  /\$\{.*\}/,     // template literal injection
];

export function sanitizeQuery(input: string): string {
  // Trim and limit length
  let clean = input.trim().slice(0, MAX_QUERY_LENGTH);
  
  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Remove potential script content
  clean = clean.replace(/[<>{}\[\]\\]/g, '');
  
  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      console.warn('[Security] Potential injection blocked:', clean.slice(0, 50));
      return ''; // Return empty to show all results
    }
  }
  
  return clean;
}

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - lastSearchTime < RATE_LIMIT_MS) {
    return true;
  }
  lastSearchTime = now;
  return false;
}

/**
 * Query intent classification - identifies what the user is looking for
 */
export interface QueryIntent {
  applicantTerms: string[];   // oprávnení žiadatelia (obce, firmy, neziskovky...)
  locationTerms: string[];    // miesto realizácie (Bratislava, východ SR...)
  sectorTerms: string[];      // priemyselný sektor (energia, voda, IT...)
  projectFocusTerms: string[];// projektové zameranie (inovácie, digitalizácia...)
  expenseTerms: string[];     // oprávnené výdavky (mzdy, vybavenie...)
  rawQuery: string;
}

const APPLICANT_KEYWORDS: Record<string, string[]> = {
  'obec': ['obec', 'mesto', 'mestská časť', 'obecný úrad', 'mestský úrad'],
  'kraj': ['samosprávny kraj', 'VÚC', 'kraj'],
  'firma': ['s.r.o.', 'a.s.', 'spoločnosť', 'podnikateľ', 'živnostník', 'MSP', 'malý podnik', 'stredný podnik', 'veľký podnik', 'firma'],
  'neziskovka': ['nezisková organizácia', 'občianske združenie', 'nadácia', 'n.o.'],
  'škola': ['vysoká škola', 'univerzita', 'základná škola', 'stredná škola', 'škola'],
  'výskum': ['výskumná inštitúcia', 'SAV', 'výskum'],
  'cirkev': ['cirkev', 'cirkevná organizácia', 'náboženská spoločnosť'],
  'rozpočtová org': ['rozpočtová organizácia', 'príspevková organizácia'],
};

const LOCATION_KEYWORDS = [
  'bratislava', 'bratislavský', 'trnava', 'trnavský', 'trenčín', 'trenčiansky',
  'nitra', 'nitriansky', 'žilina', 'žilinský', 'banská bystrica', 'banskobystrický',
  'prešov', 'prešovský', 'košice', 'košický', 'celá sr', 'celé slovensko',
  'východ', 'západ', 'stred', 'južné', 'severné',
];

const SECTOR_KEYWORDS: Record<string, string[]> = {
  'energia': ['energia', 'energetika', 'OZE', 'obnoviteľné zdroje', 'fotovoltaika', 'solárne', 'tepelné čerpadlo', 'zatepľovanie'],
  'voda': ['voda', 'vodovod', 'kanalizácia', 'čistička', 'odpadové vody', 'vodné hospodárstvo'],
  'IT': ['IT', 'digitalizácia', 'kybernetická bezpečnosť', 'informačné technológie', 'softvér', 'digitálne'],
  'životné prostredie': ['životné prostredie', 'klíma', 'emisie', 'odpad', 'recyklácia', 'biodiverzita', 'príroda'],
  'doprava': ['doprava', 'cesty', 'železnica', 'cyklotrasa', 'mobilita'],
  'poľnohospodárstvo': ['poľnohospodárstvo', 'farma', 'agrosektor', 'lesy', 'lesníctvo', 'potraviny'],
  'zdravotníctvo': ['zdravotníctvo', 'nemocnica', 'zdravie', 'lekár', 'zdravotná starostlivosť'],
  'vzdelávanie': ['vzdelávanie', 'školstvo', 'výchova', 'celoživotné vzdelávanie'],
  'šport': ['šport', 'športovisko', 'telocvičňa', 'ihrisko', 'štadión'],
  'kultúra': ['kultúra', 'pamiatky', 'múzeum', 'divadlo', 'kreatívny priemysel'],
  'sociálne': ['sociálne služby', 'sociálna inklúzia', 'rovnosť', 'zamestnanosť', 'inklúzia'],
  'cestovný ruch': ['turizmus', 'cestovný ruch', 'ubytovanie', 'turistika'],
};

const PROJECT_FOCUS_KEYWORDS: Record<string, string[]> = {
  'inovácie': ['inovácia', 'inovácie', 'výskum a vývoj', 'R&D', 'inovatívne'],
  'rekonštrukcia': ['rekonštrukcia', 'modernizácia', 'obnova', 'revitalizácia'],
  'výstavba': ['výstavba', 'stavba', 'nová budova', 'infraštruktúra'],
  'vzdelávanie a školenie': ['školenie', 'vzdelávacia aktivita', 'kurz', 'rekvalifikácia'],
  'cezhraničná spolupráca': ['cezhraničná', 'Interreg', 'spolupráca', 'prihraničný'],
};

const EXPENSE_KEYWORDS = [
  'mzdy', 'platy', 'personálne', 'vybavenie', 'zariadenie', 'stroje',
  'stavebné práce', 'služby', 'cestovné', 'materiál', 'nájom',
  'licencie', 'softvér', 'marketing', 'publicita',
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function classifyQuery(query: string): QueryIntent {
  query = sanitizeQuery(query);
  const q = normalize(query);
  const intent: QueryIntent = {
    applicantTerms: [],
    locationTerms: [],
    sectorTerms: [],
    projectFocusTerms: [],
    expenseTerms: [],
    rawQuery: query,
  };

  // Match applicant types
  for (const [category, keywords] of Object.entries(APPLICANT_KEYWORDS)) {
    if (keywords.some(kw => q.includes(normalize(kw)))) {
      intent.applicantTerms.push(category);
    }
  }

  // Match locations
  for (const loc of LOCATION_KEYWORDS) {
    if (q.includes(normalize(loc))) {
      intent.locationTerms.push(loc);
    }
  }

  // Match sectors
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => q.includes(normalize(kw)))) {
      intent.sectorTerms.push(sector);
    }
  }

  // Match project focus
  for (const [focus, keywords] of Object.entries(PROJECT_FOCUS_KEYWORDS)) {
    if (keywords.some(kw => q.includes(normalize(kw)))) {
      intent.projectFocusTerms.push(focus);
    }
  }

  // Match expense terms
  for (const exp of EXPENSE_KEYWORDS) {
    if (q.includes(normalize(exp))) {
      intent.expenseTerms.push(exp);
    }
  }

  return intent;
}

/**
 * Generate embedding for query using OpenAI API
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Semantic search using pgvector + intent-based attribute filtering
 * Returns call IDs ordered by relevance
 */
export async function semanticSearchCalls(query: string, limit: number = 20): Promise<string[]> {
  query = sanitizeQuery(query);
  if (!query || isRateLimited()) return [];
  const intent = classifyQuery(query);

  // 1. Vector search via embeddings
  const embedding = await getQueryEmbedding(query);
  let vectorResults: string[] = [];

  if (embedding) {
    try {
      const { data, error } = await supabase.rpc('match_call_chunks', {
        query_embedding: embedding,
        match_threshold: 0.15,
        match_count: limit * 3
      });

      if (!error && data) {
        const seen = new Set<string>();
        for (const row of data) {
          if (!seen.has(row.call_id)) {
            seen.add(row.call_id);
            vectorResults.push(row.call_id);
          }
        }
      }
    } catch (e) {
      console.error('Semantic search failed:', e);
    }
  }

  // 2. If intent detected specific filters, try to refine results via grant_calls_v2 detailed search
  // NOTE: grant_call_attributes table doesn't exist - fallback to searching in grant_calls_v2 call_details
  const hasFilters = intent.applicantTerms.length > 0
    || intent.locationTerms.length > 0
    || intent.sectorTerms.length > 0;

  if (hasFilters && vectorResults.length > 0) {
    try {
      // Fetch details from grant_calls_v2 (which includes call_details JSON)
      const { data: callsData, error: callsError } = await supabase
        .from('grant_calls_v2')
        .select('id, title, call_details')
        .in('id', vectorResults.slice(0, 60));

      if (callsError) {
        console.warn('Could not fetch call details for filtering:', callsError);
        // Continue with vector results unchanged
        return vectorResults.slice(0, limit);
      }

      if (callsData && callsData.length > 0) {
        // Score each call based on detailed content match
        const scored = vectorResults.map((callId, idx) => {
          let score = vectorResults.length - idx; // base score from vector rank
          const call = callsData.find(c => c.id === callId);
          
          if (!call) return { callId, score };

          // Combine all searchable text from call
          const searchText = normalize([
            call.title,
            typeof call.call_details === 'string' ? call.call_details : JSON.stringify(call.call_details)
          ].join(' '));

          // Boost for applicant match in details
          if (intent.applicantTerms.length > 0) {
            for (const term of intent.applicantTerms) {
              const keywords = APPLICANT_KEYWORDS[term] || [term];
              if (keywords.some(kw => searchText.includes(normalize(kw)))) {
                score += 50;
              }
            }
          }

          // Boost for location match
          if (intent.locationTerms.length > 0) {
            for (const loc of intent.locationTerms) {
              if (searchText.includes(normalize(loc))) {
                score += 30;
              }
            }
          }

          // Boost for sector match
          if (intent.sectorTerms.length > 0) {
            for (const sector of intent.sectorTerms) {
              const keywords = SECTOR_KEYWORDS[sector] || [sector];
              if (keywords.some(kw => searchText.includes(normalize(kw)))) {
                score += 20;
              }
            }
          }

          return { callId, score };
        });

        scored.sort((a, b) => b.score - a.score);
        console.log('[semanticSearch] Boosted results with intent filters:', intent);
        return scored.slice(0, limit).map(s => s.callId);
      }
    } catch (e) {
      console.error('Detailed filtering failed, returning vector results:', e);
    }
  }

  return vectorResults.slice(0, limit);
}

/**
 * Text-based search (fallback)
 */
export function normalizeForSearch(value: string): string {
  return normalize(value);
}

export function matchesQuery(fields: Array<string | null | undefined>, query: string): boolean {
  const q = normalizeForSearch(query).trim();
  if (!q) return true;

  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = normalizeForSearch(fields.filter(Boolean).join(' '));

  return terms.every(t => haystack.includes(t));
}
