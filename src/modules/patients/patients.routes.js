import { Router } from 'express';

import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/zod.js';
import { listPatientsQuery, updatePatientBody } from './patients.schemas.js';
import * as ctrl from './patients.controller.js';

export const patientsRouter = Router();

patientsRouter.get('/', validate({ query: listPatientsQuery }), ctrl.list);
patientsRouter.get('/:id', validate({ params: idParams }), ctrl.getById);
patientsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: idParams, body: updatePatientBody }),
  ctrl.update,
);
patientsRouter.delete('/:id', requireRole('admin'), validate({ params: idParams }), ctrl.remove);
