import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  // A JOSE error for an expired, malformed, or wrongly signed token is normalized by errorHandler.
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw ApiError.forbidden();
    next();
  };
