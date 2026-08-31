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
      process.env.GEMINI_MODEL || "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Requesting AI via Google Gemini (${modelName})...`);
        const model = geminiClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.3,
          },
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const text = response.text();
        if (text && text.length > 50) {
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
        temperature: 0.3,
        max_tokens: 4000,
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

MANDATORY RULES FOR EVERY TOPIC:
1. Organize all topics into standard Units (## Unit 1: <Title>, ## Unit 2: <Title>, etc.).
2. For EVERY single topic (### Topic: <Title>), you MUST strictly provide ALL 6 structured sections with thorough detail:

   - #### 1. 📖 Definition & Core Concept
     Crystal-clear definition explaining the core concept in simple terms, why it is needed, and intuitive mental models.

   - #### 2. 🔍 In-Depth Detailed Explanation & Key Rules
     Comprehensive breakdown of how it works step-by-step. Include bulleted syntax rules, internal mechanisms, and key points.

   - #### 3. 📊 Visual Architecture / Flow Diagram
     Provide a clean, well-aligned ASCII / Text Box-Art diagram illustrating the architecture, lifecycle, memory layout, or workflow.
     Example format:
     \`\`\`diagram
     +-------------------------------------------------------+
     |                 Architecture / Flow                   |
     +-------------------------------------------------------+
     | [ Input Module ] ---> [ Processing Engine ]           |
     |                              |                        |
     |                              v                        |
     |                      [ Output Result ]                |
     +-------------------------------------------------------+
     \`\`\`

   - #### 4. 💻 Practical Code / Runnable Mini-Program Example
     Provide a complete, realistic, commented mini-program in the exact programming language of the syllabus (e.g., C, Java, Python, C++, HTML, SQL).
     - Include exact syntax (e.g., in C: #include <stdio.h>, main(); in Java: public class ...; in HTML: <!DOCTYPE html>).
     - Provide expected output and a 2-line explanation of how the code executes.

   - #### 5. ⚖️ Comparison Table & Advantages/Disadvantages
     - Include a clear Markdown comparison table summarizing key aspects (e.g., | Feature | Approach A | Approach B | OR | Parameter | Details |).
     - **Advantages / Benefits**: 3 distinct bullet points.
     - **Disadvantages / Limitations**: 2 distinct bullet points.

   - #### 6. 💡 Exam Pro-Tips & Viva Questions
     High-yield semester exam takeaway and 1-2 common viva/interview questions with concise answer hints.

3. At the end of each Unit, include a dedicated sub-section:
   - #### 🎯 Unit Predicted University Exam Questions
     - **[🔥 95% High Probability - 10 Marks]**: State the most expected 10-mark semester exam question with a brief 3-point model answer framework.
     - **[⚡ 5-Mark Short Answer]**: State the top 5-mark question and expected key points.

4. Begin with "# <Subject Name>" followed by "## Course Overview".
5. End with "## Summary & Key Takeaways" with a comprehensive master table.
6. Do NOT cut off or give lazy 1-line summaries. Produce complete, high-quality, exam-ready notes with code examples and tables for every topic.`;
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
 * Mock notes fallback with diagrams
 */
function getMockNotes(text, level) {
  let subject = "Computer Science & Programming";
  const lower = (text || "").toLowerCase();
  if (lower.includes("java")) subject = "Java Programming & Object-Oriented Software Design";
  else if (lower.includes("python")) subject = "Python Programming & Data Structures";
  else if (lower.includes("dbms") || lower.includes("database") || lower.includes("sql")) subject = "Database Management Systems (DBMS)";
  else if (lower.includes("os") || lower.includes("operating system")) subject = "Operating Systems & System Architecture";
  else if (lower.includes("web") || lower.includes("html") || lower.includes("javascript")) subject = "Full-Stack Web Development";

  return `# ${subject}

## Course Overview

This comprehensive study guide provides complete, unit-by-unit smart notes designed for university semester exams, viva evaluations, and technical interviews. Every unit covers foundational definitions, deep conceptual explanations, visual architecture diagrams, production-ready code examples, pros & cons, and high-yield exam tips.

> 💡 **Setup Notice**: To generate custom AI notes from your own syllabus automatically, add your **\`GEMINI_API_KEY\`** (free) or **\`OPENAI_API_KEY\`** in the \`backend/.env\` file.

---

## Unit 1: Foundations & Architecture

### Topic: Language Overview & Virtual Machine Architecture

#### 1. 📖 Definition & Core Concept
The runtime environment and compiler architecture provide a platform-independent execution layer. Source code is compiled into intermediate bytecode, which is dynamically translated to machine code by the virtual execution engine.

#### 2. 🔍 In-Depth Detailed Explanation
- **Bytecode Execution**: Enables the "Write Once, Run Anywhere" (WORA) paradigm across diverse hardware operating systems.
- **Memory Subsystems**:
  - **Heap Memory**: Stores dynamic runtime objects and global instances.
  - **Stack Memory**: Manages localized method execution frames, primitive variables, and references.
  - **Garbage Collection (GC)**: Automatic background memory reclamation for unreachable allocated blocks.

#### 3. 📊 Visual Architecture / Flow Diagram
\`\`\`diagram
+-------------------------------------------------------------------------+
|                       JVM ARCHITECTURE & EXECUTION FLOW                 |
+-------------------------------------------------------------------------+
|  [ Java Source (.java) ] ---> [ Java Compiler (javac) ]                 |
|                                         |                               |
|                                         v                               |
|                               [ Bytecode (.class) ]                     |
|                                         |                               |
|       +---------------------------------v-----------------------+       |
|       |                     JVM RUNTIME ENGINE                  |       |
|       |  +--------------------+   +--------------------------+  |       |
|       |  | Class Loader       |-->| JVM Memory Areas         |  |       |
|       |  | (Loading/Linking)  |   | (Heap, Stack, Method)    |  |       |
|       |  +--------------------+   +--------------------------+  |       |
|       |                                 |                       |       |
|       |                                 v                       |       |
|       |                   [ Execution Engine (JIT + GC) ]       |       |
|       +---------------------------------v-----------------------+       |
|                                         |                               |
|                                         v                               |
|                             [ Native Machine Code ]                     |
+-------------------------------------------------------------------------+
\`\`\`

#### 4. 💻 Practical Code / Real-World Example
\`\`\`java
// Demonstrating Basic Structure and Memory Allocation
public class EngineDemo {
    private String engineName;

    public EngineDemo(String name) {
        this.engineName = name; // Allocated on Heap
    }

    public void displayStatus() {
        int localStatus = 200; // Allocated on Stack frame
        System.out.println("Engine: " + engineName + " | Status: " + localStatus);
    }

    public static void main(String[] args) {
        EngineDemo demo = new EngineDemo("Core-V1");
        demo.displayStatus();
    }
}
\`\`\`
*Explanation*: The \`EngineDemo\` instance is dynamically created on the heap, whereas the primitive variable \`localStatus\` resides in the stack frame of \`displayStatus()\`.

#### 5. ⚖️ Comparison Table & Advantages/Disadvantages
| Parameter | Stack Memory | Heap Memory |
|---|---|---|
| Allocation | Static / Compile-time frame | Dynamic at runtime |
| Storage | Local variables & method calls | Objects & Instances |
| Speed | Extremely fast | Slower with GC overhead |

- **Advantages / Benefits**:
  - True platform independence across Windows, Linux, and macOS.
  - Strong memory safety and automatic garbage collection preventing segmentation faults.
  - Rich standard library with built-in networking and multithreading primitives.
- **Disadvantages / Limitations**:
  - Slightly higher initial startup latency due to Just-In-Time (JIT) compilation.
  - Memory consumption is higher compared to low-level compiled languages like C/C++.

#### 6. 💡 Exam Pro-Tips & Viva Questions
- **Important Exam Takeaway**: Always draw the internal JVM/Runtime architecture diagram (Class Loader, Memory Areas, Execution Engine) to score full marks in 10-mark questions.
- **Viva Question**: *What is the difference between JDK, JRE, and JVM?*
  - *Hint*: JVM executes bytecode, JRE contains JVM + core libraries, JDK contains JRE + development tools (javac, debugger).

#### 🎯 Unit Predicted University Exam Questions
- **[🔥 95% High Probability - 10 Marks]**: *Explain JVM Architecture in detail with a neat block diagram, explaining ClassLoader, JVM Memory Areas, and Execution Engine.*
- **[⚡ 5-Mark Short Answer]**: *Differentiate between Stack vs Heap memory allocation with examples.*

---

## Summary & Key Takeaways

| Unit | Primary Focus | Key Exam Concept |
|:-----|:--------------|:-----------------|
| **Unit 1** | Foundations & VM Architecture | JVM Memory Model & Stack vs Heap |

*Generated by Syllabus Notes AI — High Quality Study Guide.*`;
}

module.exports = { generateNotes, askNoteDoubt, generateQuizAndViva };
