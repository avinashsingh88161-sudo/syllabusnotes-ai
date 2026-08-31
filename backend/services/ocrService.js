/**
 * services/ocrService.js — Extract text from uploaded files using Tesseract.js
 *
 * For PDFs: convert each page to image first (using pdf-poppler or similar).
 * Here we support images directly, and for PDFs we use a simple text-extraction
 * fallback. In production, add pdf-poppler or pdfjs-dist for full PDF OCR.
 */

const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");

/**
 * Extract text from an image file using Tesseract
 * @param {string} filePath - absolute path to the image
 * @returns {Promise<string>} - extracted text
 */
async function extractTextFromImage(filePath) {
  console.log("🔍 Running Tesseract OCR on:", path.basename(filePath));
  const result = await Tesseract.recognize(filePath, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        process.stdout.write(`\r   OCR progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  console.log("\n✅ OCR complete");
  return result.data.text.trim();
}

/**
 * Extract text from a PDF using a basic buffer read.
 * For production, swap this with pdfjs-dist or pdf-parse for proper extraction.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractTextFromPDF(filePath) {
  try {
    const pdfLib = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);

    // Support pdf-parse v2 (class-based)
    if (pdfLib.PDFParse) {
      const parser = new pdfLib.PDFParse({ data: dataBuffer });
      await parser.load();
      const res = await parser.getText();
      const text = (typeof res === "string" ? res : res.text || "").trim();
      if (text.length > 20) return text;
    } else if (typeof pdfLib === "function") {
      // Support pdf-parse v1 (function-based)
      const data = await pdfLib(dataBuffer);
      const text = (data.text || "").trim();
      if (text.length > 20) return text;
    }

    throw new Error("PDF text too short — falling back to OCR hint");
  } catch (err) {
    console.warn("⚠️  pdf-parse warning:", err.message);
    return (
      "NOTE: This PDF appears to be image-based or protected. Please upload a clear text PDF, Word doc, or syllabus image."
    );
  }
}

/**
 * Main entry point — routes by file type
 * @param {string} filePath - absolute path to file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>}
 */
async function extractText(filePath, mimeType) {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(filePath);
  }
  if (mimeType.startsWith("image/")) {
    return extractTextFromImage(filePath);
  }
  // DOC/DOCX — very basic: read raw text (production: use mammoth.js)
  try {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (_err) {
    return "DOC/DOCX extraction requires mammoth: npm install mammoth";
  }
}

module.exports = { extractText };
