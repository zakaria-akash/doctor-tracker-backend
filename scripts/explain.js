// Run manually against a seeded database to compare the real query plans with declared indexes.
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { buildSearchFilter } from '../src/utils/search.js';

// Use the same environment file and connection setup as the API process.
await connectDB();

// Cover the main indexed access patterns documented for doctors and patients.
const cases = {
  'Doctors · search "card"': Doctor.find(buildSearchFilter('card'))
    .sort({ createdAt: -1, _id: -1 })
    .limit(10),
  'Doctors · specialization': Doctor.find({ specialization: 'Cardiology' })
    .sort({ createdAt: -1 })
    .limit(10),
  'Patients · critical': Patient.find({ status: 'critical' }).sort({ admissionDate: -1 }).limit(10),
};

try {
  // Run the server-side explain without loading result documents into the application process.
  const rows = [];
  for (const [name, query] of Object.entries(cases)) {
    const plan = await query.explain('executionStats');
    const stats = plan.executionStats;
    // Report only the plan-stage families useful for a quick index-vs-collection-scan review.
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

  // Keep this output compact enough to capture for the project README or review evidence.
  console.table(rows);
} finally {
  // Close the connection even when MongoDB rejects an explain command or a query is misconfigured.
  await mongoose.disconnect();
}
