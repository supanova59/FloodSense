const router = require("express").Router();
const mongoose = require("mongoose");
const c = require("../controllers/floodController");
const { auth, admin } = require("../security");
const rate = require("../rateLimit");
router.get("/health", (req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ ready: mongoose.connection.readyState === 1 }),
);
router.use("/auth", rate("auth", 20), require("./auth"));
router.get("/areas", c.getAllAreas);
router.get("/areas/:slug", c.getAreaDashboard);
router.get("/areas/:slug/streets", c.getStreetsByArea);
router.get("/weather/:slug", c.getWeatherByArea);
router.get("/reports/mine", auth, c.mine);
router.get("/reports/pending", auth, admin, c.pending);
router.get("/reports/:slug", c.getReportsByArea);
router.post("/reports", auth, rate("reports", 10, 3600000), c.createAreaReport);
router.patch("/reports/:id/status", auth, admin, c.moderate);
router.post("/ai/predict", rate("predict", 60), c.predictFloodRisk);
router.post(
  "/ai/simulate-rain/:slug",
  auth,
  admin,
  rate("simulation", 5),
  c.simulateCloudburst,
);
module.exports = router;
