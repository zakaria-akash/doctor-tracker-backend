export const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.searchTokens;
    delete ret.passwordHash;
    delete ret.createdBy;
    return ret;
  },
};
