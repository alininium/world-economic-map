/** Countries in the comparison, kept in ?compare=AAA,BBB. */
export const MAX_COMPARE = 4;

export function compareFromUrl(validIds?: ReadonlySet<string>): string[] {
  const raw = new URLSearchParams(window.location.search).get('compare') ?? '';
  return parseCompare(raw, validIds);
}

/** Parses the comma list: uppercase ids, no duplicates, at most MAX_COMPARE, known ids only if given. */
export function parseCompare(raw: string, validIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toUpperCase();
    if (!id || out.includes(id) || (validIds && !validIds.has(id))) continue;
    out.push(id);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

/** Adds or removes a country; adding beyond the limit drops the oldest. */
export function toggleCompare(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [...list, id].slice(-MAX_COMPARE);
}
