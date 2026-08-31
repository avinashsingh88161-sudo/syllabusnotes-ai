/**
 * services/pdfService.js — Convert Markdown notes to a world-class academic study guide PDF using PDFKit
 * Features rich visual styling, diagram boxes, dark code containers, and exam callouts.
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Enhanced Markdown parser for academic study notes
 */
function parseMarkdown(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Check for code/diagram block fences
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        sections.push({
          type: codeLang.toLowerCase() === "diagram" ? "diagram_block" : "code_block",
          lang: codeLang,
          code: codeBuffer.join("\n"),
        });
        codeBuffer = [];
        inCodeBlock = false;
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(raw);
      continue;
    }

    if (!line) {
      sections.push({ type: "spacer" });
      continue;
    }

    if (line.startsWith("# ")) {
      sections.push({ type: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      sections.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("### ")) {
      sections.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("#### ")) {
      sections.push({ type: "h4", text: line.slice(5).trim() });
    } else if (line.startsWith("---")) {
      sections.push({ type: "divider" });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      sections.push({ type: "bullet", text: line.slice(2).trim() });
    } else if (/^\d+\.\s+/.test(line)) {
      sections.push({ type: "numbered", text: line.replace(/^\d+\.\s+/, "").trim() });
    } else if (line.startsWith("> ")) {
      sections.push({ type: "quote", text: line.slice(2).trim() });
    } else if (line.startsWith("|")) {
      if (!line.includes("---")) {
        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cells.length > 0) {
          sections.push({ type: "table_row", cells });
        }
      }
    } else {
      sections.push({ type: "paragraph", text: line });
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    sections.push({
      type: codeLang.toLowerCase() === "diagram" ? "diagram_block" : "code_block",
      lang: codeLang,
      code: codeBuffer.join("\n"),
    });
  }

  return sections;
}

/** Strip inline Markdown and non-ASCII emojis that corrupt PDFKit WinAnsi fonts */
function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Strip emojis and 4-byte UTF characters that cause WinAnsi glyph corruption (like Ø=Ü», &-þ)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1FA70}-\u{1FAFF}\u{25A0}-\u{25FF}\u{2B50}\u{2022}\u{2713}\u{2714}\u{2716}\u{2718}\u{2728}\u{274C}\u{2705}\u{FE0F}\u{00A9}\u{00AE}]/gu, "")
    .replace(/[^\x00-\x7F]/g, " ") // Replace remaining non-ASCII with clean space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a World-Class Academic PDF from Markdown notes
 * @param {string} markdownNotes
 * @param {string} fileName - base name (no ext)
 * @param {Object} meta - { userName, subject }
 * @returns {Promise<{ pdfPath: string, pdfFileName: string, pageCount: number }>}
 */
