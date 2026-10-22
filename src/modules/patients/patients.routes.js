import { Router } from 'express';

import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/zod.js';
import { listPatientsQuery, updatePatientBody } from './patients.schemas.js';
import * as ctrl from './patients.controller.js';

// Authentication is applied by the parent API router; this module adds role checks for writes.
export const patientsRouter = Router();

// Any authenticated user can view the list and individual patient records.
patientsRouter.get('/', validate({ query: listPatientsQuery }), ctrl.list);
patientsRouter.get('/:id', validate({ params: idParams }), ctrl.getById);

// Only admins may edit or delete patients; both the id and request body are validated first.
patientsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: idParams, body: updatePatientBody }),
  ctrl.update,
);
patientsRouter.delete('/:id', requireRole('admin'), validate({ params: idParams }), ctrl.remove);
