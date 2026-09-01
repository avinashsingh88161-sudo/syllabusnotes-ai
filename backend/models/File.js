/**
 * models/File.js — Stores uploaded files and their generated notes
 */

const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    original_name: {
      type: String,
      required: true,
    },
    file_type: {
      type: String, // pdf | image | doc
      required: true,
    },
    file_size: {
      type: Number, // bytes
      default: 0,
    },
    file_path: {
      type: String, // server filesystem path
      required: true,
    },
    // OCR output
    extracted_text: {
      type: String,
      default: "",
    },
    // AI-generated structured notes (Markdown string)
    generated_notes: {
      type: String,
      default: "",
    },
    // Path to generated PDF on disk
    pdf_path: {
      type: String,
      default: null,
    },
    // Public-accessible link for premium download
    pdf_link: {
      type: String,
      default: null,
    },
    // Processing pipeline status
    status: {
      type: String,
      enum: ["uploaded", "ocr_processing", "ai_processing", "pdf_generating", "completed", "error"],
      default: "uploaded",
    },
    error_message: {
      type: String,
      default: null,
    },
    // User's level at the time of processing (affects AI output)
    user_level: {
      type: String,
      enum: ["beginner", "intermediate", "pro"],
      default: "beginner",
    },
    // Token usage for transparency (optional)
    ai_tokens_used: {
      type: Number,
      default: 0,
    },
    // Top 15 High-Yield Exam Questions with 20-Mark Model Answers
    exam_questions_15: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Cached Quiz & Viva data
    quiz_data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast dashboard queries
FileSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model("File", FileSchema);
