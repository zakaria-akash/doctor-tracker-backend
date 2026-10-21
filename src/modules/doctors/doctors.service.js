import { ApiError } from '../../utils/api-error.js';
import { invalidateReadCaches } from '../../utils/cache.js';
import { buildDateRange } from '../../utils/date-range.js';
import { pageMeta, skipFor } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { serialize } from '../../utils/serialize.js';
import { Patient } from '../patients/patient.model.js';
import { Doctor } from './doctor.model.js';

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

const FIELDS = 'name specialization hospital phone email createdAt updatedAt';

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

  const [docs, total] = await Promise.all([
    Doctor.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .select(FIELDS)
      .lean(),
    Doctor.countDocuments(filter),
  ]);

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
  const doctor = await Doctor.findById(id).select(FIELDS).lean();
  if (!doctor) throw ApiError.notFound('Doctor');

  return {
    ...serialize(doctor),
    patientCount: await Patient.countDocuments({ doctor: doctor._id }),
  };
}

export async function assertDoctorExists(id) {
  if (!(await Doctor.exists({ _id: id }))) throw ApiError.notFound('Doctor');
}

export async function createDoctor(input, userId) {
  const doctor = await Doctor.create({ ...input, createdBy: userId });
  invalidateReadCaches();
  return { ...doctor.toJSON(), patientCount: 0 };
}

export async function updateDoctor(id, changes) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor');

  doctor.set(changes);
  await doctor.save();
  invalidateReadCaches();
  return doctor.toJSON();
}
