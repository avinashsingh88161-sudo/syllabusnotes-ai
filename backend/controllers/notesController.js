/**
 * controllers/notesController.js — Retrieve and manage generated notes, Ask-AI Doubt Solver & Quiz Generator
 */

const path = require("path");
const fs = require("fs");
const File = require("../models/File");
const { askNoteDoubt, generateQuizAndViva, generateTop15ExamQuestions } = require("../services/aiService");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes — All notes for logged-in user (dashboard list)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      File.find({ user_id: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-extracted_text"), // don't send huge OCR text in list
      File.countDocuments({ user_id: req.user._id }),
    ]);

    res.json({
      success: true,
      data: files,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:id — Single note detail (view generated notes)
// ─────────────────────────────────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "Notes not found." });
    }

    const response = {
      success: true,
      data: {
        id: file._id,
        _id: file._id,
        original_name: file.original_name,
        file_type: file.file_type,
        status: file.status,
        generated_notes: file.generated_notes,
        user_level: file.user_level,
        createdAt: file.createdAt,
        // PDF link only for premium users
        pdf_link: req.user.subscription_status === "premium" ? file.pdf_link : null,
        can_download: req.user.subscription_status === "premium",
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notes/:id/ask-ai — Interactive Doubt Solver
// ─────────────────────────────────────────────────────────────────────────────
exports.askAi = async (req, res, next) => {
  try {
    const { question, mode = "hinglish" } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required." });
    }

    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "Notes not found." });
    }

    const context = file.generated_notes || file.extracted_text || file.original_name;
    const answer = await askNoteDoubt(context, question.trim(), mode);

    res.json({
      success: true,
      answer,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:id/quiz — Interactive Quiz & Viva Generator
// ─────────────────────────────────────────────────────────────────────────────
exports.getQuiz = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "Notes not found." });
    }

    const context = file.generated_notes || file.extracted_text || "";
    const quizData = await generateQuizAndViva(context);

    res.json({
      success: true,
      data: quizData,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:id/exam-questions — Top 15 University Exam Questions & 20-Mark Model Answers
// ─────────────────────────────────────────────────────────────────────────────
exports.getExamQuestions = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "Notes not found." });
    }

    if (file.exam_questions_15 && file.exam_questions_15.questions && file.exam_questions_15.questions.length > 0) {
      return res.json({
        success: true,
        data: file.exam_questions_15,
      });
    }

    const context = file.generated_notes || file.extracted_text || "";
    const examData = await generateTop15ExamQuestions(context, file.extracted_text);

    if (examData && examData.questions && examData.questions.length > 0) {
      await File.findByIdAndUpdate(file._id, { exam_questions_15: examData });
    }

    res.json({
      success: true,
      data: examData,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:id/download — Serve PDF file (premium only)
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadPDF = async (req, res, next) => {
  try {
    if (req.user.subscription_status !== "premium") {
      return res.status(403).json({
        success: false,
        message: "PDF download requires a Premium subscription.",
        upgrade_required: true,
      });
    }

    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file || !file.pdf_path) {
      return res.status(404).json({ success: false, message: "PDF not found." });
    }

    if (!fs.existsSync(file.pdf_path)) {
      return res.status(404).json({ success: false, message: "PDF file missing on server." });
    }

    const downloadName = `${file.original_name.replace(/\.[^/.]+$/, "")}_notes.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = fs.createReadStream(file.pdf_path);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notes/:id — Delete a notes record and its files
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteOne = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: "Notes not found." });
    }

    const toDelete = [file.file_path, file.pdf_path].filter(Boolean);
    for (const p of toDelete) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await file.deleteOne();
    res.json({ success: true, message: "Notes deleted." });
  } catch (err) {
    next(err);
  }
};
