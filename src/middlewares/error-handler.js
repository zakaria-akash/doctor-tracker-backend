import { errors as joseErrors } from 'jose';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

// Express recognises error handlers by their 4 parameters, so `_next` must stay even though it's unused.
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof z.ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = z.flattenError(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = {
      formErrors: [],
      fieldErrors: Object.fromEntries(
        Object.entries(err.errors).map(([key, value]) => [key, [value.message]]),
      ),
    };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    status = 409;
    code = 'CONFLICT';
    message = `A record with this ${field} already exists`;
    details = { formErrors: [], fieldErrors: { [field]: [message] } };
  } else if (err instanceof joseErrors.JOSEError) {
    status = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid or expired token';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (status >= 500) req.log?.error({ err }, 'Unhandled error');
  else req.log?.warn({ code, message }, 'Request rejected');

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(!env.isProduction && status >= 500 && { stack: err.stack }),
    },
  });
}
