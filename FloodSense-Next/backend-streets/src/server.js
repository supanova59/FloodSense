require("dotenv").config();
const mongoose = require("mongoose");
const { createServer } = require("./app");
const { server, io } = createServer();
require("./config/db")()
  .then(() => {
    server.listen(process.env.PORT || 5000, () =>
      console.log("FloodSense API ready"),
    );
  })
  .catch(() => {
    console.error(
      "Startup failed. Check MongoDB credentials, network access and indexes.",
    );
    process.exitCode = 1;
  });
async function stop() {
  io.close();
  server.close();
  await mongoose.disconnect();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
