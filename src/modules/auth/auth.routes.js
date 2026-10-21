import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { loginLimiter } from '../../middlewares/rate-limit.js';
import { validate } from '../../middlewares/validate.js';
import { loginBody } from './auth.schemas.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: loginBody }), controller.login);
authRouter.get('/me', requireAuth, controller.me);
