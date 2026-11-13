const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  path.resolve(__dirname, "../../backend/node_modules/.cache/mongodb");
process.env.DATA_MODE = "synthetic";
process.env.OPENWEATHER_API_KEY = "";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { io: client } = require("socket.io-client");
const { createServer } = require("../src/app");
const { seedSamples } = require("../src/seed/seedBengaluru");
const User = require("../src/models/User");
const Report = require("../src/models/Report");
let mongo, server, io, base, token, adminToken, street;
async function request(endpoint, method = "GET", body, authToken) {
  const res = await fetch(base + "/api/" + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: res.status === 204 ? null : await res.json(),
  };
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("integration");
  ({ server, io } = createServer());
  await require("../src/config/db")();
  await seedSamples();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (io) await new Promise((resolve) => io.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
test("authenticated reporting, moderation, area integrity and observation consistency", async () => {
  assert.equal((await request("health")).status, 200);
  const first = (await request("areas/bellandur")).data;
  street = first.streets[0];
  assert.equal(first.dataMode, "synthetic");
  assert.ok(Number.isFinite(street.drainageHealthScore));
  assert.ok(Array.isArray(street.potholes));
  assert.equal(first.weather.source, "Synthetic weather scenario");
  const registration = await request("auth/register", "POST", {
    name: "Resident",
    email: "resident@example.com",
    password: "a-long-password-123",
    role: "admin",
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.data.user.role, "resident");
  token = registration.data.token;
  adminToken = (
    await request("auth/register", "POST", {
      name: "Reviewer",
      email: "reviewer@example.com",
      password: "a-long-password-456",
    })
  ).data.token;
  await User.updateOne(
    { email: "reviewer@example.com" },
    { $set: { role: "admin" } },
  );
  const body = {
    areaSlug: "bellandur",
    streetId: street.id,
    reportType: "FLOODING",
    reportedWaterDepthCm: 40,
    description: "Observed standing water",
  };
  assert.equal((await request("reports", "POST", body)).status, 401);
  assert.equal(
    (
      await request(
        "reports",
        "POST",
        { ...body, areaSlug: "whitefield" },
        token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "reports",
        "POST",
        { ...body, reportedWaterDepthCm: -1 },
        token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "reports",
        "POST",
        { ...body, reportedWaterDepthCm: "20" },
        token,
      )
    ).status,
    400,
  );
  const created = await request("reports", "POST", body, token);
  assert.equal(created.status, 201);
  assert.equal(created.data.data.status, "pending");
  const id = created.data.data.id;
  assert.equal(
    (
      await request(
        `reports/${id}/status`,
        "PATCH",
        { status: "confirmed" },
        token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `reports/${id}/status`,
        "PATCH",
        { status: "confirmed" },
        adminToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `reports/${id}/status`,
        "PATCH",
        { status: "confirmed" },
        adminToken,
      )
    ).status,
    409,
  );
  let observed = (await request("areas/bellandur")).data.streets.find(
    (s) => s.id === street.id,
  );
  assert.equal(observed.currentWaterDepthCm, 40);
  assert.equal(observed.floodStatus, "IMPASSABLE");
  const lower = (
    await request(
      "reports",
      "POST",
      { ...body, reportedWaterDepthCm: 2 },
      token,
    )
  ).data.data;
  await request(
    `reports/${lower.id}/status`,
    "PATCH",
    { status: "confirmed" },
    adminToken,
  );
  observed = (await request("areas/bellandur")).data.streets.find(
    (s) => s.id === street.id,
  );
  assert.equal(observed.currentWaterDepthCm, 2);
  assert.equal(observed.floodStatus, "CLEAR");
  assert.equal(
    (await request("ai/simulate-rain/bellandur", "POST", {}, token)).status,
    403,
  );
  assert.equal(
    (await request("ai/simulate-rain/bellandur", "POST", {}, adminToken))
      .status,
    403,
  );
  process.env.ENABLE_DEMO_SIMULATION = "true";
  assert.equal((await request("ai/simulate-rain/bellandur", "POST", {}, adminToken)).status, 200);
  process.env.ENABLE_DEMO_SIMULATION = "false";
  const count = await Report.countDocuments();
  await seedSamples();
  assert.equal(await Report.countDocuments(), count);
  process.env.DATA_MODE = "observations";
  await Report.updateMany(
    { source: "community" },
    { $set: { expiresAt: new Date(0) } },
  );
  const missing = (await request("areas/bellandur")).data;
  assert.equal(missing.streets[0].floodStatus, "UNKNOWN");
  assert.equal(missing.streets[0].currentWaterDepthCm, null);
  assert.equal(missing.weather.rainfallMmPerHr, null);
  assert.equal(missing.reports.length, 0);
  await assert.rejects(seedSamples());
  assert.equal(
    (await request("ai/predict", "POST", { currentWaterDepthCm: -1 })).status,
    400,
  );
  const prediction = (
    await request("ai/predict", "POST", { currentWaterDepthCm: 10 })
  ).data.data;
  assert.equal(prediction.validated, false);
  assert.equal(prediction.estimatedPotholeDepthCm, null);
  await request("auth/logout", "POST", {}, token);
  assert.equal((await request("auth/me", "GET", undefined, token)).status, 401);
});
test("malformed socket events cannot crash the API and rooms stay scoped", async () => {
  const socket = client(base, {
    transports: ["websocket"],
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    socket.emit("leaveArea", { bad: true });
    socket.emit("joinArea", ["bellandur"]);
    const subscribed = new Promise((resolve) =>
      socket.once("subscribed", resolve),
    );
    socket.emit("joinArea", "bellandur");
    await subscribed;
    const packet = new Promise((resolve) => socket.once("areaAlert", resolve));
    io.to("area:bellandur").emit("areaAlert", { areaSlug: "bellandur" });
    assert.equal((await packet).areaSlug, "bellandur");
    const second = new Promise((resolve) => socket.once("subscribed", resolve));
    socket.emit("joinArea", "whitefield");
    await second;
    const rooms = io.sockets.sockets.get(socket.id).rooms;
    assert.equal(rooms.has("area:bellandur"), false);
    assert.equal(rooms.has("area:whitefield"), true);
    assert.equal((await request("health")).status, 200);
  } finally {
    socket.close();
  }
});
