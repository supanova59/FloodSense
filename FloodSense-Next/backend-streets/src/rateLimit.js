// Database-backed counters work across deploys/instances. No user IP is stored in plaintext.
const { Schema, model } = require("mongoose");
const { createHash } = require("crypto");
const { wrap, problem } = require("./security");
const schema = new Schema({ _id: String, count: Number, expiresAt: Date });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Counter = model("RequestLimit", schema);
module.exports = (scope, max, windowMs = 60000) =>
  wrap(async (req, res, next) => {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = createHash("sha256")
      .update(`${scope}:${req.user?.id || req.ip}:${bucket}`)
      .digest("hex");
    let row;
    try {
      row = await Counter.findOneAndUpdate(
        { _id: key },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
        },
        { upsert: true, new: true },
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
      row = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { count: 1 } },
        { new: true },
      );
    }
    if (row.count > max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      throw problem(429, "Too many requests. Please retry later");
    }
    next();
  });
