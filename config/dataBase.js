import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error("MONGODB_URL is required. Configure it in the deployment environment.");
  }

  const connection = await mongoose.connect(mongoUrl);
  console.log(`MongoDB connected: ${connection.connection.host}`);
  return connection;
};
