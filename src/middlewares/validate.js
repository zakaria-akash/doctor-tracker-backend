/**
 * Parses params/query/body with Zod and stores the typed result on req.valid.
 * Express 5: req.query is a read-only getter, so never reassign it.
 */
export const validate = (schemas) => (req, _res, next) => {
  const valid = {};

  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;

    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) return next(result.error);

    valid[key] = result.data;
  }

  req.valid = valid;
  next();
};
