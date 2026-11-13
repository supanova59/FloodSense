const Area = require("../models/Area");
const Street = require("../models/Street");
const Report = require("../models/Report");
const { getAreaWeather } = require("../services/weatherService");
const { calculateFloodAndPotholeMetrics } = require("../services/aiPredictor");
const { broadcastAreaAlert } = require("../sockets/alertSocket");

// GET /api/areas
exports.getAllAreas = async (req, res) => {
  try {
    const areas = await Area.find().sort({ name: 1 }).lean();
    res.json({ success: true, count: areas.length, data: areas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/areas/:slug -> Complete Area Dashboard (Streets + Places + Weather + Area-Only Reports)
exports.getAreaDashboard = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const area = await Area.findOne({ slug }).lean();
    if (!area) {
      return res.status(404).json({ success: false, message: `Area '${slug}' not found` });
    }

    const [streets, reports, weather] = await Promise.all([
      Street.find({ areaSlug: slug }).sort({ currentWaterDepthCm: -1 }).lean(),
      Report.find({ areaSlug: slug, isActive: true }).sort({ createdAt: -1 }).limit(20).lean(),
      getAreaWeather(area)
    ]);

    // Enrich each street with real-time AI flood countdown based on current area rainfall
    const enrichedStreets = streets.map((street) => {
      const ai = calculateFloodAndPotholeMetrics({
        rainfallMmPerHr: weather.rainfallMmPerHr,
        currentWaterDepthCm: street.currentWaterDepthCm,
        drainageHealthScore: street.drainageHealthScore,
        elevationFactor: street.elevationFactor
      });

      return {
        ...street,
        aiPredictedFloodTimeMins: ai.estimatedFloodTimeMins,
        liveAdvisory: ai.advisoryMessage
      };
    });

    const summary = {
      totalMonitoredStreets: enrichedStreets.length,
      floodedOrImpassableCount: enrichedStreets.filter((s) =>
        ["FLOODED", "IMPASSABLE"].includes(s.floodStatus)
      ).length,
      waterloggedCount: enrichedStreets.filter((s) => s.floodStatus === "WATERLOGGED").length,
      totalMappedPotholes: enrichedStreets.reduce((acc, s) => acc + (s.potholes?.length || 0), 0),
      activeAreaReports: reports.length
    };

    res.json({
      success: true,
      area,
      weather,
      summary,
      streets: enrichedStreets,
      reports
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/areas/:slug/streets
exports.getStreetsByArea = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const streets = await Street.find({ areaSlug: slug }).sort({ name: 1 }).lean();
    res.json({ success: true, areaSlug: slug, count: streets.length, data: streets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/weather/:slug
exports.getWeatherByArea = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const area = await Area.findOne({ slug }).lean();
    if (!area) {
      return res.status(404).json({ success: false, message: `Area '${slug}' not found` });
    }
    const weather = await getAreaWeather(area);
    res.json({ success: true, data: weather });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports/:slug
exports.getReportsByArea = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const reports = await Report.find({ areaSlug: slug, isActive: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, areaSlug: slug, count: reports.length, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/reports -> Submit report + Run AI + Emit live Socket notification ONLY to that area
exports.createAreaReport = async (req, res) => {
  try {
    const {
      areaSlug,
      streetId,
      streetName,
      landmark,
      reportType,
      reportedWaterDepthCm = 12,
      surfacePoolingRadiusCm = 95,
      description,
      reportedBy
    } = req.body;

    if (!areaSlug || !streetName || !reportType || !description) {
      return res.status(400).json({
        success: false,
        message: "areaSlug, streetName, reportType, and description are required."
      });
    }

    const normalizedSlug = areaSlug.toLowerCase();
    const area = await Area.findOne({ slug: normalizedSlug }).lean();
    if (!area) {
      return res.status(404).json({ success: false, message: `Unknown areaSlug: ${normalizedSlug}` });
    }

    const weather = await getAreaWeather(area);
    const street = streetId ? await Street.findById(streetId) : await Street.findOne({ areaSlug: normalizedSlug, name: streetName });

    const ai = calculateFloodAndPotholeMetrics({
      rainfallMmPerHr: weather.rainfallMmPerHr,
      currentWaterDepthCm: Number(reportedWaterDepthCm),
      drainageHealthScore: street ? street.drainageHealthScore : 45,
      elevationFactor: street ? street.elevationFactor : 1.2,
      surfacePoolingRadiusCm: Number(surfacePoolingRadiusCm)
    });

    const newReport = await Report.create({
      areaSlug: normalizedSlug,
      streetId: street ? street._id : null,
      streetName,
      landmark: landmark || (street ? street.landmarkPlace : ""),
      reportType,
      severity: ai.severity,
      reportedWaterDepthCm: Number(reportedWaterDepthCm),
      aiEstimatedPotholeDepthCm: ai.estimatedPotholeDepthCm,
      aiEstimatedFloodTimeMins: ai.estimatedFloodTimeMins,
      description,
      reportedBy: reportedBy || "Bengaluru Commuter"
    });

    // Update live street status if matched in DB
    if (street) {
      street.currentWaterDepthCm = Math.max(street.currentWaterDepthCm, Number(reportedWaterDepthCm));
      street.floodStatus = ai.floodStatus;
      street.aiPredictedFloodTimeMins = ai.estimatedFloodTimeMins;
      street.passableFor = ai.passableFor;
      street.lastUpdated = new Date();

      if (reportType === "POTHOLE") {
        street.potholes.push({
          landmark: landmark || streetName,
          estimatedDepthCm: ai.estimatedPotholeDepthCm,
          submerged: Number(reportedWaterDepthCm) > 5,
          dangerRating: ai.potholeDangerRating
        });
      }
      await street.save();
    }

    // Broadcast real-time alert ONLY to users subscribed to this area
    const io = req.app.get("io");
    broadcastAreaAlert(io, normalizedSlug, {
      type: reportType,
      severity: ai.severity,
      title: `${reportType} Alert — ${streetName}`,
      message: `${description} | AI Pothole Depth: ~${ai.estimatedPotholeDepthCm}cm${
        ai.estimatedFloodTimeMins !== null ? ` | Flood ETA: ${ai.estimatedFloodTimeMins} mins` : ""
      }`,
      streetName,
      landmark: newReport.landmark,
      aiMetrics: ai,
      report: newReport
    });

    res.status(201).json({
      success: true,
      message: `Report logged and live notification sent to ${area.name} subscribers.`,
      data: newReport,
      aiAnalysis: ai
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ai/predict -> Standalone AI Calculator endpoint for Frontend interactive widgets
exports.predictFloodRisk = (req, res) => {
  const metrics = calculateFloodAndPotholeMetrics(req.body || {});
  res.json({ success: true, data: metrics });
};

// POST /api/ai/simulate-rain/:slug -> Demo trigger for project evaluation/viva
exports.simulateCloudburst = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const area = await Area.findOne({ slug });
    if (!area) return res.status(404).json({ success: false, message: "Area not found" });

    const criticalStreet = await Street.findOne({ areaSlug: slug }).sort({ drainageHealthScore: 1 });
    if (!criticalStreet) return res.status(404).json({ success: false, message: "No streets found in area" });

    const simulatedDepth = criticalStreet.currentWaterDepthCm + 14;
    const ai = calculateFloodAndPotholeMetrics({
      rainfallMmPerHr: 32,
      currentWaterDepthCm: simulatedDepth,
      drainageHealthScore: criticalStreet.drainageHealthScore,
      elevationFactor: criticalStreet.elevationFactor,
      surfacePoolingRadiusCm: 120
    });

    criticalStreet.currentWaterDepthCm = simulatedDepth;
    criticalStreet.floodStatus = ai.floodStatus;
    criticalStreet.aiPredictedFloodTimeMins = ai.estimatedFloodTimeMins;
    criticalStreet.passableFor = ai.passableFor;
    criticalStreet.lastUpdated = new Date();
    await criticalStreet.save();

    const report = await Report.create({
      areaSlug: slug,
      streetId: criticalStreet._id,
      streetName: criticalStreet.name,
      landmark: criticalStreet.landmarkPlace,
      reportType: "FLOODING",
      severity: "CRITICAL",
      reportedWaterDepthCm: simulatedDepth,
      aiEstimatedPotholeDepthCm: ai.estimatedPotholeDepthCm,
      aiEstimatedFloodTimeMins: ai.estimatedFloodTimeMins,
      description: `AI Cloudburst Alert: Water rising rapidly (${simulatedDepth}cm) near ${criticalStreet.landmarkPlace}.`,
      reportedBy: "FloodSense AI Sensor Grid"
    });

    const io = req.app.get("io");
    broadcastAreaAlert(io, slug, {
      type: "AI_CLOUDBURST_WARNING",
      severity: "CRITICAL",
      title: `URGENT AVOID: ${criticalStreet.name}`,
      message: ai.advisoryMessage,
      streetName: criticalStreet.name,
      landmark: criticalStreet.landmarkPlace,
      aiMetrics: ai,
      report
    });

    res.json({
      success: true,
      message: `Simulated cloudburst alert pushed ONLY to users in ${area.name}`,
      street: criticalStreet,
      aiMetrics: ai
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
