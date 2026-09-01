/**
 * services/aiService.js — Convert extracted syllabus/text into comprehensive study notes with architecture diagrams.
 * High-speed generation with Google Gemini 3.5 Flash and automatic multi-model failover.
 * Includes Ask-AI Doubt Solver and Interactive Quiz & Viva Generator.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

let geminiClient = null;
let openaiClient = null;

function getClients() {
  if (!geminiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  }
  if (!openaiClient && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== "" && !process.env.OPENAI_API_KEY.includes("your-openai-api-key")) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
  }
  return { geminiClient, openaiClient };
}

/**
 * Call AI completion with multi-model failover
 */
async function callAiCompletionWithFailover(systemPrompt, userPrompt) {
  const { geminiClient, openaiClient } = getClients();

  // 1. Try Gemini with auto-fallback across fast models
  if (geminiClient) {
    const modelsToTry = [
      process.env.GEMINI_MODEL || "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Requesting AI via Google Gemini (${modelName})...`);
        const model = geminiClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const text = response.text();
        if (text && text.length > 200) {
          return { content: text, tokensUsed: 0 };
        }
      } catch (err) {
        console.warn(`⚠️ Model ${modelName} encountered error: ${err.message}. Trying backup model...`);
      }
    }
  }

  // 2. OpenAI fallback
  if (openaiClient) {
    try {
      const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
      console.log(`🤖 Requesting AI via OpenAI (${modelName})...`);
      const completion = await openaiClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 6000,
      });
      const content = completion.choices[0]?.message?.content?.trim() || "";
      const tokensUsed = completion.usage?.total_tokens || 0;
      return { content, tokensUsed };
    } catch (err) {
      console.warn("⚠️ OpenAI error:", err.message);
    }
  }

  return null;
}

/**
 * Build system prompt for high-detail, unit-by-unit syllabus notes with visual diagrams, runnable code, and tables
 */
function buildStudyNotesSystemPrompt(level) {
  const levelGuides = {
    beginner: "Use simple, beginner-friendly language with crystal-clear definitions, step-by-step intuition, and relatable real-world analogies.",
    intermediate: "Use clear technical standard language with practical examples, architectural depth, and edge cases.",
    pro: "Use advanced technical architecture, theoretical insights, performance trade-offs, and industry best practices.",
  };

  return `You are a world-class university professor and textbook author.
Your task is to convert the uploaded syllabus into a complete, comprehensive, multi-unit study guide in Markdown format with clear visual diagrams, runnable code examples, structured tables, and predicted university exam questions.

Target Level: ${level.toUpperCase()}
Style Guide: ${levelGuides[level] || levelGuides.beginner}

CRITICAL MANDATORY RULES:
1. COMPLETE ALL UNITS: Read the syllabus carefully and identify ALL units (e.g., Unit 1 / Unit-I, Unit 2 / Unit-II, Unit 3 / Unit-III, Unit 4 / Unit-IV, Unit 5 / Unit-V). You MUST generate detailed study notes for EVERY SINGLE UNIT found in the syllabus. Never skip any unit or stop early.
2. TITLE ACCURACY: Title the document with the EXACT subject name from the syllabus (e.g., "# BCA-403 Web Design Concepts" or "# Web Technology & Design"). Do NOT substitute with unrelated subjects.
3. FOR EVERY TOPIC UNDER EACH UNIT, STRICTLY PROVIDE ALL 6 STRUCTURED SECTIONS:

   - #### 1. 📖 Definition & Core Concept
     Authoritative, crystal-clear definition explaining why it is needed and core mental models.

   - #### 2. 🔍 In-Depth Detailed Explanation & Key Rules
     Comprehensive step-by-step technical breakdown with syntax rules, internal mechanisms, and key points.

   - #### 3. 📊 Visual Architecture / Flow Diagram
     Provide a clean, well-aligned ASCII / Text Box-Art diagram illustrating the architecture, workflow, or lifecycle.
     Example:
     \`\`\`diagram
     +-------------------------------------------------------+
     |                 Architecture / Flow                   |
     +-------------------------------------------------------+
     | [ Client Request ] ---> [ Web Server / Servlet ]     |
     |                                |                      |
     |                                v                      |
     |                       [ HTML / JSP Response ]         |
     +-------------------------------------------------------+
     \`\`\`

   - #### 4. 💻 Practical Code / Runnable Mini-Program Example
     Provide a complete, realistic code snippet in the EXACT technology of the syllabus (e.g., HTML/CSS/JavaScript/XML/JSP for Web Design, C for C programming, Python for Python, SQL for DBMS).
     - Include expected output and a brief execution explanation.

   - #### 5. ⚖️ Comparison Table & Advantages/Disadvantages
     - Markdown comparison table (| Parameter | Feature A | Feature B |).
     - **Advantages / Benefits**: 3 distinct bullet points.
     - **Disadvantages / Limitations**: 2 distinct bullet points.

   - #### 6. 💡 Exam Pro-Tips & Viva Questions
     High-yield semester exam takeaway and 1-2 viva questions with concise answer hints.

4. At the end of each Unit, include:
   - #### 🎯 Unit Predicted University Exam Questions
     - **[🔥 95% High Probability - 10 Marks]**: 10-mark expected question with 3-point answer outline.
     - **[⚡ 5-Mark Short Answer]**: Top 5-mark short question.

5. Structure:
   - Header: "# <Exact Subject Name>" -> "## Course Overview"
   - Body: All Units ("## Unit 1: ...", "## Unit 2: ...", "## Unit 3: ...", "## Unit 4: ...", "## Unit 5: ...")
   - Footer: "## Summary & Key Takeaways" with a comprehensive master table summarizing all units.`;
}

