require("dotenv").config();
const mongoose = require("mongoose");
const Area = require("../models/Area");
const Street = require("../models/Street");
const Report = require("../models/Report");

const AREAS = [
  {
    name: "Bellandur",
    slug: "bellandur",
    zone: "BBMP Mahadevapura",
    pincode: "560103",
    coordinates: { lat: 12.9259, lng: 77.6762 },
    lakeProximity: "High (Bellandur Lake Valley)",
    overallRiskLevel: "CRITICAL",
    emergencyHelpline: "080-28520011",
  },
  {
    name: "HSR Layout",
    slug: "hsr-layout",
    zone: "BBMP Bommanahalli",
    pincode: "560102",
    coordinates: { lat: 12.9121, lng: 77.6446 },
    lakeProximity: "High (Agara Lake Basin)",
    overallRiskLevel: "HIGH",
    emergencyHelpline: "080-25721100",
  },
  {
    name: "Whitefield",
    slug: "whitefield",
    zone: "BBMP Mahadevapura",
    pincode: "560066",
    coordinates: { lat: 12.9698, lng: 77.75 },
    lakeProximity: "Moderate (Varthur & Nallurhalli)",
    overallRiskLevel: "HIGH",
    emergencyHelpline: "080-28452244",
  },
  {
    name: "Koramangala",
    slug: "koramangala",
    zone: "BBMP South",
    pincode: "560034",
    coordinates: { lat: 12.9352, lng: 77.6245 },
    lakeProximity: "High (Ejipura / Mestripalya SWD)",
    overallRiskLevel: "HIGH",
    emergencyHelpline: "080-25531234",
  },
  {
    name: "Silk Board & BTM",
    slug: "silk-board",
    zone: "BBMP Bommanahalli",
    pincode: "560068",
    coordinates: { lat: 12.9177, lng: 77.6238 },
    lakeProximity: "High (Madiwala Lake Overflow)",
    overallRiskLevel: "CRITICAL",
    emergencyHelpline: "080-26781122",
  },
];

