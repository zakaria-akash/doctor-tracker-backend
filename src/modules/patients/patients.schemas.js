import { z } from 'zod';

import { CONDITIONS, GENDERS, STATUSES } from '../../constants/enums.js';
import {
  email,
  emptyToUndefined,
  objectId,
  optionalDate,
  pagination,
  phone,
} from '../../utils/zod.js';

export const PATIENT_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc', 'age_asc', 'age_desc'];

const optionalAge = emptyToUndefined(z.coerce.number().int().min(0).max(120).optional());

export const listPatientsQuery = z
  .object({
    ...pagination,
    search: emptyToUndefined(z.string().trim().max(100).optional()),
    condition: emptyToUndefined(z.enum(CONDITIONS).optional()),
    status: emptyToUndefined(z.enum(STATUSES).optional()),
    gender: emptyToUndefined(z.enum(GENDERS).optional()),
    doctor: emptyToUndefined(objectId.optional()),
    minAge: optionalAge,
    maxAge: optionalAge,
    from: optionalDate,
    to: optionalDate,
    sort: emptyToUndefined(z.enum(PATIENT_SORTS).default('newest')),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: '`from` must be on or before `to`',
    path: ['from'],
  })
  .refine((query) => query.minAge == null || query.maxAge == null || query.minAge <= query.maxAge, {
    error: '`minAge` must not exceed `maxAge`',
    path: ['minAge'],
  });

// Keep this base defaults-free: Zod 4 retains defaults when `.partial()` is used.
const patientFields = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  age: z.coerce.number().int().min(0).max(120),
  gender: z.enum(GENDERS),
  phone: emptyToUndefined(phone.optional()),
  email: emptyToUndefined(email.optional()),
  condition: z.enum(CONDITIONS),
  status: z.enum(STATUSES),
  admissionDate: z.coerce
    .date()
    .refine((date) => date <= new Date(), 'Admission date cannot be in the future'),
  notes: emptyToUndefined(z.string().trim().max(500).optional()),
  doctor: objectId,
});

export const createPatientBody = patientFields.extend({
  status: patientFields.shape.status.default('stable'),
  admissionDate: patientFields.shape.admissionDate.default(() => new Date()),
});

export const createDoctorPatientBody = createPatientBody.omit({ doctor: true });

export const updatePatientBody = patientFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update',
  });
