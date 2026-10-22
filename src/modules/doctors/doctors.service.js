import { ApiError } from '../../utils/api-error.js';
import { invalidateReadCaches } from '../../utils/cache.js';
import { buildDateRange } from '../../utils/date-range.js';
import { pageMeta, skipFor } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { serialize } from '../../utils/serialize.js';
import { Patient } from '../patients/patient.model.js';
import { Doctor } from './doctor.model.js';

// Include an id tie-breaker so pagination remains stable when sort values are equal.
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

// Explicit projection excludes internal search tokens and the creator from API responses.
const FIELDS = 'name specialization hospital phone email photoUrl createdAt updatedAt';

// Build one filter for both the page query and its matching total count.
export async function listDoctors({
  page,
  limit,
  search,
  specialization,
  hospital,
  from,
  to,
  sort,
}) {
  const filter = {
    ...buildSearchFilter(search),
    ...(specialization && { specialization }),
    ...(hospital && { hospital }),
    ...buildDateRange('createdAt', from, to),
  };

  // Fetch page data and total concurrently; lean documents avoid unnecessary model instances.
  const [docs, total] = await Promise.all([
    Doctor.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .select(FIELDS)
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  // Count patients in one indexed aggregation rather than issuing a query per doctor.
  const counts = await countPatientsByDoctor(docs.map((doctor) => doctor._id));

  return {
    data: docs.map((doctor) => ({
      ...serialize(doctor),
      patientCount: counts.get(String(doctor._id)) ?? 0,
    })),
    meta: pageMeta(page, limit, total),
  };
}

/** One indexed aggregation for all doctors on the current page. */
async function countPatientsByDoctor(ids) {
  if (!ids.length) return new Map();

  const rows = await Patient.aggregate([
    { $match: { doctor: { $in: ids } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function getDoctor(id) {
  // Return a clear 404 for a valid but unknown doctor and include the current patient count.
  const doctor = await Doctor.findById(id).select(FIELDS).lean();
  if (!doctor) throw ApiError.notFound('Doctor');

  return {
    ...serialize(doctor),
    patientCount: await Patient.countDocuments({ doctor: doctor._id }),
  };
}

export async function assertDoctorExists(id) {
  // Nested routes distinguish a missing doctor from an empty patient list.
  if (!(await Doctor.exists({ _id: id }))) throw ApiError.notFound('Doctor');
}

export async function createDoctor(input, userId) {
  // Saving runs model validation/search-token hooks; refresh derived metadata afterward.
  const doctor = await Doctor.create({ ...input, createdBy: userId });
  invalidateReadCaches();
  return { ...doctor.toJSON(), patientCount: 0 };
}

export async function updateDoctor(id, changes) {
  // Save the document rather than using a direct update so search-token hooks are applied.
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor');

  doctor.set(changes);
  await doctor.save();
  // Doctor options and analytics must reflect the changed profile.
  invalidateReadCaches();
  return doctor.toJSON();
}
