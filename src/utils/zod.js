import { z } from 'zod';

// Treat empty optional controls as omitted values, including explicitly cleared patient fields.
export const emptyToUndefined = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema);

// Validate IDs and dates at the API boundary before they reach MongoDB queries.
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });
export const optionalDate = emptyToUndefined(z.coerce.date().optional());
// Preserve international phone formatting while rejecting unsupported characters and lengths.
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,20}$/, 'Enter a valid phone number');

// Zod 4: trim/lowercase before the email check.
export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

// Cap list sizes to keep doctor and patient queries predictable.
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};
