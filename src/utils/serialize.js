/** Shape Mongoose lean results consistently with document toJSON output. */
export function serialize(doc) {
  if (!doc) return doc;

  const { _id, __v, searchTokens, passwordHash, createdBy, doctor, ...rest } = doc;

  return {
    id: String(_id),
    ...rest,
    ...(doctor !== undefined && {
      doctor: doctor?.name ? serialize(doctor) : String(doctor),
    }),
  };
}