const STREETS = [
  // BELLANDUR
  {
    areaSlug: "bellandur",
    name: "Outer Ring Road — Ecospace Service Road",
    landmarkPlace: "RMZ Ecospace / Intel Gate 2",
    streetType: "Service Road",
    coordinates: { lat: 12.9275, lng: 77.6805 },
    drainageHealthScore: 28,
    elevationFactor: 1.65,
    currentWaterDepthCm: 28,
    aiPredictedFloodTimeMins: 0,
    floodStatus: "FLOODED",
    passableFor: { twoWheeler: false, hatchbackSedan: false, suvBus: true },
    potholes: [
      {
        landmark: "Opposite Ecospace Skywalk",
        estimatedDepthCm: 21,
        widthCm: 110,
        submerged: true,
        dangerRating: "SEVERE",
        confidenceScore: 0.94,
      },
      {
        landmark: "Bellandur Bus Bay Merge",
        estimatedDepthCm: 14,
        widthCm: 75,
        submerged: true,
        dangerRating: "MODERATE",
        confidenceScore: 0.89,
      },
    ],
  },
  {
    areaSlug: "bellandur",
    name: "Bellandur Kodi — Yamalur Main Road",
    landmarkPlace: "Bellandur Lake Weir / Kodi Junction",
    streetType: "Arterial Road",
    coordinates: { lat: 12.9331, lng: 77.6694 },
    drainageHealthScore: 35,
    elevationFactor: 1.5,
    currentWaterDepthCm: 16,
    aiPredictedFloodTimeMins: 22,
    floodStatus: "WATERLOGGED",
    passableFor: { twoWheeler: false, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "Near Lake Bridge Approach",
        estimatedDepthCm: 18,
        widthCm: 90,
        submerged: true,
        dangerRating: "SEVERE",
        confidenceScore: 0.91,
      },
    ],
  },
  {
    areaSlug: "bellandur",
    name: "Green Glen Layout Main Road",
    landmarkPlace: "Sobha Quartz / Centro Mall",
    streetType: "Residential Main",
    coordinates: { lat: 12.9221, lng: 77.6728 },
    drainageHealthScore: 68,
    elevationFactor: 0.95,
    currentWaterDepthCm: 4,
    aiPredictedFloodTimeMins: 75,
    floodStatus: "CLEAR",
    passableFor: { twoWheeler: true, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "3rd Cross Junction",
        estimatedDepthCm: 7,
        widthCm: 45,
        submerged: false,
        dangerRating: "MINOR",
        confidenceScore: 0.85,
      },
    ],
  },

  // HSR LAYOUT
  {
    areaSlug: "hsr-layout",
    name: "27th Main Road (Sector 1 & 2)",
    landmarkPlace: "NIFT Junction / Somasundarapalya Stretch",
    streetType: "Arterial Road",
    coordinates: { lat: 12.9082, lng: 77.6518 },
    drainageHealthScore: 44,
    elevationFactor: 1.35,
    currentWaterDepthCm: 18,
    aiPredictedFloodTimeMins: 28,
    floodStatus: "WATERLOGGED",
    passableFor: { twoWheeler: false, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "Near CPWD Quarters Gate",
        estimatedDepthCm: 16,
        widthCm: 80,
        submerged: true,
        dangerRating: "SEVERE",
        confidenceScore: 0.9,
      },
    ],
  },
  {
    areaSlug: "hsr-layout",
    name: "14th Main Road — Agara Lake Flyover Base",
    landmarkPlace: "Agara Lake Park Entrance",
    streetType: "Junction",
    coordinates: { lat: 12.9214, lng: 77.6389 },
    drainageHealthScore: 52,
    elevationFactor: 1.25,
    currentWaterDepthCm: 11,
    aiPredictedFloodTimeMins: 45,
    floodStatus: "WATERLOGGED",
    passableFor: { twoWheeler: true, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "Service Lane Entry",
        estimatedDepthCm: 11,
        widthCm: 60,
        submerged: true,
        dangerRating: "MODERATE",
        confidenceScore: 0.87,
      },
    ],
  },
  {
    areaSlug: "hsr-layout",
    name: "19th Main Road (Sector 3)",
    landmarkPlace: "BDA Complex / HSR Club",
    streetType: "Residential Main",
    coordinates: { lat: 12.9135, lng: 77.6411 },
    drainageHealthScore: 76,
    elevationFactor: 0.85,
    currentWaterDepthCm: 2,
    aiPredictedFloodTimeMins: null,
    floodStatus: "CLEAR",
    passableFor: { twoWheeler: true, hatchbackSedan: true, suvBus: true },
    potholes: [],
  },

  // WHITEFIELD
  {
    areaSlug: "whitefield",
    name: "ITPL Main Road — Hoodi & Graphite India Signal",
    landmarkPlace: "Graphite India Junction",
    streetType: "Junction",
    coordinates: { lat: 12.9765, lng: 77.7162 },
    drainageHealthScore: 32,
    elevationFactor: 1.55,
    currentWaterDepthCm: 24,
    aiPredictedFloodTimeMins: 8,
    floodStatus: "FLOODED",
    passableFor: { twoWheeler: false, hatchbackSedan: false, suvBus: true },
    potholes: [
      {
        landmark: "Left Turn towards Kundalahalli",
        estimatedDepthCm: 24,
        widthCm: 120,
        submerged: true,
        dangerRating: "AXLE_BREAKER",
        confidenceScore: 0.95,
      },
    ],
  },
  {
    areaSlug: "whitefield",
    name: "Panathur Railway Underpass (RUB)",
    landmarkPlace: "Panathur S-Cross / Balagere Road",
    streetType: "Underpass",
    coordinates: { lat: 12.9388, lng: 77.7042 },
    drainageHealthScore: 20,
    elevationFactor: 1.9,
    currentWaterDepthCm: 42,
    aiPredictedFloodTimeMins: 0,
    floodStatus: "IMPASSABLE",
    passableFor: { twoWheeler: false, hatchbackSedan: false, suvBus: false },
    potholes: [
      {
        landmark: "Center Underpass Dip",
        estimatedDepthCm: 27,
        widthCm: 140,
        submerged: true,
        dangerRating: "AXLE_BREAKER",
        confidenceScore: 0.96,
      },
    ],
  },
  {
    areaSlug: "whitefield",
    name: "Varthur Main Road — Hope Farm Junction",
    landmarkPlace: "Hope Farm Signal / Channasandra",
    streetType: "Arterial Road",
    coordinates: { lat: 12.9822, lng: 77.7529 },
    drainageHealthScore: 58,
    elevationFactor: 1.1,
    currentWaterDepthCm: 9,
    aiPredictedFloodTimeMins: 50,
    floodStatus: "WATERLOGGED",
    passableFor: { twoWheeler: true, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "Metro Pillar 114",
        estimatedDepthCm: 12,
        widthCm: 65,
        submerged: true,
        dangerRating: "MODERATE",
        confidenceScore: 0.88,
      },
    ],
  },

  // KORAMANGALA
  {
    areaSlug: "koramangala",
    name: "80 Feet Road — Sony World Signal",
    landmarkPlace: "Sony World Junction / Ejipura",
    streetType: "Junction",
    coordinates: { lat: 12.9378, lng: 77.6269 },
    drainageHealthScore: 36,
    elevationFactor: 1.48,
    currentWaterDepthCm: 21,
    aiPredictedFloodTimeMins: 14,
    floodStatus: "FLOODED",
    passableFor: { twoWheeler: false, hatchbackSedan: true, suvBus: true },
    potholes: [
      {
        landmark: "Near Maharaja Signal Drain",
        estimatedDepthCm: 17,
        widthCm: 85,
        submerged: true,
        dangerRating: "SEVERE",
        confidenceScore: 0.92,
      },
    ],
  },
  {
    areaSlug: "koramangala",
    name: "4th Block — ST Bed Layout Main Road",
    landmarkPlace: "Mestripalya Lake Edge",
    streetType: "Residential Main",
    coordinates: { lat: 12.9334, lng: 77.6305 },
    drainageHealthScore: 30,
    elevationFactor: 1.6,
    currentWaterDepthCm: 25,
    aiPredictedFloodTimeMins: 0,
    floodStatus: "FLOODED",
    passableFor: { twoWheeler: false, hatchbackSedan: false, suvBus: true },
    potholes: [],
  },

  // SILK BOARD
  {
    areaSlug: "silk-board",
    name: "Central Silk Board Junction — Hosur Road Loop",
    landmarkPlace: "Roopena Agrahara / Madiwala Market",
    streetType: "Junction",
    coordinates: { lat: 12.9177, lng: 77.6238 },
    drainageHealthScore: 25,
    elevationFactor: 1.75,
    currentWaterDepthCm: 34,
    aiPredictedFloodTimeMins: 0,
    floodStatus: "IMPASSABLE",
    passableFor: { twoWheeler: false, hatchbackSedan: false, suvBus: true },
    potholes: [
      {
        landmark: "BTM 2nd Stage Ramp Merge",
        estimatedDepthCm: 23,
        widthCm: 115,
        submerged: true,
        dangerRating: "AXLE_BREAKER",
        confidenceScore: 0.94,
      },
    ],
  },
];

