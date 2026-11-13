/**
 * Area-Isolated Socket.IO Handler
 * Ensures users who select "Bellandur" ONLY receive live alerts/notifications for Bellandur.
 */
function setupAlertSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Frontend emits 'joinArea' with slug e.g., 'bellandur', 'hsr-layout', 'whitefield'
    socket.on("joinArea", (areaSlug) => {
      if (!areaSlug || typeof areaSlug !== "string") return;
      const normalized = areaSlug.trim().toLowerCase();

      // Leave any previously joined area rooms so notifications stay strictly scoped
      for (const room of socket.rooms) {
        if (room.startsWith("area:")) {
          socket.leave(room);
        }
      }

      const targetRoom = `area:${normalized}`;
      socket.join(targetRoom);
      console.log(`[Socket.IO] ${socket.id} subscribed to ${targetRoom}`);

      socket.emit("subscribed", {
        areaSlug: normalized,
        message: `Live flood & pothole alerts active for ${normalized.toUpperCase()}`
      });
    });

    socket.on("leaveArea", (areaSlug) => {
      if (!areaSlug) return;
      socket.leave(`area:${areaSlug.trim().toLowerCase()}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Helper to emit an alert strictly to users inside a specific Bengaluru area
 */
function broadcastAreaAlert(io, areaSlug, payload) {
  if (!io || !areaSlug) return;
  const room = `area:${areaSlug.trim().toLowerCase()}`;
  io.to(room).emit("areaAlert", {
    id: `alert_${Date.now()}`,
    areaSlug: areaSlug.trim().toLowerCase(),
    timestamp: new Date().toISOString(),
    ...payload
  });
}

module.exports = { setupAlertSocket, broadcastAreaAlert };
