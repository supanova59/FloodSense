const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    areaSlug: { type: String, required: true, index: true }, // Strictly isolates reports to selected area
    streetId: { type: mongoose.Schema.Types.ObjectId, ref: "Street", default: null },
    streetName: { type: String, required: true },
    landmark: { type: String, default: "" },
    reportType: {
      type: String,
      enum: ["FLOODING", "POTHOLE", "DRAIN_BLOCKAGE", "TRAFFIC_STUCK"],
      required: true
    },
    severity: {
      type: String,
      enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
      default: "MODERATE"
    },
    reportedWaterDepthCm: { type: Number, default: 0 },
    aiEstimatedPotholeDepthCm: { type: Number, default: 0 },
    aiEstimatedFloodTimeMins: { type: Number, default: null },
    description: { type: String, required: true },
    reportedBy: { type: String, default: "Commuter" },
    upvotes: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);
