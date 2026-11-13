const mongoose = require("mongoose");
module.exports = async function connectDB() {
  if (!process.env.MONGO_URI)
    throw new Error("MONGO_URI must be configured on the backend");
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
};
