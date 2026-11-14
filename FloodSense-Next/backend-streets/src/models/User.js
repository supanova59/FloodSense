const { Schema, model } = require("mongoose");
module.exports = model(
  "User",
  new Schema(
    {
      name: { type: String, required: true, maxlength: 80 },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["resident", "admin"], default: "resident" },
    },
    { timestamps: true },
  ),
);
