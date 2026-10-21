export const skipFor = (page, limit) => (page - 1) * limit;

export function pageMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
