import * as patients from '../patients/patients.service.js';
import * as service from './doctors.service.js';

// Read requests return the common success envelope and pagination metadata where applicable.
export const list = async (req, res) =>
  res.json({ success: true, ...(await service.listDoctors(req.valid.query)) });

export const getById = async (req, res) =>
  res.json({ success: true, data: await service.getDoctor(req.valid.params.id) });

// Validation and role checks run in the router before a mutation reaches this controller.
export const update = async (req, res) =>
  res.json({
    success: true,
    data: await service.updateDoctor(req.valid.params.id, req.valid.body),
  });

export async function create(req, res) {
  const doctor = await service.createDoctor(req.valid.body, req.user.id);
  // A Location header identifies the newly created resource for API consumers.
  res.status(201).location(`/api/v1/doctors/${doctor.id}`).json({ success: true, data: doctor });
}

export async function listPatients(req, res) {
  const { id } = req.valid.params;
  // Unknown doctors return 404, and the URL overrides any requested doctor filter.
  await service.assertDoctorExists(id);
  res.json({ success: true, ...(await patients.listPatients({ ...req.valid.query, doctor: id })) });
}

export async function addPatient(req, res) {
  // Take the required doctor from the validated URL instead of trusting the request body.
  await service.assertDoctorExists(req.valid.params.id);
  const patient = await patients.createPatient(
    { ...req.valid.body, doctor: req.valid.params.id },
    req.user.id,
  );
  res.status(201).location(`/api/v1/patients/${patient.id}`).json({ success: true, data: patient });
}

export async function removePatient(req, res) {
  // Scope the deletion to this doctor so another doctor's patient cannot be removed here.
  await patients.deletePatient(req.valid.params.patientId, { doctor: req.valid.params.id });
  res.status(204).end();
}
