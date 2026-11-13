const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { setupAlertSocket } = require("./sockets/alertSocket");

function createServer() {
  const app = express();
  app.disable("x-powered-by");
  const origins = (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim());
  const origin = (value, done) => done(null, !value || origins.includes(value));
  app.use(cors({ origin }));
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (req.body && (Array.isArray(req.body) || typeof req.body !== "object"))
      return res.status(400).json({ message: "JSON object required" });
    next();
  });
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin }, maxHttpBufferSize: 16384 });
  app.set("io", io);
  setupAlertSocket(io);
  app.use("/api", require("./routes/apiRoutes"));
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err.code === 11000
        ? 409
        : err.name === "ValidationError"
          ? 400
          : err.status || 500;
    res
      .status(status)
      .json({
        message:
          err.code === 11000
            ? "Record already exists"
            : status >= 500
              ? "Service unavailable. Please retry later"
              : err.message,
      });
  });
  return { app, server, io };
}
module.exports = { createServer };
