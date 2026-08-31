/**
 * routes/auth.js
 */
const express = require("express");
const router = express.Router();
const { register, login, getMe, updateProfile } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

// Stricter rate limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, message: "Too many auth attempts. Try again in 15 minutes." },
});

router.post("/register", authLimiter, register);
router.post("/login",    authLimiter, login);
router.get("/me",        protect,     getMe);
router.put("/profile",   protect,     updateProfile);

module.exports = router;
