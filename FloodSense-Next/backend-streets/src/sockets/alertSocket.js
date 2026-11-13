function normalize(value) {
  return typeof value === "string" &&
    /^[a-z0-9-]{1,80}$/.test(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : null;
}
function setupAlertSocket(io) {
  io.on("connection", (socket) => {
    socket.on("joinArea", (value) => {
      const slug = normalize(value);
      if (!slug) return;
      for (const room of socket.rooms)
        if (room.startsWith("area:")) socket.leave(room);
      socket.join(`area:${slug}`);
      socket.emit("subscribed", { areaSlug: slug });
    });
    socket.on("leaveArea", (value) => {
      const slug = normalize(value);
      if (slug) socket.leave(`area:${slug}`);
    });
  });
}
function broadcastAreaAlert(io, value, payload) {
  const slug = normalize(value);
  if (io && slug)
    io.to(`area:${slug}`).emit("areaAlert", {
      ...payload,
      areaSlug: slug,
      timestamp: new Date().toISOString(),
    });
}
module.exports = { setupAlertSocket, broadcastAreaAlert };
