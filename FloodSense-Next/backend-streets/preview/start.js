const path = require("path");
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  path.resolve(__dirname, "../../backend/node_modules/.cache/mongodb");
process.env.DATA_MODE = "synthetic";
process.env.OPENWEATHER_API_KEY = "";
process.env.ENABLE_DEMO_SIMULATION = "true";
process.env.CLIENT_URL = "http://localhost:3005,http://127.0.0.1:3005";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { createServer } = require("../src/app");
(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("floodsense_local_preview");
  const { server, io } = createServer();
  await require("../src/config/db")();
  await require("../src/seed/seedBengaluru").seedSamples();
  const password = require("crypto").randomBytes(12).toString("hex");
  await require("../src/models/User").create({
    name: "Preview reviewer",
    email: "reviewer@preview.local",
    role: "admin",
    passwordHash: await require("../src/security").hashPassword(password),
  });
  const port = Number(process.env.PREVIEW_PORT || 4003);
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `Disposable synthetic backend ready on port ${port}. Open the frontend to preview.`,
    );
    console.log(
      `Local disposable reviewer: reviewer@preview.local / ${password}`,
    );
  });
  async function stop() {
    io.close();
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})().catch(() => {
  console.error("Preview failed. Check local MongoDB runtime availability.");
  process.exitCode = 1;
});
