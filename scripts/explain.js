import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { buildSearchFilter } from '../src/utils/search.js';

await connectDB();

const cases = {
  'Doctors · search "card"': Doctor.find(buildSearchFilter('card'))
    .sort({ createdAt: -1, _id: -1 })
    .limit(10),
  'Doctors · specialization': Doctor.find({ specialization: 'Cardiology' })
    .sort({ createdAt: -1 })
    .limit(10),
  'Patients · critical': Patient.find({ status: 'critical' }).sort({ admissionDate: -1 }).limit(10),
};

const rows = [];
for (const [name, query] of Object.entries(cases)) {
  const plan = await query.explain('executionStats');
  const stats = plan.executionStats;
  const stages = [
    ...new Set(
      JSON.stringify(plan.queryPlanner.winningPlan).match(/IXSCAN|COLLSCAN|SORT(?!_)/g) ?? [],
    ),
  ];

  rows.push({
    query: name,
    stages: stages.join('+'),
    returned: stats.nReturned,
    keysExamined: stats.totalKeysExamined,
    docsExamined: stats.totalDocsExamined,
    ms: stats.executionTimeMillis,
  });
}

console.table(rows);
await mongoose.disconnect();