/**
 * Main note generator: Fast, reliable single-pass generation
 */
async function generateNotes(extractedText, level = "beginner") {
  const { geminiClient, openaiClient } = getClients();

  if (!geminiClient && !openaiClient) {
    console.log("ℹ️  No API key configured — returning mock notes");
    return { notes: getMockNotes(extractedText, level), tokensUsed: 0 };
  }

  const systemPrompt = buildStudyNotesSystemPrompt(level);
  const userPrompt = `Here is the uploaded syllabus / document text. Generate complete, unit-by-unit comprehensive notes with visual diagrams, runnable code examples, comparison tables, and predicted exam questions for every unit:\n\n${extractedText.slice(0, 25000)}`;

  try {
    const res = await callAiCompletionWithFailover(systemPrompt, userPrompt);
    if (res && res.content && res.content.length > 200) {
      console.log(`✅ AI Notes generated successfully (${res.content.length} characters)`);
      return { notes: res.content, tokensUsed: res.tokensUsed || 0 };
    }
  } catch (err) {
    console.error("❌ AI generation error:", err.message);
  }

  console.log("⚠️ Fallback to structured study notes");
  return { notes: getMockNotes(extractedText, level), tokensUsed: 0 };
}

/**
 * Interactive Ask-AI Doubt Solver on Notes (Adaptive English / Hinglish / Exam Mode)
 */
async function askNoteDoubt(noteContext, question, mode = "auto") {
  const systemPrompt = `You are an expert AI Study Tutor and Academic Mentor for university students.

Language and Communication Rules:
1. DEFAULT LANGUAGE: Respond in clear, articulate, professional, and easy-to-understand English by default.
2. HINDI / HINGLISH: If the student asks their question in Hindi/Hinglish, OR explicitly asks "Hindi me samjhao", "Hinglish me batao", "explain in Hindi/Hinglish", OR mode is "hinglish", then respond in friendly, conversational Hinglish with relatable real-world analogies (like Instagram, Zomato, UPI, Netflix).
3. EXAM READINESS: When asked for exam questions or frameworks, provide structured points, clear definitions, diagrams, and code snippets to help the student score full marks.
4. Always match the exact language requested by the student.
5. Format your output cleanly with Markdown headings, bullet points, and code blocks.`;

  const userPrompt = `Context from Study Notes:
"""
${(noteContext || "").slice(0, 8000)}
"""

Student's Question:
${question}

Mode: ${mode}

Provide a direct, helpful, and beautifully formatted response.`;

  const res = await callAiCompletionWithFailover(systemPrompt, userPrompt);
  if (res && res.content) {
    return res.content;
  }
  return "I could not process your query at this moment. Please try again.";
}

