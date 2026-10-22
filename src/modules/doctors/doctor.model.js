import mongoose from 'mongoose';

import { SPECIALIZATIONS } from '../../constants/enums.js';
import { toJSONOptions } from '../../utils/mongoose-json.js';
import { buildSearchTokens } from '../../utils/search.js';

// Store a normalized doctor profile, audit its creator, and keep search tokens private.
const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    searchTokens: { type: [String], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Share token generation with the seed script, which inserts without save hooks.
export const doctorSearchTokens = (doctor) =>
  buildSearchTokens(doctor.name, doctor.specialization, doctor.hospital, doctor.email);

// Rebuild the indexed prefixes only when searchable fields have actually changed.
doctorSchema.pre('save', async function updateSearchTokens() {
  if (
    this.isNew ||
    ['name', 'specialization', 'hospital', 'email'].some((path) => this.isModified(path))
  ) {
    this.searchTokens = doctorSearchTokens(this);
  }
});

// Support the common list filters, stable sorts, and indexed prefix searches.
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ name: 1, _id: 1 });
doctorSchema.index({ searchTokens: 1 });

export const Doctor = mongoose.model('Doctor', doctorSchema);
