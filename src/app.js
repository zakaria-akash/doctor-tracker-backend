import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { openapiSpec } from './docs/openapi.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Swagger UI needs a relaxed CSP; every other endpoint gets the strict default.
app.use(
  '/api/docs',
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: 'Doctor Tracker API' }),
);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);
app.use(compression());
// Attach request logging before JSON parsing so malformed and oversized bodies are logged too.
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

// Reuses a live connection and makes importing `app` safe for integration tests.
app.use(
  '/api/v1',
  async (_req, _res, next) => {
    await connectDB();
    next();
  },
  apiRouter,
);

app.use(notFound);
app.use(errorHandler);

export default app;
