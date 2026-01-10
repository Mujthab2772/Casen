import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: () => uuidv4(),
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: function () {
        return this.authProvider === "local"
      },
      trim: true
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local"
      },
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.index({ referralCode: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { referralCode: { $exists: true, $ne: null } } 
});

export default mongoose.model("user", userSchema);