import * as patients from '../patients/patients.service.js';
import * as service from './doctors.service.js';

export const list = async (req, res) =>
  res.json({ success: true, ...(await service.listDoctors(req.valid.query)) });

export const getById = async (req, res) =>
  res.json({ success: true, data: await service.getDoctor(req.valid.params.id) });

export const update = async (req, res) =>
  res.json({
    success: true,
    data: await service.updateDoctor(req.valid.params.id, req.valid.body),
  });

export async function create(req, res) {
  const doctor = await service.createDoctor(req.valid.body, req.user.id);
  res.status(201).location(`/api/v1/doctors/${doctor.id}`).json({ success: true, data: doctor });
}

export async function listPatients(req, res) {
  const { id } = req.valid.params;
  await service.assertDoctorExists(id);
  res.json({ success: true, ...(await patients.listPatients({ ...req.valid.query, doctor: id })) });
}

export async function addPatient(req, res) {
  await service.assertDoctorExists(req.valid.params.id);
  const patient = await patients.createPatient(
    { ...req.valid.body, doctor: req.valid.params.id },
    req.user.id,
  );
  res.status(201).location(`/api/v1/patients/${patient.id}`).json({ success: true, data: patient });
}

export async function removePatient(req, res) {
  await patients.deletePatient(req.valid.params.patientId, { doctor: req.valid.params.id });
  res.status(204).end();
}
