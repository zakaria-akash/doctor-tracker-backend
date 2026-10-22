import { ApiError } from '../../utils/api-error.js';
import { invalidateReadCaches } from '../../utils/cache.js';
import { buildDateRange } from '../../utils/date-range.js';
import { pageMeta, skipFor } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { serialize } from '../../utils/serialize.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from './patient.model.js';

// Include the id in every sort so pagination remains stable when values are equal.
const SORTS = {
  newest: { admissionDate: -1, _id: -1 },
  oldest: { admissionDate: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
  age_asc: { age: 1, _id: 1 },
  age_desc: { age: -1, _id: -1 },
};

// Return only frontend-facing patient data and a small populated doctor summary.
const FIELDS =
  'name age gender phone email condition status admissionDate notes doctor createdAt updatedAt';
const DOCTOR_FIELDS = 'name specialization';

// Combine independent filters into one MongoDB query; age 0 is a valid bound.
function buildPatientFilter({
  search,
  condition,
  status,
  gender,
  doctor,
  minAge,
  maxAge,
  from,
  to,
}) {
  return {
    ...buildSearchFilter(search),
    ...(condition && { condition }),
    ...(status && { status }),
    ...(gender && { gender }),
    ...(doctor && { doctor }),
    ...((minAge != null || maxAge != null) && {
      age: {
        ...(minAge != null && { $gte: minAge }),
        ...(maxAge != null && { $lte: maxAge }),
      },
    }),
    ...buildDateRange('admissionDate', from, to),
  };
}

// Fetch one page and its total concurrently so list and pagination use the same filters.
export async function listPatients(query) {
  const { page, limit, sort } = query;
  const filter = buildPatientFilter(query);

  const [docs, total] = await Promise.all([
    Patient.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .select(FIELDS)
      .populate('doctor', DOCTOR_FIELDS)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  return { data: docs.map(serialize), meta: pageMeta(page, limit, total) };
}

// Detail requests use the same projection and populated doctor shape as list items.
export async function getPatient(id) {
  const patient = await Patient.findById(id)
    .select(FIELDS)
    .populate('doctor', DOCTOR_FIELDS)
    .lean();

  if (!patient) throw ApiError.notFound('Patient');
  return serialize(patient);
}

// Return a field-level error when a new assignment references an unknown doctor.
async function assertDoctor(doctorId) {
  if (!(await Doctor.exists({ _id: doctorId }))) {
    throw ApiError.badRequest('Selected doctor does not exist', {
      formErrors: [],
      fieldErrors: { doctor: ['Doctor not found'] },
    });
  }
}

// Record the creator and clear cached analytics after a successful creation.
export async function createPatient(input, userId) {
  await assertDoctor(input.doctor);
  const patient = await Patient.create({ ...input, createdBy: userId });
  invalidateReadCaches();
  return getPatient(patient.id);
}

// Validate reassignment, then save only submitted changes so search hooks also run.
export async function updatePatient(id, changes) {
  const patient = await Patient.findById(id);
  if (!patient) throw ApiError.notFound('Patient');

  if (changes.doctor) await assertDoctor(changes.doctor);
  patient.set(changes);
  await patient.save();
  invalidateReadCaches();
  return getPatient(id);
}

// The optional doctor scope prevents a nested route deleting another doctor's patient.
export async function deletePatient(id, scope = {}) {
  const deleted = await Patient.findOneAndDelete({ _id: id, ...scope });
  if (!deleted) throw ApiError.notFound('Patient');
  invalidateReadCaches();
}
