// Page numbers are one-based at the API boundary and zero-based for MongoDB skips.
export const skipFor = (page, limit) => (page - 1) * limit;

export function pageMeta(page, limit, total) {
  // Keep an empty result on page one so clients never need to navigate to page zero.
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Return the shared pagination envelope used by both doctor and patient lists.
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
