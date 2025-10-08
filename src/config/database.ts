import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create default admin user
    const { User } = await import("../models/User");
    // await User.createDefaultAdmin();
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
