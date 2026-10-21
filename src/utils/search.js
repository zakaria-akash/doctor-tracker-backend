const DIACRITICS = /[\u0300-\u036f]/g;

const normalize = (value) =>
  String(value).toLowerCase().normalize('NFKD').replace(DIACRITICS, '').trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build normalized, indexable tokens for prefix search. */
export function buildSearchTokens(...values) {
  const tokens = new Set();

  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;

    const text = normalize(value);
    if (text.includes('@')) tokens.add(text);

    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length >= 2) tokens.add(word);
    }

    const digits = text.replace(/\D/g, '');
    if (digits.length >= 6) tokens.add(digits);
  }

  return [...tokens];
}

/** Create an escaped, anchored, index-friendly MongoDB prefix-search filter. */
export function buildSearchFilter(search) {
  const text = search ? normalize(search) : '';
  const terms = (text.includes('@') ? [text] : text.split(/[^a-z0-9]+/))
    .filter(Boolean)
    .slice(0, 5);

  if (!terms.length) return {};

  return {
    searchTokens: {
      $all: terms.map((term) => new RegExp(`^${escapeRegex(term)}`)),
    },
  };
}
