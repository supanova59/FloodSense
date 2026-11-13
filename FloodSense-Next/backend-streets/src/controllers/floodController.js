const mongoose = require("mongoose");
const Area = require("../models/Area");
const Street = require("../models/Street");
const Report = require("../models/Report");
const { getAreaWeather } = require("../services/weatherService");
const {
  calculateFloodAndPotholeMetrics: calculate,
} = require("../services/aiPredictor");
const { broadcastAreaAlert } = require("../sockets/alertSocket");
const { wrap, problem, text, number } = require("../security");
const active = () => ({
  isActive: true,
  status: "confirmed",
  expiresAt: { $gt: new Date() },
  ...(process.env.DATA_MODE === "synthetic" ? {} : { source: "community" }),
});
const slug = (req) => text(req.params.slug, "area", 80).toLowerCase();
const publicReport = (r) => ({
  id: String(r._id),
  areaSlug: r.areaSlug,
  streetId: String(r.streetId),
  streetName: r.streetName,
  reportType: r.reportType,
  reportedWaterDepthCm: r.reportedWaterDepthCm,
  description: r.description,
  status: r.status,
  source: r.source,
  createdAt: r.createdAt,
});
function emit(req, r) {
  broadcastAreaAlert(req.app.get("io"), r.areaSlug, {
    type: "report:updated",
    report: publicReport(r),
  });
}
async function areaFor(value) {
  const area = await Area.findOne({ slug: value }).lean();
  if (!area) throw problem(404, "Area not found");
  return area;
}
function id(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value))
    throw problem(400, "Invalid record ID");
  return value;
}
exports.getAllAreas = wrap(async (req, res) => {
  const rows = await Area.find().sort({ name: 1 }).lean();
  res.json({
    success: true,
    data: rows.map((a) => ({
      id: String(a._id),
      name: a.name,
      slug: a.slug,
      coordinates: a.coordinates,
    })),
    count: rows.length,
  });
});
exports.getAreaDashboard = wrap(async (req, res) => {
  const area = await areaFor(slug(req));
  const filter = { areaSlug: area.slug, ...active() };
  const [streets, reports, weather, count, latestRows] = await Promise.all([
    Street.find({ areaSlug: area.slug }).sort({ name: 1 }).lean(),
    Report.find(filter).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
    getAreaWeather(area),
    Report.countDocuments(filter),
    Report.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: "$streetId", report: { $first: "$$ROOT" } } },
    ]),
  ]);
  const latest = new Map(latestRows.map((r) => [String(r._id), r.report]));
  const enriched = streets.map((s) => {
    const r = latest.get(String(s._id));
    const depth = r
      ? r.reportedWaterDepthCm
      : process.env.DATA_MODE === "synthetic"
        ? s.currentWaterDepthCm
        : null;
    const metrics =
      depth === null
        ? null
        : calculate({
            currentWaterDepthCm: depth,
            rainfallMmPerHr: weather.rainfallMmPerHr ?? 0,
            drainageHealthScore: s.drainageHealthScore,
            elevationFactor: s.elevationFactor,
          });
    return {
      id: String(s._id),
      name: s.name,
      landmark: s.landmarkPlace,
      coordinates: s.coordinates,
      currentWaterDepthCm: depth,
      floodStatus: metrics?.floodStatus || "UNKNOWN",
      severity: metrics?.severity || "UNKNOWN",
      estimatedFloodTimeMins:
        process.env.DATA_MODE === "synthetic" &&
        weather.rainfallMmPerHr !== null
          ? metrics?.estimatedFloodTimeMins
          : null,
      source: r ? r.source : depth === null ? "unavailable" : "synthetic",
      observedAt: r ? r.createdAt : null,
    };
  });
  res.json({
    success: true,
    area: { name: area.name, slug: area.slug, coordinates: area.coordinates },
    weather,
    streets: enriched,
    reports: reports.map(publicReport),
    summary: {
      totalMonitoredStreets: enriched.length,
      floodedOrImpassableCount: enriched.filter((s) =>
        ["FLOODED", "IMPASSABLE"].includes(s.floodStatus),
      ).length,
      activeAreaReports: count,
    },
    dataMode:
      process.env.DATA_MODE === "synthetic" ? "synthetic" : "observations",
  });
});
exports.getStreetsByArea = exports.getAreaDashboard;
exports.getWeatherByArea = wrap(async (req, res) =>
  res.json({
    success: true,
    data: await getAreaWeather(await areaFor(slug(req))),
  }),
);
exports.getReportsByArea = wrap(async (req, res) => {
  const value = slug(req);
  await areaFor(value);
  res.json({
    success: true,
    data: (
      await Report.find({ areaSlug: value, ...active() })
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .lean()
    ).map(publicReport),
  });
});
exports.mine = wrap(async (req, res) =>
  res.json({
    data: (
      await Report.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    ).map(publicReport),
  }),
);
exports.pending = wrap(async (req, res) =>
  res.json({
    data: (
      await Report.find({ status: "pending", expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    ).map(publicReport),
  }),
);
exports.createAreaReport = wrap(async (req, res) => {
  const b = req.body,
    areaSlug = text(b.areaSlug, "area", 80).toLowerCase();
  await areaFor(areaSlug);
  const street = await Street.findOne({ _id: id(b.streetId), areaSlug });
  if (!street)
    throw problem(400, "Street does not belong to the selected area");
  const reportType = text(b.reportType, "type", 40);
  if (
    !["FLOODING", "POTHOLE", "DRAIN_BLOCKAGE", "TRAFFIC_STUCK"].includes(
      reportType,
    )
  )
    throw problem(400, "Invalid report type");
  const depth = number(b.reportedWaterDepthCm, "water depth", 0, 200);
  const report = await Report.create({
    areaSlug,
    streetId: street.id,
    streetName: street.name,
    landmark: street.landmarkPlace,
    reportType,
    reportedWaterDepthCm: depth,
    description: text(b.description, "observation"),
    userId: req.user.id,
    reportedBy: "Community contributor",
    status: "pending",
    source: "community",
  });
  res
    .status(201)
    .json({
      success: true,
      data: publicReport(report),
      message:
        "Saved for moderation. Street conditions change only after confirmation.",
    });
});
exports.moderate = wrap(async (req, res) => {
  const status = req.body.status;
  if (!["confirmed", "rejected"].includes(status))
    throw problem(400, "Invalid moderation status");
  const report = await Report.findOneAndUpdate(
    {
      _id: id(req.params.id),
      status: "pending",
      expiresAt: { $gt: new Date() },
    },
    { $set: { status } },
    { new: true, runValidators: true },
  );
  if (!report)
    throw problem(409, "Report is unavailable, expired, or already moderated");
  if (status === "confirmed") emit(req, report);
  res.json({ data: publicReport(report) });
});
exports.predictFloodRisk = wrap(async (req, res) =>
  res.json({ success: true, data: calculate(req.body) }),
);
exports.simulateCloudburst = wrap(async (req, res) => {
  if (
    process.env.ENABLE_DEMO_SIMULATION !== "true" ||
    process.env.DATA_MODE !== "synthetic"
  )
    throw problem(
      403,
      "Simulation is disabled outside synthetic demo environments",
    );
  const area = await areaFor(slug(req));
  const street = await Street.findOne({ areaSlug: area.slug }).sort({
    drainageHealthScore: 1,
  });
  if (!street) throw problem(404, "No streets in this area");
  const r = await Report.create({
    areaSlug: area.slug,
    streetId: street.id,
    streetName: street.name,
    reportType: "FLOODING",
    reportedWaterDepthCm: 40,
    description: "Synthetic cloudburst scenario; not a sensor observation.",
    reportedBy: "Demo scenario",
    userId: req.user.id,
    status: "confirmed",
    source: "synthetic",
  });
  emit(req, r);
  res.json({ success: true, data: publicReport(r) });
});
