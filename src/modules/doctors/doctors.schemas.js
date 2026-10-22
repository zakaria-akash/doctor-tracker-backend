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
import { listPatientsQuery } from '../patients/patients.schemas.js';

// The API exposes these stable sort keys rather than accepting MongoDB sort fields.
export const DOCTOR_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc'];

// Parse and bound the list filters before they reach the database.
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

// A doctor's required contact details are normalized by the shared phone/email schemas.
export const createDoctorBody = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  specialization: z.enum(SPECIALIZATIONS),
  hospital: z.string().trim().min(2).max(120),
  phone,
  email,
});

// Keep the create schema free of defaults so a partial update changes only supplied fields.
export const updateDoctorBody = createDoctorBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update',
  });

// Both identifiers are validated before a nested delete reaches its scoped database query.
export const doctorPatientParams = z.object({ id: objectId, patientId: objectId });

// The URL owns the doctor scope; ignore even a malformed doctor query value on this route.
export const listDoctorPatientsQuery = z.preprocess(
  (query) =>
    query && typeof query === 'object' && !Array.isArray(query)
      ? { ...query, doctor: undefined }
      : query,
  listPatientsQuery,
);
