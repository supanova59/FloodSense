const express = require("express");
const router = express.Router();
const floodController = require("../controllers/floodController");

router.get("/health", (req, res) => {
  res.json({ status: "OK", service: "FloodSense Bengaluru Backend", timestamp: new Date().toISOString() });
});

// Area & Street Discovery
router.get("/areas", floodController.getAllAreas);
router.get("/areas/:slug", floodController.getAreaDashboard);
router.get("/areas/:slug/streets", floodController.getStreetsByArea);

// Hyperlocal Weather
router.get("/weather/:slug", floodController.getWeatherByArea);

// Area-Scoped Live Reports & Notifications
router.get("/reports/:slug", floodController.getReportsByArea);
router.post("/reports", floodController.createAreaReport);

// AI Flood Time & Pothole Depth Engine
router.post("/ai/predict", floodController.predictFloodRisk);
router.post("/ai/simulate-rain/:slug", floodController.simulateCloudburst);

module.exports = router;
