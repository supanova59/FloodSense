const router = require("express").Router();
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const {
  wrap,
  problem,
  text,
  hashPassword,
  matches,
  digest,
  auth,
} = require("../security");
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role });
async function issue(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    user: user.id,
    tokenHash: digest(token),
    expiresAt: new Date(Date.now() + 8 * 3600000),
  });
  return { token, user: publicUser(user) };
}
function credentials(body) {
  const email = text(body.email, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw problem(400, "Invalid email");
  const password = body.password;
  if (typeof password !== "string" || !password.length || password.length > 128)
    throw problem(400, "Invalid password");
  return { email, password };
}
router.post(
  "/register",
  wrap(async (req, res) => {
    const { email, password } = credentials(req.body);
    if (password.length < 12)
      throw problem(400, "Use at least 12 characters for your password");
    const user = await User.create({
      name: text(req.body.name, "name", 80),
      email,
      passwordHash: await hashPassword(password),
      role: "resident",
    });
    res.status(201).json(await issue(user));
  }),
);
router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = credentials(req.body);
    const user = await User.findOne({ email });
    if (!user || !(await matches(password, user.passwordHash)))
      throw problem(401, "Incorrect email or password");
    res.json(await issue(user));
  }),
);
router.get("/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));
router.post(
  "/logout",
  auth,
  wrap(async (req, res) => {
    await req.session.deleteOne();
    res.status(204).end();
  }),
);
module.exports = router;
