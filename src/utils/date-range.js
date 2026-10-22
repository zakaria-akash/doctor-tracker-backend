/** `from` and `to` are Date objects already coerced by Zod. */
export function buildDateRange(field, from, to) {
  // Omit the filter entirely when no boundary is supplied.
  if (!from && !to) return {};

  // Both boundaries are inclusive and can be supplied independently.
  return {
    [field]: {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    },
  };
}
