import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { emptyToUndefined } from '../../utils/zod.js';
import { getOverview, RANGES } from './analytics.service.js';

// Accept only the documented presets and make the default useful for first-load dashboards.
const overviewQuery = z.object({
  range: emptyToUndefined(z.enum(Object.keys(RANGES)).default('12m')),
});

export const analyticsRouter = Router();

// Authentication and per-user throttling are applied by the parent API router.
analyticsRouter.get('/overview', validate({ query: overviewQuery }), async (req, res) => {
  res.json({ success: true, data: await getOverview(req.valid.query) });
});
