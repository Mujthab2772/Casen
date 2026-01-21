import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
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
    required: true,
  },
  referralCode: {
    type: String,
    trim: true,
    default: null,
  },
}, { timestamps: true });

otpSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("otp", otpSchema);