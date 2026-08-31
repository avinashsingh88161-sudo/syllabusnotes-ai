/**
 * routes/upload.js
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const uploadMiddleware = require("../middleware/upload");
const { uploadFile, getStatus } = require("../controllers/uploadController");

// POST /api/upload — upload a syllabus file
router.post("/", protect, uploadMiddleware.single("file"), uploadFile);

// GET /api/upload/status/:fileId — poll processing status
router.get("/status/:fileId", protect, getStatus);

module.exports = router;
