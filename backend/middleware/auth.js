/**
 * middleware/auth.js — Verifies JWT token on protected routes
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect middleware — attach req.user if token valid
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Accept token from Authorization header (Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach fresh user from DB (to pick up subscription changes)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Token invalid — user not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please log in again." });
    }
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};

/**
 * Premium-only middleware — must run AFTER protect
 */
const premiumOnly = (req, res, next) => {
  if (req.user.subscription_status !== "premium") {
    return res.status(403).json({
      success: false,
      message: "This feature requires a Premium subscription.",
      upgrade_required: true,
    });
  }
  next();
};

module.exports = { protect, premiumOnly };
