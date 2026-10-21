import { Router } from 'express';

import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/zod.js';
import { createDoctorPatientBody, listPatientsQuery } from '../patients/patients.schemas.js';
import {
  createDoctorBody,
  doctorPatientParams,
  listDoctorsQuery,
  updateDoctorBody,
} from './doctors.schemas.js';
import * as ctrl from './doctors.controller.js';

const adminOnly = requireRole('admin');

export const doctorsRouter = Router();

doctorsRouter.get('/', validate({ query: listDoctorsQuery }), ctrl.list);
doctorsRouter.post('/', adminOnly, validate({ body: createDoctorBody }), ctrl.create);
doctorsRouter.get('/:id', validate({ params: idParams }), ctrl.getById);
doctorsRouter.patch(
  '/:id',
  adminOnly,
  validate({ params: idParams, body: updateDoctorBody }),
  ctrl.update,
);
doctorsRouter.get(
  '/:id/patients',
  validate({ params: idParams, query: listPatientsQuery }),
  ctrl.listPatients,
);
doctorsRouter.post(
  '/:id/patients',
  adminOnly,
  validate({ params: idParams, body: createDoctorPatientBody }),
  ctrl.addPatient,
);
doctorsRouter.delete(
  '/:id/patients/:patientId',
  adminOnly,
  validate({ params: doctorPatientParams }),
  ctrl.removePatient,
);
