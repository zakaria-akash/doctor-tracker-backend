import { z } from 'zod';

import { SPECIALIZATIONS } from '../../constants/enums.js';
import {
  email,
  emptyToUndefined,
  objectId,
  optionalDate,
  pagination,
  phone,
} from '../../utils/zod.js';

export const DOCTOR_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc'];

export const listDoctorsQuery = z
  .object({
    ...pagination,
    search: emptyToUndefined(z.string().trim().max(100).optional()),
    specialization: emptyToUndefined(z.enum(SPECIALIZATIONS).optional()),
    hospital: emptyToUndefined(z.string().trim().max(120).optional()),
    from: optionalDate,
    to: optionalDate,
    sort: emptyToUndefined(z.enum(DOCTOR_SORTS).default('newest')),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: '`from` must be on or before `to`',
    path: ['from'],
  });

export const createDoctorBody = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  specialization: z.enum(SPECIALIZATIONS),
  hospital: z.string().trim().min(2).max(120),
  phone,
  email,
});

export const updateDoctorBody = createDoctorBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update',
  });

export const doctorPatientParams = z.object({ id: objectId, patientId: objectId });
