import bcrypt from 'bcryptjs';
import { decodeJwt, SignJWT } from 'jose';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { User } from './user.model.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const DUMMY_HASH = bcrypt.hashSync('timing-attack-guard', env.BCRYPT_ROUNDS);

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password');

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  const token = await new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);

  return {
    token,
    expiresAt: new Date(decodeJwt(token).exp * 1000).toISOString(),
    user: user.toJSON(),
  };
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  return user.toJSON();
}