async function generatePDF(markdownNotes, fileName, meta = {}) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const pdfFileName = `${fileName}_notes.pdf`;
    const pdfPath = path.join(uploadsDir, pdfFileName);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 45, right: 45 },
      bufferPages: true,
      info: {
        Title: cleanText(meta.subject) || "Smart Study Notes",
        Author: cleanText(meta.userName) || "Syllabus Notes AI",
        Subject: "AI-Generated Comprehensive Study Notes & Diagrams",
        Creator: "Syllabus-to-Notes SaaS",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ─── Modern Color Palette ────────────────────────────────────────────────
    const COLORS = {
      primary: "#3730A3", // Deep Indigo
      primaryAccent: "#4F46E5",
      primaryLight: "#EEF2FF",
      secondary: "#6366F1",
      darkBg: "#0F172A", // Deep Navy / Charcoal
      darkCard: "#1E293B",
      diagramBg: "#0B132B", // Blueprint dark
      diagramBorder: "#0284C7",
      diagramText: "#38BDF8",
      codeBg: "#0F172A", // High contrast dark code editor
      codeHeader: "#1E293B",
      codeBorder: "#334155",
      codeText: "#F8FAFC", // Crisp bright white
      examBg: "#FFFBEB", // Gold / Amber
      examBorder: "#F59E0B",
      examText: "#92400E",
      bodyText: "#1E293B",
      headingDark: "#0F172A",
      muted: "#64748B",
      divider: "#E2E8F0",
      white: "#FFFFFF",
    };

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 90;

    // ─── 1. Ultra-Premium Cover Page ─────────────────────────────────────────
    // Background
    doc.rect(0, 0, pageWidth, pageHeight).fill("#F8FAFC");

    // Geometric Top Header Banner
    doc.rect(0, 0, pageWidth, 210).fill(COLORS.darkBg);
    doc.rect(0, 205, pageWidth, 5).fill(COLORS.secondary);

    // Pill Badge
    doc.roundedRect(pageWidth / 2 - 130, 45, 260, 24, 12).fill(COLORS.primary);
    doc
      .fillColor("#E0E7FF")
      .fontSize(9.5)
      .font("Helvetica-Bold")
      .text("AI-POWERED SMART STUDY GUIDE", 0, 52, { align: "center" });

    // Main Subject Title
    const subjectName = cleanText(meta.subject) || "Comprehensive Subject Notes";
    doc
      .fillColor(COLORS.white)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(subjectName, 45, 90, {
        align: "center",
        width: contentWidth,
      });

    doc
      .fillColor("#94A3B8")
      .fontSize(11)
      .font("Helvetica")
      .text("Complete Unit-Wise Curriculum with Architecture Diagrams & Code", 45, doc.y + 8, {
        align: "center",
      });

    // Student & Exam Details Card
    const cardY = 245;
    doc.roundedRect(60, cardY, pageWidth - 120, 115, 8).fill(COLORS.white).strokeColor(COLORS.divider).stroke();
    doc.roundedRect(60, cardY, 6, 115, 3).fill(COLORS.primaryAccent);

    doc.fillColor(COLORS.headingDark).fontSize(12).font("Helvetica-Bold");
    doc.text("Study Guide Information", 85, cardY + 16);

    doc.fontSize(10).font("Helvetica").fillColor(COLORS.bodyText);
    if (meta.userName) {
      doc.text(`Student:       ${cleanText(meta.userName)}`, 85, cardY + 40);
    }
    doc.text(`Generated:     ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`, 85, cardY + 58);
    doc.text(`Format:        5-Unit Exam Guide with Diagrams & Code`, 85, cardY + 76);
    doc.text(`Platform:      Syllabus Notes AI`, 85, cardY + 94);

    // 4 Key Pillars Grid Card
    const pillY = cardY + 140;
    doc.roundedRect(60, pillY, pageWidth - 120, 125, 8).fill("#F1F5F9").strokeColor("#E2E8F0").stroke();

    doc.fillColor(COLORS.primary).fontSize(11).font("Helvetica-Bold").text("WHAT IS INCLUDED IN THIS GUIDE:", 85, pillY + 14);
    
    doc.fillColor(COLORS.bodyText).fontSize(9.5).font("Helvetica");
    doc.text("[*] Visual Architecture & Flow Diagrams -- Clear visual mental models", 85, pillY + 36);
    doc.text("[*] Crystal-Clear Definitions & Concepts -- Simple intuitive language", 85, pillY + 56);
    doc.text("[*] Working Code Examples & Case Studies -- Fully annotated syntax", 85, pillY + 76);
    doc.text("[*] Exam Tips & Predicted Questions -- High-yield semester questions", 85, pillY + 96);

    // Cover Page Footer
    doc
      .fillColor(COLORS.muted)
      .fontSize(8.5)
      .font("Helvetica")
      .text("Syllabus Notes AI -- For personal study and semester exam preparation.", 45, pageHeight - 35, {
        align: "center",
      });

    // ─── 2. Content Pages ────────────────────────────────────────────────────
    doc.addPage();

    function checkPageOverflow(requiredHeight = 50) {
      if (doc.y + requiredHeight > pageHeight - 60) {
        doc.addPage();
        doc.y = 55;
      }
    }

    const sections = parseMarkdown(markdownNotes);
    let bulletIndex = 0;

    for (const section of sections) {
      switch (section.type) {
        case "h1":
          checkPageOverflow(80);
          doc.moveDown(0.5);
          doc
            .fillColor(COLORS.primary)
            .fontSize(18)
            .font("Helvetica-Bold")
            .text(cleanText(section.text), 45, doc.y, { width: contentWidth });
          doc.moveDown(0.2);
          doc
            .moveTo(45, doc.y)
            .lineTo(pageWidth - 45, doc.y)
            .lineWidth(2)
            .strokeColor(COLORS.secondary)
            .stroke();
          doc.moveDown(0.5);
          break;

        case "h2":
          if (doc.y > 100) {
            checkPageOverflow(110);
          }
          doc.moveDown(0.6);
          const unitBoxY = doc.y;
          doc.roundedRect(45, unitBoxY, contentWidth, 32, 5).fill(COLORS.primary);
          doc.roundedRect(45, unitBoxY, 6, 32, 3).fill(COLORS.secondary);
          doc
            .fillColor(COLORS.white)
            .fontSize(12)
            .font("Helvetica-Bold")
            .text(`  ${cleanText(section.text)}`, 55, unitBoxY + 9, { width: contentWidth - 20 });
          doc.y = unitBoxY + 40;
          break;

        case "h3":
          checkPageOverflow(60);
          doc.moveDown(0.5);
          const topicY = doc.y;
          doc
            .fillColor(COLORS.headingDark)
            .fontSize(11.5)
            .font("Helvetica-Bold")
            .text(cleanText(section.text), 45, topicY, { width: contentWidth });
          doc.moveDown(0.2);
          doc
            .moveTo(45, doc.y)
            .lineTo(260, doc.y)
            .lineWidth(1.2)
            .strokeColor(COLORS.primaryAccent)
            .stroke();
          doc.moveDown(0.4);
          break;

        case "h4": {
          checkPageOverflow(40);
          doc.moveDown(0.3);
          const heading = cleanText(section.text);
          let badgeColor = COLORS.primaryAccent;
          if (heading.includes("Definition")) badgeColor = COLORS.primary;
          else if (heading.includes("Diagram")) badgeColor = "#0284C7";
          else if (heading.includes("Code") || heading.includes("Example")) badgeColor = "#0D9488";
          else if (heading.includes("Advantages") || heading.includes("Disadvantages")) badgeColor = "#7C3AED";
          else if (heading.includes("Exam") || heading.includes("Viva") || heading.includes("Predicted")) badgeColor = "#D97706";

          if (heading.includes("Predicted") || heading.includes("Probability")) {
            const predY = doc.y;
            doc.roundedRect(45, predY, contentWidth, 24, 4).fill("#FEF3C7").strokeColor("#F59E0B").stroke();
            doc.fillColor("#92400E").fontSize(9.5).font("Helvetica-Bold").text(`  [ EXAM FOCUS ] ${heading}`, 50, predY + 7);
            doc.y = predY + 30;
          } else {
            doc
              .fillColor(badgeColor)
              .fontSize(10.5)
              .font("Helvetica-Bold")
              .text(heading, 45, doc.y, { width: contentWidth });
            doc.moveDown(0.2);
          }
          break;
        }

        case "diagram_block": {
          const cleanDiag = (section.code || "").replace(/\t/g, "  ");
          const lines = cleanDiag.split("\n");
          const diagHeight = lines.length * 10 + 36;
          checkPageOverflow(Math.min(diagHeight, 220));

          const startY = doc.y;
          const availableHeight = pageHeight - startY - 55;
          const boxHeight = Math.min(diagHeight, availableHeight);

          // Blueprint Dark Diagram Box
          doc.roundedRect(45, startY, contentWidth, boxHeight, 6).fill(COLORS.diagramBg).strokeColor(COLORS.diagramBorder).stroke();

          // Header Tag
          doc.roundedRect(45, startY, contentWidth, 20, 6).fill("#0369A1");
          doc.rect(45, startY + 15, contentWidth, 5).fill("#0369A1");
          doc.fillColor(COLORS.white).fontSize(8).font("Helvetica-Bold").text("  [ ARCHITECTURE / FLOW DIAGRAM ]", 52, startY + 5);

          // Monospace Diagram Lines
          doc
            .fillColor(COLORS.diagramText)
            .fontSize(7.5)
            .font("Courier")
            .text(cleanDiag, 52, startY + 24, {
              width: contentWidth - 14,
              lineGap: 1.2,
            });

          doc.y = startY + boxHeight + 8;
          break;
        }

        case "code_block": {
          const cleanCode = (section.code || "").replace(/\t/g, "  ");
          const lines = cleanCode.split("\n");
          const codeHeight = lines.length * 11 + 34;
          checkPageOverflow(Math.min(codeHeight, 220));

          const startY = doc.y;
          const availableHeight = pageHeight - startY - 55;
          const boxHeight = Math.min(codeHeight, availableHeight);

          // Charcoal High-Contrast Code Editor Box
          doc.roundedRect(45, startY, contentWidth, boxHeight, 6)
            .fill(COLORS.codeBg)
            .strokeColor(COLORS.codeBorder)
            .lineWidth(1)
            .stroke();

          // Header Bar
          const langTag = (section.lang || "SOURCE CODE").toUpperCase();
          doc.roundedRect(45, startY, contentWidth, 20, 6).fill(COLORS.codeHeader);
          doc.rect(45, startY + 15, contentWidth, 5).fill(COLORS.codeHeader);
          doc.fillColor("#38BDF8").fontSize(8).font("Helvetica-Bold").text(`  [ CODE EXAMPLE: ${langTag} ]`, 52, startY + 5);

          // Bright White Monospace Code Lines (High contrast for perfect readability)
          doc
            .fillColor(COLORS.codeText)
            .fontSize(8.5)
            .font("Courier")
            .text(cleanCode, 52, startY + 25, {
              width: contentWidth - 14,
              lineGap: 2,
            });

          doc.y = startY + boxHeight + 8;
          break;
        }

        case "bullet":
          checkPageOverflow(24);
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(9.5)
            .font("Helvetica")
            .text(`-  ${cleanText(section.text)}`, 55, doc.y, {
              width: contentWidth - 10,
              lineGap: 2,
            });
          doc.moveDown(0.2);
          break;

        case "numbered":
          checkPageOverflow(24);
          bulletIndex++;
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(9.5)
            .font("Helvetica")
            .text(`${bulletIndex}.  ${cleanText(section.text)}`, 55, doc.y, {
              width: contentWidth - 10,
              lineGap: 2,
            });
          doc.moveDown(0.2);
          break;

        case "paragraph":
          checkPageOverflow(28);
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(9.5)
            .font("Helvetica")
            .text(cleanText(section.text), 45, doc.y, {
              width: contentWidth,
              align: "left",
              lineGap: 3,
            });
          doc.moveDown(0.3);
          break;

        case "quote": {
          checkPageOverflow(36);
          const quoteY = doc.y;
          doc.roundedRect(45, quoteY, contentWidth, 26, 4).fill(COLORS.primaryLight);
          doc.rect(45, quoteY, 4, 26).fill(COLORS.primaryAccent);
          doc
            .fillColor(COLORS.headingDark)
            .fontSize(9)
            .font("Helvetica-Oblique")
            .text(cleanText(section.text), 56, quoteY + 7, {
              width: contentWidth - 20,
            });
          doc.y = quoteY + 32;
          break;
        }

        case "table_row": {
          checkPageOverflow(22);
          const cols = section.cells || [];
          if (cols.length > 0) {
            const colWidth = contentWidth / cols.length;
            const startX = 45;
            const tableY = doc.y;

            cols.forEach((cellText, idx) => {
              doc
                .fillColor(COLORS.bodyText)
                .fontSize(8.5)
                .font("Helvetica")
                .text(cleanText(cellText), startX + idx * colWidth, tableY, {
                  width: colWidth - 8,
                  align: "left",
                });
            });
            doc.y = tableY + 16;
          }
          break;
        }

        case "divider":
          checkPageOverflow(20);
          doc.moveDown(0.3);
          doc
            .moveTo(45, doc.y)
            .lineTo(pageWidth - 45, doc.y)
            .lineWidth(0.6)
            .strokeColor(COLORS.divider)
            .stroke();
          doc.moveDown(0.4);
          bulletIndex = 0;
          break;

        case "spacer":
          doc.moveDown(0.2);
          break;

        default:
          break;
      }
    }

    // ─── 3. Header & Footer on all Content Pages ─────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Running Top Header
      doc.rect(0, 0, pageWidth, 4).fill(COLORS.primaryAccent);
      doc
        .fillColor(COLORS.muted)
        .fontSize(7.5)
        .font("Helvetica")
        .text(
          `Syllabus Notes AI  |  ${cleanText(meta.subject) || "Smart Study Guide"}`,
          45,
          18,
          { width: contentWidth, align: "left" }
        );
      doc
        .moveTo(45, 30)
        .lineTo(pageWidth - 45, 30)
        .lineWidth(0.5)
        .strokeColor(COLORS.divider)
        .stroke();

      // Running Bottom Footer
      doc
        .moveTo(45, pageHeight - 32)
        .lineTo(pageWidth - 45, pageHeight - 32)
        .lineWidth(0.5)
        .strokeColor(COLORS.divider)
        .stroke();

      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .font("Helvetica")
        .text(`Page ${i + 1} of ${range.count}`, 45, pageHeight - 24, {
          align: "center",
          width: contentWidth,
        });
    }

    doc.end();

    stream.on("finish", () => {
      console.log(`✅ PDF generated successfully: ${pdfFileName} (${range.count} pages)`);
      resolve({ pdfPath, pdfFileName, pageCount: range.count });
    });
    stream.on("error", reject);
  });
}

module.exports = { generatePDF };
