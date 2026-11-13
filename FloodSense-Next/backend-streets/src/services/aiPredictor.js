// Unvalidated demonstration heuristic, not a safe-passage guarantee or trained AI.
const { number } = require("../security");
function calculateFloodAndPotholeMetrics(input = {}) {
  const rainfall = number(input.rainfallMmPerHr ?? 0, "rainfall", 0, 300);
  const depth = number(input.currentWaterDepthCm ?? 0, "water depth", 0, 200);
  const drainage = number(
    input.drainageHealthScore ?? 50,
    "drainage score",
    1,
    100,
  );
  const elevation = number(
    input.elevationFactor ?? 1,
    "elevation factor",
    0.5,
    2,
  );
  const runoff = rainfall * 0.14 * (1 + (100 - drainage) / 65) * elevation;
  const estimatedFloodTimeMins =
    depth >= 25
      ? 0
      : runoff > 0.5
        ? Math.max(3, Math.round(((25 - depth) / runoff) * 60))
        : null;
  const floodStatus =
    depth >= 35
      ? "IMPASSABLE"
      : depth >= 20
        ? "FLOODED"
        : depth >= 8
          ? "WATERLOGGED"
          : "CLEAR";
  const severity = {
    IMPASSABLE: "CRITICAL",
    FLOODED: "HIGH",
    WATERLOGGED: "MODERATE",
    CLEAR: "LOW",
  }[floodStatus];
  return {
    model: "demonstration-heuristic-v1",
    validated: false,
    runoffRateCmPerHr: Number(runoff.toFixed(2)),
    estimatedFloodTimeMins,
    estimatedPotholeDepthCm: null,
    floodStatus,
    severity,
    advisoryMessage:
      "Unverified observation and heuristic estimate; not a prediction or safe-travel recommendation.",
  };
}
module.exports = { calculateFloodAndPotholeMetrics };
