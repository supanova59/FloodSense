const mongoose = require("mongoose");

const PotholeSchema = new mongoose.Schema({
  landmark: { type: String, required: true },
  estimatedDepthCm: { type: Number, required: true }, // AI approximated depth in cm
  widthCm: { type: Number, default: 65 },
  submerged: { type: Boolean, default: false },
  dangerRating: {
    type: String,
    enum: ["MINOR", "MODERATE", "SEVERE", "AXLE_BREAKER"],
    default: "MODERATE"
  },
  confidenceScore: { type: Number, default: 0.88 } // AI vision/sensor confidence
});

const StreetSchema = new mongoose.Schema(
  {
    areaSlug: { type: String, required: true, index: true },
    name: { type: String, required: true }, // e.g., "Ecospace Service Road (ORR)"
    landmarkPlace: { type: String, required: true }, // e.g., "Near Intel / Ecospace Gate 2"
    streetType: {
      type: String,
      enum: ["Arterial Road", "Service Road", "Underpass", "Residential Main", "Junction"],
      default: "Arterial Road"
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    drainageHealthScore: { type: Number, min: 1, max: 100, default: 50 }, // Lower = clogs faster
    elevationFactor: { type: Number, min: 0.5, max: 2.0, default: 1.0 }, // >1.0 means low-lying basin
    currentWaterDepthCm: { type: Number, default: 0 },
    aiPredictedFloodTimeMins: { type: Number, default: null }, // Null if not currently flooding
    floodStatus: {
      type: String,
      enum: ["CLEAR", "WATERLOGGED", "FLOODED", "IMPASSABLE"],
      default: "CLEAR"
    },
    passableFor: {
      twoWheeler: { type: Boolean, default: true },
      hatchbackSedan: { type: Boolean, default: true },
      suvBus: { type: Boolean, default: true }
    },
    potholes: [PotholeSchema],
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Street", StreetSchema);
