# 🎓 SyllabusNotes AI — Intelligent Syllabus to Smart Study Notes SaaS Platform

<div align="center">

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node: >=18.0.0](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)
![AI Engine: Gemini 3.5 & OpenAI](https://img.shields.io/badge/AI%20Engine-Gemini%203.5%20%7C%20OpenAI-purple.svg)
![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB-darkgreen.svg)
![PDF: PDFKit Professional](https://img.shields.io/badge/PDF-PDFKit%20Engine-orange.svg)

**Turn any syllabus into structured, university-grade study guides, visual flow diagrams, 1-night revision cheat sheets, interactive MCQs, and real-time AI doubt solving in seconds.**

[🚀 Features](#-key-features) • [🛠️ Tech Stack](#️-tech-stack) • [⚡ Quick Start](#-quick-start-guide) • [📡 API Reference](#-api-endpoints) • [📂 Project Structure](#-project-structure)

</div>

---

## 🌟 Overview

**SyllabusNotes AI** is a full-stack, production-ready AI SaaS platform designed for university students, educators, and lifelong learners. It transforms syllabus PDFs, images, DOCX files, and text documents into publication-grade, unit-wise textbook notes complete with:
- Visual ASCII/blueprint architecture flowcharts
- Runnable code examples with syntax highlights
- AI-predicted 10-mark & 5-mark semester exam questions
- A 1-Night-Before-Exam cheat-sheet rapid revision mode
- A built-in hands-free audio podcast player
- Interactive 5-question quizzes and Viva flashcards
- An adaptive AI Study Tutor supporting both **English & conversational Hinglish**

---

## 🚀 Key Features

### 1. 🔮 AI Predicted Semester Exam Questions
- Automatically analyzes syllabus units to predict **[🔥 95% High Probability - 10 Marks]** and **[⚡ 5-Mark Short Answer]** questions.
- Generates point-by-point model answer frameworks directly inside the study notes and PDF.

### 2. ⚡ "1-Night Before Exam" Fast Revision Mode
- One-click toggle between:
  - **📖 Full In-Depth Notes**: Comprehensive conceptual breakdown, code examples, comparison tables, and viva tips.
  - **⚡ 1-Night Cheat Sheet**: Strips long prose to show only definitions, architecture diagrams, comparison tables, code snippets, and exam questions for rapid 5-minute pre-exam revision.

### 3. 🤖 Adaptive AI Study Tutor (Doubt Solver)
- Slide-out interactive drawer to resolve doubts directly on generated notes.
- **Language Intelligent**: Defaults to crisp, professional English; dynamically switches to friendly Hinglish (with Netflix/Instagram/Zomato analogies) when requested.
- One-click prompt chips: *English Explanation*, *Hinglish Explanation*, *10-Mark Exam Framework*, *Explain Code*, and *Viva Questions*.

### 4. 🧠 Interactive Unit Quiz & Viva Flashcard Engine
- **5-Question MCQ Quiz**: Interactive option selection with instant green/red animations and in-depth explanations.
- **Viva Exam Flashcards**: Interactive 3D flip cards with a *"Reveal Examiner Answer"* toggle for lab and viva preparation.

### 5. 🎙️ Built-in Audio Summary / Podcast Mode
- Hands-free speech synthesis player for listening to notes on the go.
- Full player controls: Play, Pause, Resume, Stop, and multi-speed selector (1.0x, 1.25x, 1.5x, 2.0x).

### 6. 📄 Publication-Grade PDF Generator
- Built with PDFKit featuring geometric cover pages, running headers/footers, and page numbers.
- **Dark IDE Code Boxes**: High-contrast `#0F172A` containers with bright white syntax (`#F8FAFC`) and language badges.
- **Blueprint Architecture Boxes**: `#0B132B` dark containers with `#38BDF8` cyan text for crystal-clear flowcharts.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & Vanilla JavaScript**: Modern ES6+ single-page responsive client.
- **Modern Design System**: Vanilla CSS with curated HSL color tokens, dark ChatGPT-style code containers, and glassmorphism.
- **Typography**: Google Fonts (`Outfit` for geometric headings, `Inter` for body readability, `Fira Code` for monospace).
- **Audio Synthesis**: Native Web Speech Synthesis API.

### Backend
- **Runtime**: Node.js (v18+) with Express.js REST API.
- **Database**: MongoDB with Mongoose ODM (Users, Notes/Files, Subscriptions).
- **Authentication**: JWT (JSON Web Tokens) with HTTP-bearer authentication & bcryptjs password hashing.
- **Document Processing**: `pdf-parse` for PDFs, `mammoth` for DOCX, `tesseract.js` for OCR image extraction.
- **PDF Engine**: PDFKit with custom layout and WinAnsi safe-text encoding.
- **Payments**: Razorpay gateway integration for Premium subscriptions.

### AI Engine
- **Google Gemini API** (`gemini-1.5-flash` / `gemini-2.0-flash` / `gemini-3.5-flash`)
- **OpenAI API** (`gpt-4o-mini`) fallback architecture

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **MongoDB** (Local instance or MongoDB Atlas URI)
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/)) or **OpenAI API Key**

---

### 1. Clone the Repository
```bash
git clone https://github.com/avinashsingh88161-sudo/syllabusnotes-ai.git
cd syllabusnotes-ai
```

---

### 2. Configure Backend Environment
Navigate to the `backend` directory and create your `.env` file:
```bash
cd backend
cp .env.example .env
```
Edit `.env` and fill in your keys:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/syllabus_notes

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Add your Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

### 3. Install Dependencies & Start the Backend
```bash
# In the backend directory:
npm install
npm run dev
```
*Backend will start on `http://localhost:5000` with MongoDB connected.*

---

### 4. Start the Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be live on `http://localhost:3000`.*

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new student account |
| `POST` | `/api/auth/login` | Log in and receive JWT token |
| `GET` | `/api/auth/me` | Get current authenticated user profile |

### 📚 Document & Notes Engine (`/api/notes`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload PDF, image, DOCX, or raw syllabus text |
| `GET` | `/api/notes` | Get all generated notes for logged-in user |
| `GET` | `/api/notes/:id` | Get full notes content, metadata, and processing state |
| `POST` | `/api/notes/:id/ask-ai` | Ask doubt to AI Tutor (Supports English & Hinglish) |
| `GET` | `/api/notes/:id/quiz` | Generate 5 MCQs and 5 Viva Flashcards |
| `GET` | `/api/notes/:id/download` | Download formatted study guide PDF |
| `DELETE` | `/api/notes/:id` | Delete a note and its uploaded files |

### 💳 Subscription & Payments (`/api/subscription`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/subscription/create-order` | Create a Razorpay subscription order |
| `POST` | `/api/subscription/verify-payment` | Verify signature and activate Premium status |

---

## 📂 Project Structure

```text
syllabusnotes-ai/
├── backend/
│   ├── config/             # DB & payment configurations
│   ├── controllers/        # Auth, Notes, Upload & Subscription controllers
│   ├── middleware/         # Auth, Rate limiting & Error handlers
│   ├── models/             # Mongoose schemas (User, File, Subscription)
│   ├── routes/             # Express API routes
│   ├── services/           # AI Service, OCR, Parser & PDFKit generator
│   ├── uploads/            # Temporary storage for uploads & generated PDFs
│   ├── .env.example        # Environment variable template
│   ├── package.json        # Backend dependencies & scripts
│   └── server.js           # Express application entry point
├── frontend/
│   ├── css/
│   │   ├── dashboard.css   # Dashboard layout & sidebar styles
│   │   ├── notes.css       # Notes viewer, dark code boxes & AI drawer
│   │   └── styles.css      # Core design tokens & typography
│   ├── js/
│   │   └── app.js          # Auth client, Markdown parser & syntax colorizer
│   ├── dashboard.html      # Document upload & syllabus management
│   ├── index.html          # Landing page with interactive hero
│   ├── login.html          # Student authentication portal
│   ├── notes.html          # Smart notes viewer, podcast & AI tutor
│   ├── register.html       # Signup page
│   └── package.json        # Frontend dev-server configuration
├── .gitignore              # Git ignore rules (node_modules, .env, uploads)
└── README.md               # Project documentation
```

---

## 📄 License
This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with ❤️ by Avinash Singh for students worldwide.</b>
</div>
