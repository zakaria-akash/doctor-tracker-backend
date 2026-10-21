import { ApiError } from '../utils/api-error.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
}
