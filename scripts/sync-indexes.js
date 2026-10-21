import mongoose from 'mongoose';

import { connectDB } from '../src/config/db.js';
import { User } from '../src/modules/auth/user.model.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';

await connectDB();

for (const model of [User, Doctor, Patient]) {
  const dropped = await model.syncIndexes();
  const names = (await model.listIndexes()).map((index) => index.name);
  const droppedNote = dropped.length ? `  (dropped: ${dropped.join(', ')})` : '';
  console.log(`📇 ${model.modelName}: ${names.join(', ')}${droppedNote}`);
}

await mongoose.disconnect();
