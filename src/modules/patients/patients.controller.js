import * as service from './patients.service.js';

// Return the paginated list and its metadata using the standard success envelope.
export const list = async (req, res) =>
  res.json({ success: true, ...(await service.listPatients(req.valid.query)) });

// Return the requested patient with the associated doctor summary.
export const getById = async (req, res) =>
  res.json({ success: true, data: await service.getPatient(req.valid.params.id) });

// Pass only validated, explicitly submitted fields to the partial update service.
export const update = async (req, res) =>
  res.json({
    success: true,
    data: await service.updatePatient(req.valid.params.id, req.valid.body),
  });

// A successful deletion returns no response body as required by HTTP 204.
export async function remove(req, res) {
  await service.deletePatient(req.valid.params.id);
  res.status(204).end();
}
