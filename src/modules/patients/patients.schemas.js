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

// Accept numbers and numeric strings, including 0, but reject blank, boolean, and array values.
const age = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number().int().min(0).max(120));

// Query ages are optional, but supplied bounds use the same safe whole-number validation.
const optionalAge = emptyToUndefined(age.optional());

// Validate and normalize every supported filter before it reaches the query builder.
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

// Require a supplied date rather than allowing null or boolean to coerce to the Unix epoch.
const requiredAdmissionDate = z.preprocess(
  (value) =>
    value instanceof Date ||
    (typeof value === 'string' && value.trim() !== '') ||
    (typeof value === 'number' && Number.isFinite(value))
      ? value
      : undefined,
  z.coerce.date().refine((date) => date <= new Date(), 'Admission date cannot be in the future'),
);

// Keep this base defaults-free: Zod 4 retains defaults when `.partial()` is used.
const patientFields = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  age,
  gender: z.enum(GENDERS),
  phone: emptyToUndefined(phone.optional()),
  email: emptyToUndefined(email.optional()),
  condition: z.enum(CONDITIONS),
  status: z.enum(STATUSES),
  admissionDate: requiredAdmissionDate,
  notes: emptyToUndefined(z.string().trim().max(500).optional()),
  doctor: objectId,
});

// Apply defaults only during creation so unrelated PATCH requests preserve existing values.
export const createPatientBody = patientFields.extend({
  status: patientFields.shape.status.default('stable'),
  admissionDate: patientFields.shape.admissionDate.default(() => new Date()),
});

// Nested creation obtains the doctor from the URL rather than trusting the request body.
export const createDoctorPatientBody = createPatientBody.omit({ doctor: true });

// A partial edit must change at least one recognized field, including explicitly cleared fields.
export const updatePatientBody = patientFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update',
  });
