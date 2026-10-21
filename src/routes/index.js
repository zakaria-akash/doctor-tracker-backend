import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { apiLimiter } from '../middlewares/rate-limit.js';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { doctorsRouter } from '../modules/doctors/doctors.routes.js';
import { metaRouter } from '../modules/meta/meta.routes.js';
import { patientsRouter } from '../modules/patients/patients.routes.js';

export const apiRouter = Router();

// Login is public; authRouter protects /me itself.
apiRouter.use('/auth', authRouter);

// Everything mounted below requires a valid bearer token.
apiRouter.use(requireAuth, apiLimiter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/meta', metaRouter);
