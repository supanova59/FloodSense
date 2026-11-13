const { Schema, model } = require("mongoose");
const schema = new Schema({
  tokenHash: { type: String, unique: true, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = model("Session", schema);