/**
 * Generate Interactive 5 MCQs and 5 Viva Flashcards from Notes
 */
async function generateQuizAndViva(noteText) {
  const systemPrompt = `You are a university exam creator. Create an interactive 5-question multiple choice quiz (MCQ) and 5 Viva/Interview Flashcards from the provided study notes.
Return ONLY a valid JSON object matching this schema:
{
  "quiz": [
    {
      "id": 1,
      "question": "Question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief 1-line reason why this is correct."
    }
  ],
  "viva": [
    {
      "id": 1,
      "question": "Viva Question text...",
      "answerHint": "Concise answer hint for viva evaluation."
    }
  ]
}`;

  const userPrompt = `Study Notes:\n\"\"\"\n${(noteText || "").slice(0, 10000)}\n\"\"\"\nGenerate 5 MCQs and 5 Viva Flashcards.`;

  const res = await callAiCompletionWithFailover(systemPrompt, userPrompt);
  if (res && res.content) {
    try {
      const match = res.content.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      const cleanJson = res.content.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.warn("Could not parse AI quiz JSON, generating fallback:", e.message);
    }
  }

  // Fallback Quiz & Viva
  return {
    quiz: [
      {
        id: 1,
        question: "Which of the following is an advantage of structured modular programming?",
        options: ["High Code Reusability", "Tightly Coupled Code", "Higher Memory Leak", "Complex Execution"],
        correctIndex: 0,
        explanation: "Modular programming promotes code reusability, maintenance, and isolation of bugs."
      },
      {
        id: 2,
        question: "Where are dynamic runtime objects allocated in memory?",
        options: ["Heap Memory", "Stack Frame", "Registers", "ROM"],
        correctIndex: 0,
        explanation: "Heap memory manages dynamic allocations, while stack memory manages execution frames."
      }
    ],
    viva: [
      {
        id: 1,
        question: "What is the primary difference between Stack and Heap memory?",
        answerHint: "Stack is fast, contiguous, and auto-managed for function calls; Heap is flexible for dynamic objects."
      },
      {
        id: 2,
        question: "Why are Interfaces used in software architecture?",
        answerHint: "To achieve 100% abstraction, loose coupling, and multiple inheritance contracts."
      }
    ]
  };
}

/**
 * Generate 15 Most Important Semester Exam Questions with 20-Mark Master Model Answers
 */
