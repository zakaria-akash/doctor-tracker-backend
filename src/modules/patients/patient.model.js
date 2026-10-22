import mongoose from 'mongoose';

import { CONDITIONS, GENDERS, STATUSES } from '../../constants/enums.js';
import { toJSONOptions } from '../../utils/mongoose-json.js';
import { buildSearchTokens } from '../../utils/search.js';

// Persist the clinical details, the required doctor relationship, and the audit owner.
const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    condition: { type: String, required: true, enum: CONDITIONS },
    status: { type: String, required: true, enum: STATUSES, default: 'stable' },
    admissionDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500 },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    searchTokens: { type: [String], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Search tokens cover the same fields used by the patient search box.
export const patientSearchTokens = (patient) =>
  buildSearchTokens(patient.name, patient.condition, patient.email, patient.phone);

// Saving through the API keeps the indexed tokens current after relevant edits.
patientSchema.pre('save', async function updateSearchTokens() {
  if (this.isNew || ['name', 'condition', 'email', 'phone'].some((path) => this.isModified(path))) {
    this.searchTokens = patientSearchTokens(this);
  }
});

// These indexes support doctor lists, admission sorting, common filters, and prefix search.
patientSchema.index({ doctor: 1, admissionDate: -1 });
patientSchema.index({ admissionDate: -1, _id: -1 });
patientSchema.index({ condition: 1, admissionDate: -1 });
patientSchema.index({ status: 1, admissionDate: -1 });
patientSchema.index({ searchTokens: 1 });

export const Patient = mongoose.model('Patient', patientSchema);
