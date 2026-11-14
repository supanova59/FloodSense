const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);
const Session = require("./models/Session");
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
function problem(status, message) {
  return Object.assign(new Error(message), { status });
}
function text(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw problem(400, `Invalid ${name}`);
  return value.trim();
}
function number(value, name, min, max) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw problem(400, `Invalid ${name}`);
  return value;
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}
async function matches(password, stored) {
  const [salt, hex] = stored.split(":");
  const hash = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hex, "hex"));
}
const digest = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const auth = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(token)) throw problem(401, "Sign in to continue");
  const session = await Session.findOne({
    tokenHash: digest(token),
    expiresAt: { $gt: new Date() },
  }).populate("user");
  if (!session?.user) throw problem(401, "Session expired. Sign in again");
  req.user = session.user;
  req.session = session;
  next();
});
const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : next(problem(403, "Administrator access required"));
module.exports = {
  wrap,
  problem,
  text,
  number,
  hashPassword,
  matches,
  digest,
  auth,
  admin,
};
