/** Countries in the comparison, kept in ?compare=AAA,BBB. */
export const MAX_COMPARE = 4;

/** Raw ids from the URL; validate with `validCompare` once the country list is loaded. */
export function compareFromUrl(): string[] {
  return parseCompare(new URLSearchParams(window.location.search).get('compare') ?? '');
}

/** Parses the comma list: uppercase ids, no duplicates. Not capped: unknown ids are dropped first. */
export function parseCompare(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toUpperCase();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Known ids only, then at most MAX_COMPARE, so unknown ids cannot crowd out real ones. */
export function validCompare(ids: readonly string[], known: ReadonlySet<string>): string[] {
  return ids.filter((id) => known.has(id)).slice(0, MAX_COMPARE);
}

/** Adds or removes a country; adding beyond the limit drops the oldest. */
export function toggleCompare(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [...list, id].slice(-MAX_COMPARE);
}
