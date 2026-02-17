export function normalizeForSearch(value: string): string {
  return (value || '')
    .normalize('NFD')
    // Remove diacritics (combining marks)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesQuery(fields: Array<string | null | undefined>, query: string): boolean {
  const q = normalizeForSearch(query).trim();
  if (!q) return true;

  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = normalizeForSearch(fields.filter(Boolean).join(' '));

  return terms.every(t => haystack.includes(t));
}