async function generateTop15ExamQuestions(noteText, syllabusText = "") {
  const systemPrompt = `You are a chief university semester examiner and curriculum evaluator.
Analyze the syllabus and study notes to generate exactly 15 Most Important & High-Probability University Exam Questions distributed evenly across all units (e.g., 3 questions per unit for 5 units, or distributed proportionally).

For EVERY single question, you MUST provide an exhaustive, 20-mark university exam standard model answer that guarantees full 20/20 marks for a student.

Return ONLY a valid JSON object matching this schema:
{
  "subject": "Subject Name",
  "questions": [
    {
      "id": 1,
      "unit": "Unit 1: <Unit Name>",
      "question": "Full University Exam Question Text...",
      "weightage": "20 Marks",
      "probability": "🔥 98% High Probability",
      "modelAnswer": {
        "definition": "Clear, authoritative 3-4 sentence definition and core intuition.",
        "detailedExplanation": "Step-by-step comprehensive theoretical explanation, working principle, and internal mechanism.",
        "diagram": "+-------------------------------------------------------+\\n|               Architecture Flowchart                  |\\n+-------------------------------------------------------+\\n| [ Module A ] ---> [ Processing Engine ] ---> [ Output ] |\\n+-------------------------------------------------------+",
        "codeOrFormula": "Complete runnable code example or mathematical derivation with comments.",
        "comparisonTable": "| Parameter | Approach A | Approach B |\\n|---|---|---|\\n| Speed | Fast | Moderate |",
        "examinerMarkingTips": "Key points the student MUST write to score full 20/20 marks without deductions."
      }
    }
  ]
}`;

  const userPrompt = `Syllabus / Notes Context:
"""
${(noteText || syllabusText || "").slice(0, 16000)}
"""

Generate the Top 15 High-Yield Semester Exam Questions with comprehensive 20-mark model answers in valid JSON format.`;

  const res = await callAiCompletionWithFailover(systemPrompt, userPrompt);
  if (res && res.content) {
    try {
      let raw = res.content.trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) raw = match[0];
      raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

      try {
        return JSON.parse(raw);
      } catch (_firstErr) {
        // Fix unescaped backslashes commonly emitted in ASCII box drawings
        const sanitized = raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        return JSON.parse(sanitized);
      }
    } catch (e) {
      console.warn("Could not parse AI 15 exam questions JSON, falling back:", e.message);
    }
  }

  // Fallback 15 Questions Generator
  return getFallback15ExamQuestions(noteText);
}

function getFallback15ExamQuestions(text = "") {
  const units = ["Unit 1: Core Foundations", "Unit 2: Architecture & Algorithms", "Unit 3: Processing & Management", "Unit 4: Advanced Systems", "Unit 5: Performance & Security"];
  const questions = [];
  let count = 1;

  units.forEach((unitName, uIdx) => {
    for (let q = 1; q <= 3; q++) {
      questions.push({
        id: count,
        unit: unitName,
        question: `Explain the fundamental architecture, operational mechanisms, and design trade-offs of key ${unitName} concepts in detail with block diagrams.`,
        weightage: "20 Marks",
        probability: q === 1 ? "🔥 98% High Probability" : (q === 2 ? "⚡ 90% Expected" : "📌 85% Probable"),
        modelAnswer: {
          definition: `This fundamental concept governs the operational lifecycle, resource management, and execution predictability in modern software and hardware architectures.`,
          detailedExplanation: `1. Principle of Operation: The system partitions execution into distinct sequential and asynchronous phases.\n2. Key Subsystems: Memory management, state handling, synchronization primitives, and fault containment.\n3. Runtime Workflow: Requests are validated, queued, processed through internal pipelines, and emitted as standardized outputs.`,
          diagram: `+-------------------------------------------------------------+\n|                   SYSTEM ARCHITECTURE                       |\n+-------------------------------------------------------------+\n| [ Request / Input ] ---> [ Validation Engine ]              |\n|                                  |                          |\n|                                  v                          |\n|                       [ Core Processing Unit ]              |\n|                                  |                          |\n|                                  v                          |\n|                       [ Persistent State Store ]            |\n+-------------------------------------------------------------+`,
          codeOrFormula: `// Standard Model Implementation Structure\npublic class SystemController {\n    public void executeProcess() {\n        System.out.println("Processing Unit Lifecycle [State: 200 OK]");\n    }\n}`,
          comparisonTable: `| Parameter | Traditional Model | Modern Architecture |\n|:---|:---|:---|\n| Latency | High | Low / Optimized |\n| Memory Overhead | O(N^2) | O(N) Linear |\n| Fault Tolerance | Monolithic Failover | Distributed Resiliency |`,
          examinerMarkingTips: `To score full 20/20 marks: (1) Draw the clear block diagram with input/output flow, (2) List 4 core advantages with bullet points, (3) Write the code implementation with proper comments, and (4) Mention memory/time complexity trade-offs.`
        }
      });
      count++;
    }
  });

  return {
    subject: "Semester Exam Master Guide",
    questions
  };
}

