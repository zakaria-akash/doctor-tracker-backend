/** `from` and `to` are Date objects already coerced by Zod. */
export function buildDateRange(field, from, to) {
  if (!from && !to) return {};

  return {
    [field]: {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    },
  };
}
