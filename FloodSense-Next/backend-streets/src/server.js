require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const apiRoutes = require("./routes/apiRoutes");
const { setupAlertSocket } = require("./sockets/alertSocket");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Make Socket.IO instance accessible inside Express controllers
app.set("io", io);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// Connect MongoDB & Initialize Socket Rooms
connectDB();
setupAlertSocket(io);

// REST API Routes
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` FloodSense Bengaluru Backend running on port ${PORT}`);
  console.log(` REST API:   http://localhost:${PORT}/api/areas`);
  console.log(` WebSockets: Ready for area-isolated live alerts`);
  console.log(`====================================================`);
});
