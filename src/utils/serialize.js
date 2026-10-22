/** Shape Mongoose lean results consistently with document toJSON output. */
export function serialize(doc) {
  if (!doc) return doc;

  // Strip database internals and private/search-only fields from lean query results.
  const { _id, __v, searchTokens, passwordHash, createdBy, doctor, ...rest } = doc;

  // Populated doctors get the same public ID shape; an unpopulated reference remains an ID.
  return {
    id: String(_id),
    ...rest,
    ...(doctor !== undefined && {
      doctor: doctor?.name ? serialize(doctor) : String(doctor),
    }),
  };
}
