require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
// Promote an existing account explicitly; no default administrator password.
(async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin -- registered-email");
  await require("./config/db")();
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: "admin" } },
  );
  if (!user) throw new Error("Register this account in the app first");
  console.log("Administrator role assigned.");
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
