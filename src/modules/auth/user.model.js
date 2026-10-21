import mongoose from 'mongoose';

import { ROLES } from '../../constants/enums.js';
import { toJSONOptions } from '../../utils/mongoose-json.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'admin' },
    lastLoginAt: Date,
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export const User = mongoose.model('User', userSchema);
