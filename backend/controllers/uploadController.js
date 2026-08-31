/**
 * controllers/uploadController.js
 * POST /api/upload — Accept file, run OCR + AI, save result
 */

const path = require("path");
const fs = require("fs");
const File = require("../models/File");
const User = require("../models/User");
const { extractText } = require("../services/ocrService");
const { generateNotes } = require("../services/aiService");
const { generatePDF } = require("../services/pdfService");

const FREE_UPLOAD_LIMIT = parseInt(process.env.FREE_UPLOAD_LIMIT) || 3;

exports.uploadFile = async (req, res, next) => {
  let fileDoc = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const user = req.user;

    // ── Free tier limit check ────────────────────────────────────────────────
    await user.resetUploadCountIfNewMonth();
    if (user.subscription_status === "free" && user.upload_count >= FREE_UPLOAD_LIMIT) {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: `Free plan allows ${FREE_UPLOAD_LIMIT} uploads per month. Upgrade to Premium for unlimited uploads.`,
        upgrade_required: true,
      });
    }

    // ── Determine file type ──────────────────────────────────────────────────
    const mimeType = req.file.mimetype;
    let fileType = "doc";
    if (mimeType === "application/pdf") fileType = "pdf";
    else if (mimeType.startsWith("image/")) fileType = "image";

    // ── Create DB record with status "uploaded" ──────────────────────────────
    fileDoc = await File.create({
      user_id: user._id,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_type: fileType,
      file_size: req.file.size,
      file_path: req.file.path,
      user_level: user.level,
      status: "uploaded",
    });

    // ── Immediately respond so client shows progress ─────────────────────────
    res.status(202).json({
      success: true,
      message: "File uploaded. Processing started.",
      file_id: fileDoc._id,
    });

    // ── Async pipeline (runs after response is sent) ─────────────────────────
    processFile(fileDoc, req.file, user).catch((err) => {
      console.error("❌ Pipeline error:", err.message);
    });

  } catch (err) {
    // Clean up orphaned file if DB write failed
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
};

/**
 * Background processing pipeline: OCR → AI → PDF
 */
async function processFile(fileDoc, file, user) {
  try {
    // 1. OCR
    await File.findByIdAndUpdate(fileDoc._id, { status: "ocr_processing" });
    const extractedText = await extractText(file.path, file.mimetype);

    await File.findByIdAndUpdate(fileDoc._id, {
      extracted_text: extractedText,
      status: "ai_processing",
    });

    // 2. AI Notes Generation
    const { notes, tokensUsed } = await generateNotes(extractedText, user.level);

    await File.findByIdAndUpdate(fileDoc._id, {
      generated_notes: notes,
      ai_tokens_used: tokensUsed,
      status: "pdf_generating",
    });

    // 3. PDF Generation
    const baseName = path.basename(file.filename, path.extname(file.filename));
    let subjectTitle = user.subject || "";
    const firstLineMatch = (notes || "").match(/^#\s+(.+)$/m);
    if (firstLineMatch && firstLineMatch[1]) {
      subjectTitle = firstLineMatch[1].trim();
    }
    if (!subjectTitle) {
      subjectTitle = path.basename(file.originalname, path.extname(file.originalname));
    }

    const { pdfFileName, pageCount } = await generatePDF(notes, baseName, {
      userName: user.name,
      subject: subjectTitle,
    });

    const pdfLink = `/uploads/${pdfFileName}`;

    // 4. Mark complete and increment user's upload count
    await File.findByIdAndUpdate(fileDoc._id, {
      pdf_path: path.join(__dirname, "../uploads", pdfFileName),
      pdf_link: pdfLink,
      status: "completed",
    });

    await User.findByIdAndUpdate(user._id, { $inc: { upload_count: 1 } });

    console.log(`✅ File ${fileDoc._id} processed successfully`);
  } catch (err) {
    await File.findByIdAndUpdate(fileDoc._id, {
      status: "error",
      error_message: err.message,
    });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/upload/status/:fileId — Poll processing status
// ─────────────────────────────────────────────────────────────────────────────
exports.getStatus = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "File not found." });
    }

    const STATUS_LABELS = {
      uploaded: "File received",
      ocr_processing: "Reading document...",
      ai_processing: "Generating smart notes...",
      pdf_generating: "Creating PDF...",
      completed: "Ready!",
      error: "Processing failed",
    };

    res.json({
      success: true,
      file_id: file._id,
      status: file.status,
      status_label: STATUS_LABELS[file.status],
      error_message: file.error_message,
      // Only expose notes/pdf link once complete
      ...(file.status === "completed" && {
        generated_notes: file.generated_notes,
        pdf_link: file.pdf_link,
        original_name: file.original_name,
      }),
    });
  } catch (err) {
    next(err);
  }
};
