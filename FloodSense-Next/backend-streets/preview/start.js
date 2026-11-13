const path = require("path");
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  path.resolve(__dirname, "../../backend/node_modules/.cache/mongodb");
process.env.DATA_MODE = "synthetic";
process.env.OPENWEATHER_API_KEY = "";
process.env.ENABLE_DEMO_SIMULATION = "false";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { createServer } = require("../src/app");
(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("floodsense_local_preview");
  const { server, io } = createServer();
  await require("../src/config/db")();
  await require("../src/seed/seedBengaluru").seedSamples();
  server.listen(4003, "127.0.0.1", () =>
    console.log(
      "Disposable synthetic backend ready: http://127.0.0.1:4003/api/health. Open the Next.js /streets page to preview.",
    ),
  );
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
