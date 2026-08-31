/**
 * controllers/authController.js — Register, Login, Profile
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/** Generate a signed JWT */
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

/** Format safe user object (no password) */
function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    university: user.university,
    semester: user.semester,
    subject: user.subject,
    level: user.level,
    subscription_status: user.subscription_status,
    upload_count: user.upload_count,
    createdAt: user.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, university, semester, subject, level } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }

    const user = await User.create({
      name,
      email,
      password,
      university: university || "",
      semester: semester || "",
      subject: subject || "",
      level: level || "beginner",
    });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Reset monthly upload counter if new month
    await user.resetUploadCountIfNewMonth();

    const token = signToken(user._id);
    res.json({
      success: true,
      message: "Logged in successfully!",
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: safeUser(req.user) });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile  (protected)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ["name", "university", "semester", "subject", "level"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, message: "Profile updated.", user: safeUser(user) });
  } catch (err) {
    next(err);
  }
};