/**
 * Mock notes fallback with diagrams
 */
function getMockNotes(text, level) {
  const lower = (text || "").toLowerCase();
  let subject = "Computer Science & Engineering Notes";
  let isWebDesign = false;

  if (lower.includes("web design") || lower.includes("html") || lower.includes("web technology") || lower.includes("bca-403")) {
    subject = "Web Technology & Design Concepts (BCA-403)";
    isWebDesign = true;
  } else if (lower.includes("dbms") || lower.includes("database") || lower.includes("sql")) {
    subject = "Database Management Systems (DBMS)";
  } else if (lower.includes("python")) {
    subject = "Python Programming & Data Structures";
  } else if (lower.includes("os") || lower.includes("operating system")) {
    subject = "Operating Systems & System Architecture";
  } else if (lower.includes("java") && !lower.includes("javascript")) {
    subject = "Java Programming & Object-Oriented Software Design";
  }

  if (isWebDesign) {
    return `# ${subject}

## Course Overview
This comprehensive study guide covers all 5 units of Web Design & Development (BCA-403), including Protocols, HTML5, CSS3, XML/DTD, Client-side JavaScript, AJAX, and Server-side Web Programming (ASP.NET / JSP).

---

## Unit 1: Introduction to Web & Architecture

### Topic: Web Protocols, Strategies & Project Architecture

#### 1. 📖 Definition & Core Concept
Web Design encompasses the protocols, client-server architectures, markup languages, and scripting environments that enable modern interactive web applications over HTTP/HTTPS protocols.

#### 2. 🔍 In-Depth Detailed Explanation
- **HTTP / HTTPS Protocol**: Stateless request-response protocol running on TCP port 80/443.
- **Web Application Architecture**:
  - **Client Tier**: Web Browser rendering HTML, CSS, JavaScript.
  - **Server Tier**: Application Server (Node, Tomcat, IIS) handling business logic.
  - **Data Tier**: Relational/NoSQL database for persistent storage.

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                    WEB CLIENT-SERVER ARCHITECTURE                       |
+-------------------------------------------------------------------------+
| [ Web Browser ]  === HTTP GET Request ===>  [ Web Server (Nginx/Apache) ]|
| (HTML/CSS/JS)   <== HTTP 200 OK Response ==  [ App Server (Node/JSP)  ]|
|                                                          |              |
|                                                          v              |
|                                                  [ Database (SQL) ]     |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Web Page Structure</title>
</head>
<body>
  <h1>Welcome to Web Design</h1>
  <p>Client-server request/response completed successfully.</p>
</body>
</html>
\`\`\`

#### 5. ⚖️ Comparison Table & Advantages/Disadvantages
| Parameter | Static Web Page | Dynamic Web Application |
|---|---|---|
| Content | Fixed HTML/CSS | Generated on-the-fly via server logic |
| Speed | Extremely fast | Slightly higher processing latency |
| Database | None | Connected to SQL/NoSQL |

- **Advantages**: Standardized global access, cross-platform browser execution, responsive layouts.
- **Disadvantages**: Browser compatibility edge cases, state management overhead over stateless HTTP.

#### 6. 💡 Exam Pro-Tips & Viva Questions
- **Exam Tip**: Always draw the Client-Server Request-Response architecture diagram to score 10 marks.
- **Viva Question**: *What is the difference between HTTP GET and POST?*

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Explain Web Client-Server Architecture and HTTP Request/Response lifecycle with a neat block diagram.*
- **[⚡ 5-Mark Short Answer]**: *Differentiate between Static vs Dynamic websites.*

---

## Unit 2: HTML, Forms, Lists, Tables & CSS Styling

### Topic: Structured Document Markup & Modern CSS Layouts

#### 1. 📖 Definition & Core Concept
HTML (HyperText Markup Language) defines the semantic structure of web content, while CSS (Cascading Style Sheets) dictates visual presentation, typography, and responsive grid layouts.

#### 2. 🔍 In-Depth Detailed Explanation
- **Semantic Tags**: \`<header>\`, \`<nav>\`, \`<section>\`, \`<article>\`, \`<footer>\`.
- **Form Controls**: \`<form action="..." method="POST">\`, \`<input type="text">\`, \`<button>\`.
- **CSS Box Model**: Content + Padding + Border + Margin.

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                           CSS BOX MODEL LAYOUT                          |
+-------------------------------------------------------------------------+
|  +-------------------------------------------------------------------+  |
|  | MARGIN (Outer spacing)                                            |  |
|  |   +-----------------------------------------------------------+   |  |
|  |   | BORDER                                                    |   |  |
|  |   |   +---------------------------------------------------+   |   |  |
|  |   |   | PADDING                                           |   |   |  |
|  |   |   |   +-------------------------------------------+   |   |   |  |
|  |   |   |   | CONTENT (Text / Image / Element)          |   |   |   |  |
|  |   |   |   +-------------------------------------------+   |   |   |  |
|  |   |   +---------------------------------------------------+   |   |  |
|  |   +-----------------------------------------------------------+   |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <style>
    .card { background: #f4f4f4; padding: 20px; border-radius: 8px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="card">
    <h2>HTML Form Example</h2>
    <form action="/submit" method="POST">
      <label>Email:</label>
      <input type="email" name="user_email" required />
      <button type="submit">Submit</button>
    </form>
  </div>
</body>
</html>
\`\`\`

#### 5. ⚖️ Comparison Table & Advantages/Disadvantages
| Parameter | Inline CSS | External CSS |
|---|---|---|
| Scope | Single element | Entire Web Application |
| Maintenance | Hard to manage | Reusable & Centralized |

- **Advantages**: Separation of concerns (Structure vs Presentation), fast caching.
- **Disadvantages**: Specificity conflict bugs if CSS rules overlap.

#### 6. 💡 Exam Pro-Tips & Viva Questions
- **Exam Tip**: Explain the CSS Box Model with a clear nested diagram for 10-mark questions.

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Explain the CSS Box Model in detail with diagrams and code snippets.*

---

## Unit 3: XML, DTD, XML Schemas & Validation

### Topic: Extensible Markup Language & Data Exchange Protocols

#### 1. 📖 Definition & Core Concept
XML (eXtensible Markup Language) is a self-descriptive text format designed to store and transport structured data across platform-independent web systems.

#### 2. 🔍 In-Depth Detailed Explanation
- **Well-Formed XML**: Follows proper nesting, closing tags, and single root element.
- **Valid XML**: Adheres to a defined DTD (Document Type Definition) or XML Schema (XSD).

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                        XML VALIDATION PROCESS                           |
+-------------------------------------------------------------------------+
|  [ XML Document ] ----+                                                 |
|                       |---> [ XML Parser Engine ] ---> [ Valid DOM ]    |
|  [ DTD / XSD Schema ]-+                                                 |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<course>
  <id>BCA-403</id>
  <title>Web Design Concepts</title>
  <units>5</units>
</course>
\`\`\`

#### 5. ⚖️ Comparison Table & Advantages/Disadvantages
| Parameter | DTD | XML Schema (XSD) |
|---|---|---|
| Syntax | Non-XML DTD syntax | Pure XML syntax |
| Data Types | Basic strings | Rich built-in datatypes |

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Differentiate between DTD and XML Schema with validation examples.*

---

## Unit 4: Client-Side JavaScript, DOM & AJAX

### Topic: Dynamic Web Scripting, Event Handling & Asynchronous Calls

#### 1. 📖 Definition & Core Concept
JavaScript is a lightweight, prototype-based scripting language that enables client-side interactive behavior, DOM manipulation, and asynchronous HTTP data fetching via AJAX.

#### 2. 🔍 In-Depth Detailed Explanation
- **DOM (Document Object Model)**: Tree representation of HTML elements.
- **Event Handling**: Listening for user actions (\`onclick\`, \`onsubmit\`, \`onchange\`).
- **AJAX**: Asynchronous JavaScript and XML for updating web pages without full reload.

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                          AJAX ASYNCHRONOUS FLOW                         |
+-------------------------------------------------------------------------+
| [ User Action ] -> [ JS XMLHttpRequest ] -> [ Web Server ]               |
|                           |                         |                   |
|                    (Non-blocking UI)         (DB Query)                 |
|                           v                         v                   |
|                    [ DOM Updated ]  <-- [ JSON Data ]                   |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`javascript
// Event Listener & DOM Update
document.getElementById("btn").addEventListener("click", function() {
  document.getElementById("output").textContent = "Data loaded asynchronously via JS!";
});
\`\`\`

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Explain AJAX architecture and event-driven DOM manipulation with code.*

---

## Unit 5: Server-Side Web Programming (ASP, ASP.NET & JSP)

### Topic: Server-Side Web Logic, JSP Objects & Servlets

#### 1. 📖 Definition & Core Concept
Server-side programming executes business logic on the web server, interacting with databases to generate dynamic HTML responses rendered on the client browser.

#### 2. 🔍 In-Depth Detailed Explanation
- **JSP (JavaServer Pages)**: Blends HTML with Java scriplets, compiling into Servlets at runtime.
- **Implicit JSP Objects**: \`request\`, \`response\`, \`session\`, \`application\`, \`out\`.
- **ASP.NET**: Microsoft framework using C# code-behind and compiled pages.

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                       JSP / SERVLET EXECUTION FLOW                      |
+-------------------------------------------------------------------------+
| [ Browser ] -- (HTTP Request) --> [ Web Container (Tomcat) ]           |
|                                            |                            |
|                                            v                            |
|                                   [ JSP Translation ]                   |
|                                            |                            |
|                                            v                            |
|                                 [ Java Servlet (.class) ]               |
|                                            |                            |
|                                            v                            |
| [ Browser ] <-- (HTML Response) -- [ Response Stream ]                 |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<html>
<body>
  <h2>Server Date & Time: <%= new java.util.Date() %></h2>
</body>
</html>
\`\`\`

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Explain JSP Lifecycle and Servlet compilation in Web Containers with block diagrams.*

---

## Summary & Key Takeaways

| Unit | Primary Focus | Key Exam Concept |
|:-----|:--------------|:-----------------|
| **Unit 1** | Web Protocols & Architecture | Client-Server Lifecycle & HTTP |
| **Unit 2** | HTML, CSS & Forms | CSS Box Model & Forms |
| **Unit 3** | XML, DTD & Schema | DTD vs XSD Validation |
| **Unit 4** | JavaScript & AJAX | DOM Manipulation & Asynchronous Fetch |
| **Unit 5** | Server-Side ASP/JSP | JSP Implicit Objects & Servlet Lifecycle |

*Generated by Syllabus Notes AI — High Quality Study Guide.*`;
  }

  // Generic fallback for any other subject
  return `# ${subject}

## Course Overview
This study guide provides comprehensive unit-by-unit syllabus notes covering all core topics, architecture diagrams, code examples, comparison tables, and predicted exam questions.

---

## Unit 1: Foundations & Architecture
### Topic: Core Concepts & Principles
- Definition, architecture, and working mechanisms.

---

## Unit 2: Systems & Design
### Topic: Structural Components
- Implementation standards and algorithms.

---

## Unit 3: Processing & Execution
### Topic: Runtime Engine
- Execution lifecycle and optimization.

---

## Unit 4: Advanced Systems
### Topic: Integration & Modules
- Enterprise design patterns.

---

## Unit 5: Performance & Security
### Topic: Optimization & Best Practices
- Security standards and evaluation.

*Generated by Syllabus Notes AI.*`;
}

module.exports = { generateNotes, askNoteDoubt, generateQuizAndViva, generateTop15ExamQuestions };
