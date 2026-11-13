import { onStart, onShutdown } from "@netlify/server";
import mongoose from "mongoose";
import backend from "../../src/app.js";
import connectDB from "../../src/config/db.js";
const { server, io } = backend.createServer();
onStart(connectDB);
onShutdown(async ({ drained }) => {
  io.disconnectSockets(true);
  await drained;
  await mongoose.disconnect();
});
export default server;
