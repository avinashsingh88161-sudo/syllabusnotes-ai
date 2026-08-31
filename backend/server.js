/**
 * server.js — Main entry point for the Syllabus-to-Notes backend
 * Sets up Express, connects MongoDB, registers all routes, and starts the server.
 */

require("dotenv").config();
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const notesRoutes = require("./routes/notes");
const subscriptionRoutes = require("./routes/subscription");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow frontend to load images
  })
);

// ─── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500", // Live Server (VS Code)
  "http://localhost:5500",
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV === "development" &&
          (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")))
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Global Rate Limiter ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// ─── Static Files (uploaded PDFs served from /uploads) ──────────────────────
// Note: Protected via auth middleware in the notes route
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Root & Health Check ───────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "🎓 SyllabusNotes AI Backend API is Live & Running!",
    status: "Healthy",
    version: "1.0.0",
    docs: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Server is running 🚀", timestamp: new Date() });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/subscription", subscriptionRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database & Server Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/syllabus_notes")
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

module.exports = app;
