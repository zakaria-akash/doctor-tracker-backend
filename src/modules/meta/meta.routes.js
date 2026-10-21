import { Router } from 'express';
import { CONDITIONS, GENDERS, SPECIALIZATIONS, STATUSES } from '../../constants/enums.js';
import { optionsCache } from '../../utils/cache.js';
import { Doctor } from '../doctors/doctor.model.js';

export const metaRouter = Router();

metaRouter.get('/options', async (_req, res) => {
  let data = optionsCache.get('options');

  if (!data) {
    const [hospitals, doctors] = await Promise.all([
      Doctor.distinct('hospital'),
      Doctor.find({}, { name: 1, specialization: 1 }).sort({ name: 1 }).lean(),
    ]);

    data = {
      specializations: SPECIALIZATIONS,
      conditions: CONDITIONS,
      statuses: STATUSES,
      genders: GENDERS,
      hospitals: hospitals.sort(),
      doctors: doctors.map((doctor) => ({
        id: String(doctor._id),
        name: doctor.name,
        specialization: doctor.specialization,
      })),
    };
    optionsCache.set('options', data);
  }

  res.json({ success: true, data });
});
