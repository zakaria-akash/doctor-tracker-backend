import { env } from '../../config/env.js';
import { analyticsCache } from '../../utils/cache.js';
import { buildPeriodKeys, DAY_MS } from '../../utils/periods.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, '12m': 365, all: null };

export async function getOverview({ range }) {
  const cached = analyticsCache.get(range);
  if (cached) return cached;

  const now = new Date();
  const days = RANGES[range];
  const first = days
    ? null
    : await Patient.findOne({}, { admissionDate: 1 }).sort({ admissionDate: 1 }).lean();
  const start = days ? new Date(now.getTime() - days * DAY_MS) : (first?.admissionDate ?? now);
  const unit = days && days <= 31 ? 'day' : 'month';
  const format = unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const timezone = env.APP_TIMEZONE;
  const inRange = { admissionDate: { $gte: start, $lte: now } };
  const previous = days
    ? {
        admissionDate: {
          $gte: new Date(start.getTime() - days * DAY_MS),
          $lt: start,
        },
      }
    : null;

  const [
    doctors,
    patients,
    critical,
    newPatients,
    prevPatients,
    trend,
    perDoctor,
    byCondition,
    byStatus,
    bySpecialization,
  ] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Patient.countDocuments({ status: 'critical' }),
    Patient.countDocuments(inRange),
    previous ? Patient.countDocuments(previous) : null,
    Patient.aggregate([
      { $match: inRange },
      {
        $group: {
          _id: { $dateToString: { date: '$admissionDate', format, timezone } },
          count: { $sum: 1 },
        },
      },
    ]),
    Patient.aggregate([
      { $match: inRange },
      { $group: { _id: '$doctor', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
          pipeline: [{ $project: { name: 1, specialization: 1 } }],
        },
      },
      { $unwind: '$doctor' },
      {
        $project: {
          _id: 0,
          doctorId: { $toString: '$_id' },
          name: '$doctor.name',
          specialization: '$doctor.specialization',
          count: 1,
        },
      },
    ]),
    Patient.aggregate([
      { $match: inRange },
      { $group: { _id: '$condition', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, condition: '$_id', count: 1 } },
    ]),
    Patient.aggregate([
      { $match: inRange },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, specialization: '$_id', count: 1 } },
    ]),
  ]);

  const counts = new Map(trend.map((row) => [row._id, row.count]));
  const result = {
    range: { key: range, from: start.toISOString(), to: now.toISOString(), unit },
    totals: {
      doctors,
      patients,
      critical,
      newPatients,
      newPatientsChangePct: prevPatients
        ? Math.round(((newPatients - prevPatients) / prevPatients) * 1000) / 10
        : null,
      avgPatientsPerDoctor: doctors ? Math.round((patients / doctors) * 10) / 10 : 0,
    },
    patientsOverTime: buildPeriodKeys(start, now, unit, timezone).map((period) => ({
      period,
      count: counts.get(period) ?? 0,
    })),
    patientsPerDoctor: perDoctor,
    byCondition,
    byStatus,
    doctorsBySpecialization: bySpecialization,
  };

  analyticsCache.set(range, result);
  return result;
}
