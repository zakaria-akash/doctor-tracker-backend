import { ipKeyGenerator, MINUTE, rateLimit } from 'express-rate-limit';

const rateLimited = (message) => (_req, res) =>
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } });

// Requests traversing the Next.js BFF share its server IP, so limits use account/user keys first.
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase() || ipKeyGenerator(req.ip)
      : ipKeyGenerator(req.ip),
  handler: rateLimited('Too many login attempts. Please try again in 15 minutes.'),
});

export const apiLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  handler: rateLimited('Too many requests. Please slow down.'),
});
