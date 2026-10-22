import { env } from '../../config/env.js';
import { analyticsCache } from '../../utils/cache.js';
import { buildPeriodKeys, DAY_MS } from '../../utils/periods.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';

// Keep dashboard ranges finite and explicit so clients cannot trigger unbounded custom queries.
export const RANGES = Object.freeze({ '7d': 7, '30d': 30, '90d': 90, '12m': 365, all: null });

export async function getOverview({ range }) {
  // Return the last completed response for this preset while its short TTL is active.
  const cached = analyticsCache.get(range);
  if (cached) return cached;

  // Use one stable cutoff for every aggregate in this response to avoid boundary disagreement.
  const now = new Date();
  const days = RANGES[range];
  // The all-time view begins at the earliest recorded admission, or at this request if empty.
  const first = days
    ? null
    : await Patient.findOne({}, { admissionDate: 1 }).sort({ admissionDate: 1 }).lean();
  const start = days ? new Date(now.getTime() - days * DAY_MS) : (first?.admissionDate ?? now);
  const unit = days && days <= 31 ? 'day' : 'month';
  const format = unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const timezone = env.APP_TIMEZONE;
  const inRange = { admissionDate: { $gte: start, $lte: now } };
  // Compare the selected interval with the immediately preceding interval of equal duration.
  const previous = days
    ? {
        admissionDate: {
          $gte: new Date(start.getTime() - days * DAY_MS),
          $lt: start,
        },
      }
    : null;

  // Run independent counts and indexed aggregations concurrently to keep dashboard latency low.
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
    // Collection estimates serve all-time totals; filtered dashboard values use indexed fields.
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    // Critical is a clinic-wide KPI, matching the unfiltered critical-patient list total.
    Patient.countDocuments({ status: 'critical' }),
    // Count the current interval and its prior counterpart for the headline growth percentage.
    Patient.countDocuments(inRange),
    previous ? Patient.countDocuments(previous) : null,
    // Group admissions by the clinic-local day or month chosen above.
    Patient.aggregate([
      { $match: inRange },
      {
        $group: {
          _id: { $dateToString: { date: '$admissionDate', format, timezone } },
          count: { $sum: 1 },
        },
      },
    ]),
    // Count the top doctors before joining names so the lookup only processes ten rows.
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
    // The condition and status charts summarize patients admitted during the selected interval.
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
    // Specialization is a clinic-wide distribution and therefore has no admission-date filter.
    Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, specialization: '$_id', count: 1 } },
    ]),
  ]);

  // Reindex returned groups by period so absent dates can be emitted with a zero count.
  const counts = new Map(trend.map((row) => [row._id, row.count]));
  // Keep the response shape stable for all dashboard widgets and empty databases.
  const result = {
    range: { key: range, from: start.toISOString(), to: now.toISOString(), unit },
    totals: {
      doctors,
      patients,
      critical,
      newPatients,
      // A zero previous count has no meaningful percentage baseline, so report null.
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

  // Mutating API services clear this shared cache after writes; expiry is a second freshness bound.
  analyticsCache.set(range, result);
  return result;
}
