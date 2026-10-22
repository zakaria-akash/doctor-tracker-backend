const DIACRITICS = /[\u0300-\u036f]/g;

// Normalize once for storage and searching so casing and accented letters behave consistently.
const normalize = (value) =>
  String(value).toLowerCase().normalize('NFKD').replace(DIACRITICS, '').trim();

// Escape user input before embedding it in anchored regular expressions.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build normalized, indexable tokens for prefix search. */
export function buildSearchTokens(...values) {
  const tokens = new Set();

  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;

    // Keep complete email addresses in addition to their component words.
    const text = normalize(value);
    if (text.includes('@')) tokens.add(text);

    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length >= 2) tokens.add(word);
    }

    // Store the complete digit-only number so unformatted phone prefixes remain searchable.
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 6) tokens.add(digits);
  }

  return [...tokens];
}

/** Create an escaped, anchored, index-friendly MongoDB prefix-search filter. */
export function buildSearchFilter(search) {
  const text = search ? normalize(search) : '';
  // Bound multi-word queries to five terms and match each against the token index by prefix.
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
