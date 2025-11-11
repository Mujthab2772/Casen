import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    password: {
      type: String,
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const otpCollection = mongoose.model("otp", otpSchema);

export default otpCollection;
