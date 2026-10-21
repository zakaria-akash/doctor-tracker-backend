import * as service from './patients.service.js';

export const list = async (req, res) =>
  res.json({ success: true, ...(await service.listPatients(req.valid.query)) });

export const getById = async (req, res) =>
  res.json({ success: true, data: await service.getPatient(req.valid.params.id) });

export const update = async (req, res) =>
  res.json({
    success: true,
    data: await service.updatePatient(req.valid.params.id, req.valid.body),
  });

export async function remove(req, res) {
  await service.deletePatient(req.valid.params.id);
  res.status(204).end();
}
