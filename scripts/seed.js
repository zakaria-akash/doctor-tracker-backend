// npm run seed            → seeds a *_dev / *_test database
// npm run seed -- --force → required for any other DB name (e.g. production)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

import { CONDITIONS, SPECIALIZATIONS } from '../src/constants/enums.js';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/auth/user.model.js';
import { Doctor, doctorSearchTokens } from '../src/modules/doctors/doctor.model.js';
import { Patient, patientSearchTokens } from '../src/modules/patients/patient.model.js';

const DAY = 86_400_000;
const DOCTOR_COUNT = 48;
const PATIENT_COUNT = 1_500;
// Keep generated portrait paths stable so the frontend can serve these WebP files locally.
const DOCTOR_PHOTO_COUNT = 8;
const HOSPITALS = [
  'Green Valley General Hospital',
  'CityCare Medical Center',
  'Riverside Heart Institute',
  "Sunrise Children's Hospital",
  'Metro Neuro & Spine Center',
  "Lakeside Women's Clinic",
  'Northgate Diagnostic Hospital',
  'Harbor View Medical College',
];
const NOTES = [
  'Follow-up in two weeks',
  'BP monitoring twice daily',
  'Responding well to medication',
  'Awaiting lab results',
  'Diet and exercise counselling given',
  'Referred for imaging',
];

faker.seed(2026); // Same data on every run → stable screenshots.

const conn = await connectDB();
if (!/_(dev|test)$/.test(conn.name) && !process.argv.includes('--force')) {
  console.error(`Refusing to wipe "${conn.name}" without --force`);
  process.exit(1);
}

console.log(`🌱 Seeding "${conn.name}"…`);

await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Patient.deleteMany({})]);
await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);

// 1) Demo users (documented in both READMEs).
const [admin] = await User.insertMany([
  {
    name: 'Demo Admin',
    email: 'admin@doctortracker.test',
    role: 'admin',
    passwordHash: await bcrypt.hash('Admin@12345', env.BCRYPT_ROUNDS),
  },
  {
    name: 'Demo Viewer',
    email: 'viewer@doctortracker.test',
    role: 'viewer',
    passwordHash: await bcrypt.hash('Viewer@12345', env.BCRYPT_ROUNDS),
  },
]);

// 2) Doctors — joined 1–18 months ago. insertMany preserves supplied createdAt.
const now = Date.now();
const doctors = await Doctor.insertMany(
  Array.from({ length: DOCTOR_COUNT }, (_, index) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const doc = {
      name: `Dr. ${firstName} ${lastName}`,
      specialization: SPECIALIZATIONS[index % SPECIALIZATIONS.length],
      hospital: faker.helpers.arrayElement(HOSPITALS),
      phone: faker.phone.number({ style: 'international' }),
      email:
        `${firstName}.${lastName}.${index}`.toLowerCase().replace(/[^a-z0-9.]/g, '') +
        '@doctortracker.test',
      photoUrl: `/images/doctors/doctor-${String((index % DOCTOR_PHOTO_COUNT) + 1).padStart(2, '0')}.webp`,
      createdBy: admin._id,
      createdAt: new Date(now - faker.number.int({ min: 30, max: 540 }) * DAY),
    };

    // insertMany skips pre('save') hooks.
    return { ...doc, searchTokens: doctorSearchTokens(doc) };
  }),
);

// 3) Patients — weighted so the dashboard has a story.
const doctorWeights = doctors.map((value, index) => ({
  value,
  weight: 1 + (index % 7) * 2,
}));
const conditionWeights = CONDITIONS.map((value, index) => ({
  value,
  weight: [18, 16, 9, 10, 7, 6, 5, 6, 7, 6, 4, 8, 3][index],
}));
const statusWeights = [
  { value: 'stable', weight: 50 },
  { value: 'under_observation', weight: 25 },
  { value: 'critical', weight: 8 },
  { value: 'recovered', weight: 17 },
];
const genderWeights = [
  { value: 'male', weight: 48 },
  { value: 'female', weight: 48 },
  { value: 'other', weight: 4 },
];

const patients = Array.from({ length: PATIENT_COUNT }, () => {
  const doctor = faker.helpers.weightedArrayElement(doctorWeights);
  const gender = faker.helpers.weightedArrayElement(genderWeights);
  const firstName = faker.person.firstName(gender === 'other' ? undefined : gender);
  const lastName = faker.person.lastName();
  const joined = doctor.createdAt.getTime();
  // Square-root bias gives more recent admissions without predating the doctor.
  const admissionDate = new Date(
    joined + Math.sqrt(faker.number.float({ min: 0, max: 1 })) * (now - joined),
  );
  const doc = {
    name: `${firstName} ${lastName}`,
    age: faker.number.int({ min: 1, max: 90 }),
    gender,
    phone: faker.phone.number({ style: 'international' }),
    email: faker.datatype.boolean({ probability: 0.7 })
      ? faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase()
      : undefined,
    condition: faker.helpers.weightedArrayElement(conditionWeights),
    status: faker.helpers.weightedArrayElement(statusWeights),
    admissionDate,
    notes: faker.datatype.boolean({ probability: 0.4 })
      ? faker.helpers.arrayElement(NOTES)
      : undefined,
    doctor: doctor._id,
    createdBy: admin._id,
    createdAt: admissionDate,
  };

  return { ...doc, searchTokens: patientSearchTokens(doc) };
});

for (let index = 0; index < patients.length; index += 500) {
  await Patient.insertMany(patients.slice(index, index + 500));
}

console.log(`✅ ${doctors.length} doctors · ${patients.length} patients · 2 users`);
console.log('🔑 admin@doctortracker.test / Admin@12345 · viewer@doctortracker.test / Viewer@12345');
await mongoose.disconnect();
