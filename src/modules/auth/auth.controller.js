import * as service from './auth.service.js';

// Express 5 forwards asynchronous errors to the shared error handler.
export const login = async (req, res) =>
  res.json({ success: true, data: await service.login(req.valid.body) });

export const me = async (req, res) =>
  res.json({ success: true, data: await service.getMe(req.user.id) });
