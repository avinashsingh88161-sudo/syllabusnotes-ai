/**
 * routes/notes.js — Notes management, AI doubt solving & interactive quiz routes
 */
const express = require("express");
const router = express.Router();
const { protect, premiumOnly } = require("../middleware/auth");
const { getAll, getOne, askAi, getQuiz, downloadPDF, deleteOne } = require("../controllers/notesController");

router.get("/",                     protect,              getAll);
router.post("/:id/ask-ai",          protect,              askAi);
router.get("/:id/quiz",             protect,              getQuiz);
router.get("/:id/download",         protect, premiumOnly, downloadPDF);
router.get("/:id",                  protect,              getOne);
router.delete("/:id",               protect,              deleteOne);

module.exports = router;
