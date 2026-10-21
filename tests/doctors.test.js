import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/modules/auth/user.model.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';

async function tokenFor(role) {
  const email = `${role}@example.com`;
  await User.create({
    name: role,
    email,
    role,
    passwordHash: await bcrypt.hash('Passw0rd!', 4),
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'Passw0rd!' })
    .expect(200);

  return res.body.data.token;
}

const doctor = {
  name: 'Dr. Test Person',
  specialization: 'Cardiology',
  hospital: 'Test Hospital',
  phone: '+880 1711-000000',
  email: 'test.person@example.com',
};

describe('Doctors API', () => {
  beforeEach(() => Doctor.init());

  it('rejects anonymous requests', async () => {
    await request(app).get('/api/v1/doctors').expect(401);
  });

  it('lets an admin create and then search a doctor', async () => {
    const auth = { Authorization: `Bearer ${await tokenFor('admin')}` };
    await request(app).post('/api/v1/doctors').set(auth).send(doctor).expect(201);

    const res = await request(app).get('/api/v1/doctors?search=card').set(auth).expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ name: doctor.name, patientCount: 0 });
    expect(res.body.data[0]).not.toHaveProperty('searchTokens');
  });

  it('returns 409 for a duplicate email', async () => {
    const auth = { Authorization: `Bearer ${await tokenFor('admin')}` };
    await request(app).post('/api/v1/doctors').set(auth).send(doctor).expect(201);

    const res = await request(app).post('/api/v1/doctors').set(auth).send(doctor).expect(409);
    expect(res.body.error.details.fieldErrors.email).toBeDefined();
  });

  it('forbids viewers from creating doctors', async () => {
    const auth = { Authorization: `Bearer ${await tokenFor('viewer')}` };
    await request(app).post('/api/v1/doctors').set(auth).send(doctor).expect(403);
  });
});
