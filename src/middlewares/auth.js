import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { ROLES } from '../constants/enums.js';
import { ApiError } from '../utils/api-error.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  // A JOSE error for an expired, malformed, or wrongly signed token is normalized by errorHandler.
  // Require the same lifetime and identity claims that the frontend expects from our login tokens.
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    requiredClaims: ['sub', 'iat', 'exp'],
  });

  // Reject signed but incomplete identities before they can reach database queries or role checks.
  if (
    typeof payload.sub !== 'string' ||
    !/^[a-f\d]{24}$/i.test(payload.sub) ||
    !ROLES.includes(payload.role) ||
    typeof payload.name !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    throw ApiError.unauthorized('Invalid token claims');
  }

  req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw ApiError.forbidden();
    next();
  };
