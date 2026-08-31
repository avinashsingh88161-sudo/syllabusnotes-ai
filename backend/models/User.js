/**
 * models/User.js — Mongoose schema for registered users
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never return password in queries by default
    },
    university: {
      type: String,
      trim: true,
      default: "",
    },
    semester: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    // Skill level — controls depth of AI-generated notes
    level: {
      type: String,
      enum: ["beginner", "intermediate", "pro"],
      default: "beginner",
    },
    // Subscription tier
    subscription_status: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    // How many files the free user has uploaded this month
    upload_count: {
      type: Number,
      default: 0,
    },
    // Track when the count was last reset (monthly)
    upload_count_reset_at: {
      type: Date,
      default: Date.now,
    },
    // Razorpay payment reference
    razorpay_order_id: {
      type: String,
      default: null,
    },
    razorpay_payment_id: {
      type: String,
      default: null,
    },
    // When premium expires (null = never for monthly plans)
    premium_expires_at: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: true, // set false if you add email verification
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─── Pre-save: Hash password ─────────────────────────────────────────────────
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: Compare password ──────────────────────────────────────
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance method: Reset upload count if new month ───────────────────────
UserSchema.methods.resetUploadCountIfNewMonth = async function () {
  const now = new Date();
  const resetDate = new Date(this.upload_count_reset_at);
  if (
    now.getMonth() !== resetDate.getMonth() ||
    now.getFullYear() !== resetDate.getFullYear()
  ) {
    this.upload_count = 0;
    this.upload_count_reset_at = now;
    await this.save();
  }
};

module.exports = mongoose.model("User", UserSchema);
