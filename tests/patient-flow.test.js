import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { User } from '../src/modules/auth/user.model.js';

async function tokenFor(role) {
  const email = `${role}@flow.example`;
  await User.create({ name: role, email, role, passwordHash: await bcrypt.hash('Passw0rd!', 4) });
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'Passw0rd!' })
    .expect(200);
  return `Bearer ${response.body.data.token}`;
}

describe('patient and analytics workflow', () => {
  it('creates, searches, updates and removes patients with scoped permissions', async () => {
    const admin = await tokenFor('admin');
    const viewer = await tokenFor('viewer');
    const doctorResponse = await request(app)
      .post('/api/v1/doctors')
      .set('Authorization', admin)
      .send({
        name: 'Dr. Ayesha Rahman',
        specialization: 'Cardiology',
        hospital: 'Central Hospital',
        phone: '+880 1711-000000',
        email: 'ayesha@flow.example',
      })
      .expect(201);
    const doctorId = doctorResponse.body.data.id;

    const created = await request(app)
      .post(`/api/v1/doctors/${doctorId}/patients`)
      .set('Authorization', admin)
      .send({
        name: 'Rahim Uddin',
        age: 54,
        gender: 'male',
        condition: 'Hypertension',
        status: 'critical',
      })
      .expect(201);
    const patientId = created.body.data.id;
    const admissionDate = created.body.data.admissionDate;
    expect(created.body.data.doctor.id).toBe(doctorId);

    const listing = await request(app)
      .get('/api/v1/patients?search=rah&status=critical&page=1&limit=10')
      .set('Authorization', viewer)
      .expect(200);
    expect(listing.body.meta.total).toBe(1);
    expect(listing.body.data[0].id).toBe(patientId);

    const overview = await request(app)
      .get('/api/v1/analytics/overview?range=30d')
      .set('Authorization', viewer)
      .expect(200);
    expect(overview.body.data.totals).toMatchObject({ doctors: 1, patients: 1, critical: 1 });
    expect(overview.body.data.patientsPerDoctor[0].count).toBe(1);

    await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set('Authorization', viewer)
      .send({ age: 55 })
      .expect(403);

    const updated = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set('Authorization', admin)
      .send({ age: 55, status: 'stable' })
      .expect(200);
    expect(updated.body.data).toMatchObject({ age: 55, status: 'stable', admissionDate });
    await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set('Authorization', admin)
      .send({})
      .expect(422);

    const refreshed = await request(app)
      .get('/api/v1/analytics/overview?range=30d')
      .set('Authorization', viewer)
      .expect(200);
    expect(refreshed.body.data.totals.critical).toBe(0);

    await request(app)
      .delete(`/api/v1/doctors/${doctorId}/patients/${patientId}`)
      .set('Authorization', admin)
      .expect(204);
    const doctor = await request(app)
      .get(`/api/v1/doctors/${doctorId}`)
      .set('Authorization', viewer)
      .expect(200);
    expect(doctor.body.data.patientCount).toBe(0);
  });
});
