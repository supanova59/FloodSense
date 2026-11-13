const mongoose = require("mongoose");

const AreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g., "Bellandur"
    slug: { type: String, required: true, unique: true, lowercase: true }, // e.g., "bellandur"
    zone: { type: String, default: "BBMP Mahadevapura / East-South" },
    pincode: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    lakeProximity: { type: String, default: "Moderate" },
    overallRiskLevel: {
      type: String,
      enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
      default: "MODERATE",
    },
    emergencyHelpline: { type: String, default: "1533 (BBMP Control Room)" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Area", AreaSchema);