const INITIAL_REPORTS = [
  {
    areaSlug: "bellandur",
    streetName: "Outer Ring Road — Ecospace Service Road",
    landmark: "RMZ Ecospace Gate 2",
    reportType: "FLOODING",
    severity: "HIGH",
    reportedWaterDepthCm: 28,
    aiEstimatedPotholeDepthCm: 21,
    aiEstimatedFloodTimeMins: 0,
    description:
      "Ankle-to-shin deep waterlogging in service lane; two bikes stalled near hidden pothole.",
    reportedBy: "Karthik R.",
  },
  {
    areaSlug: "hsr-layout",
    streetName: "27th Main Road (Sector 1 & 2)",
    landmark: "NIFT Junction",
    reportType: "POTHOLE",
    severity: "MODERATE",
    reportedWaterDepthCm: 18,
    aiEstimatedPotholeDepthCm: 16,
    aiEstimatedFloodTimeMins: 28,
    description: "Deep crater submerged under muddy runoff on left lane.",
    reportedBy: "Ananya S.",
  },
  {
    areaSlug: "whitefield",
    streetName: "Panathur Railway Underpass (RUB)",
    landmark: "Panathur S-Cross",
    reportType: "FLOODING",
    severity: "CRITICAL",
    reportedWaterDepthCm: 42,
    aiEstimatedPotholeDepthCm: 27,
    aiEstimatedFloodTimeMins: 0,
    description:
      "Underpass completely flooded. Take Varthur-Gunjur diversion immediately.",
    reportedBy: "Traffic Volunteer",
  },
  {
    areaSlug: "koramangala",
    streetName: "80 Feet Road — Sony World Signal",
    landmark: "Sony World Junction",
    reportType: "DRAIN_BLOCKAGE",
    severity: "HIGH",
    reportedWaterDepthCm: 21,
    aiEstimatedPotholeDepthCm: 17,
    aiEstimatedFloodTimeMins: 14,
    description: "Stormwater drain overflowing onto 80ft road junction.",
    reportedBy: "Rohan M.",
  },
  {
    areaSlug: "silk-board",
    streetName: "Central Silk Board Junction — Hosur Road Loop",
    landmark: "Roopena Agrahara",
    reportType: "TRAFFIC_STUCK",
    severity: "CRITICAL",
    reportedWaterDepthCm: 34,
    aiEstimatedPotholeDepthCm: 23,
    aiEstimatedFloodTimeMins: 0,
    description:
      "Severe water stagnation blocking BTM-to-Electronic City ramp.",
    reportedBy: "Priya N.",
  },
];

async function seedSamples() {
  if (process.env.DATA_MODE !== "synthetic")
    throw new Error(
      "Sample seeding requires DATA_MODE=synthetic and a separate demo database",
    );
  for (const area of AREAS)
    await Area.updateOne(
      { slug: area.slug },
      { $setOnInsert: area },
      { upsert: true },
    );
  for (const street of STREETS)
    await Street.updateOne(
      { areaSlug: street.areaSlug, name: street.name },
      { $setOnInsert: street },
      { upsert: true },
    );
  for (const [i, rep] of INITIAL_REPORTS.entries()) {
    const street = await Street.findOne({
      areaSlug: rep.areaSlug,
      name: rep.streetName,
    });
    await Report.updateOne(
      { sourceKey: `sample-v1-${i}` },
      {
        $setOnInsert: {
          ...rep,
          streetId: street._id,
          source: "synthetic",
          status: "confirmed",
          reportedBy: "Synthetic example",
          expiresAt: new Date(Date.now() + 86400000),
        },
      },
      { upsert: true },
    );
  }
}
async function seedDatabase() {
  try {
    await require("../config/db")();
    await seedSamples();
    console.log("Synthetic sample data added; existing records preserved.");
  } catch {
    console.error("Seeding failed. Check DATA_MODE, connection and indexes.");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module) seedDatabase();
module.exports = { AREAS, STREETS, INITIAL_REPORTS, seedSamples };
