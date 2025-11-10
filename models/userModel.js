import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      required: function() {
        return this.authProvider === "local"
      },
      trim: true
    },
    password: {
      type: String,
      required: function() {
        return this.authProvider === "local"
      },
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "default.jpg",
    },
    isVerified: {
      type: Boolean, // true only after OTP verification
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
  },
  { timestamps: true }
);

const user = mongoose.model("user", userSchema)



export default user