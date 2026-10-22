import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

let connecting = null;

/** Idempotent: returns the live connection, or a single in-flight connect promise. */
export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);

  connecting ??= mongoose
    .connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !env.isProduction,
    })
    .then(({ connection }) => {
      logger.info({ db: connection.name }, 'MongoDB connected');
      return connection;
    })
    .finally(() => {
      // Keep only an in-flight attempt; a later disconnect must not reuse a stale resolved promise.
      connecting = null;
    });

  return connecting;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  connecting = null;
}
