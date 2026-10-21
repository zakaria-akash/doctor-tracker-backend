import { app } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

await connectDB();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`🚀 API ready on http://${env.HOST}:${env.PORT}/api/v1 · docs at /api/docs`);
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
