/**
 * js/app.js — Global utilities
 * API client, auth helpers, toast, modal, security
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const APP_CONFIG = {
  API_BASE: "http://localhost:5000/api",
  TOKEN_KEY: "sn_token",
  USER_KEY:  "sn_user",
};

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const api = {
  _baseUrl: APP_CONFIG.API_BASE,

  /** Get auth headers */
  _headers(extra = {}) {
    const token = auth.getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  },

  /** Generic request wrapper */
  async _request(method, path, body = null, isFormData = false) {
    const opts = {
      method,
      headers: isFormData
        ? { ...(auth.getToken() ? { Authorization: `Bearer ${auth.getToken()}` } : {}) }
        : this._headers(),
    };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    try {
      const res = await fetch(`${this._baseUrl}${path}`, opts);
      const data = await res.json();

      // Auto-logout on 401
      if (res.status === 401) {
        auth.logout();
        return data;
      }
      return data;
    } catch (err) {
      return { success: false, message: "Network error. Please check your connection." };
    }
  },

  get:    (path)        => api._request("GET",    path),
  post:   (path, body)  => api._request("POST",   path, body),
  put:    (path, body)  => api._request("PUT",    path, body),
  delete: (path)        => api._request("DELETE", path),
  upload: (path, formData) => api._request("POST", path, formData, true),

  /** Streaming download (for PDF) */
  async download(path, fileName) {
    const token = auth.getToken();
    const res = await fetch(`${this._baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.message || "Download failed." };
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { success: true };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const auth = {
  getToken: () => localStorage.getItem(APP_CONFIG.TOKEN_KEY),
  getUser:  () => {
    try { return JSON.parse(localStorage.getItem(APP_CONFIG.USER_KEY)); }
    catch { return null; }
  },
  setSession(token, user) {
    localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
    localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
  },
  updateUser(user) {
    localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
  },
  isLoggedIn: () => !!localStorage.getItem(APP_CONFIG.TOKEN_KEY),
  logout() {
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
    localStorage.removeItem(APP_CONFIG.USER_KEY);
    window.location.href = "login.html";
  },

  /** Redirect to dashboard if already logged in */
  redirectIfAuth() {
    if (this.isLoggedIn()) window.location.href = "dashboard.html";
  },

  /** Redirect to login if NOT logged in */
  requireAuth() {
    if (!this.isLoggedIn()) {
      sessionStorage.setItem("redirect_after_login", window.location.href);
      window.location.href = "login.html";
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
const toast = {
  _container: null,
  _icons: { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" },

  _init() {
    if (!this._container) {
      this._container = document.getElementById("toast-container");
      if (!this._container) {
        this._container = document.createElement("div");
        this._container.id = "toast-container";
        document.body.appendChild(this._container);
      }
    }
  },

  show(message, type = "info", duration = 4000) {
    this._init();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${this._icons[type]}</span><span>${message}</span>`;
    el.addEventListener("click", () => this._remove(el));
    this._container.appendChild(el);
    setTimeout(() => this._remove(el), duration);
  },

  _remove(el) {
    el.classList.add("removing");
    setTimeout(() => el.remove(), 300);
  },

  success: (msg, d) => toast.show(msg, "success", d),
  error:   (msg, d) => toast.show(msg, "error",   d),
  info:    (msg, d) => toast.show(msg, "info",    d),
  warning: (msg, d) => toast.show(msg, "warning", d),
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
const modal = {
  _current: null,

  show(htmlContent, options = {}) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${options.title || ""}</h3>
          <button class="modal-close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${htmlContent}</div>
      </div>`;

    overlay.querySelector(".modal-close").onclick = () => this.close();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) this.close(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    this._current = overlay;
    return overlay;
  },

  close() {
    if (this._current) {
      this._current.remove();
      this._current = null;
      document.body.style.overflow = "";
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY — basic anti-devtools / right-click / print protection
// ─────────────────────────────────────────────────────────────────────────────
const security = {
  init() {
    // Disable right-click on notes content
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".notes-content, .notes-protected")) {
        e.preventDefault();
        toast.warning("Right-click is disabled on note content.");
      }
    });

    // Block Print shortcut
    document.addEventListener("keydown", (e) => {
      const isPrint  = (e.ctrlKey || e.metaKey) && e.key === "p";
      const isDevTools = e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I","J","C"].includes(e.key));
      if (isPrint) {
        e.preventDefault();
        toast.warning("Printing is disabled. Download the PDF to save your notes.");
      }
      // Note: DevTools blocking is a soft deterrent only
    });

    // CSS selection protection on specific zones added via class
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER (ChatGPT-style with code boxes and syntax highlights)
// ─────────────────────────────────────────────────────────────────────────────
function highlightCode(code, lang) {
  let escaped = md._escape(code);
  const l = (lang || "").toLowerCase();

  // HTML / XML
  if (l === "html" || l === "xml" || l === "web" || code.includes("<html") || code.includes("<div") || code.includes("<img")) {
    // HTML Comments
    escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>');
    // HTML Tags & attributes
    escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9\-]+)(\s+[^&gt;]*?)?(&gt;)/g, (match, tag, attrs, close) => {
      let attrFormatted = attrs || "";
      if (attrFormatted) {
        // Attribute names (cyan) and string values (amber)
        attrFormatted = attrFormatted.replace(/([a-zA-Z0-9\-]+)=(&quot;.*?&quot;|".*?"|'.*?'|[^\s&gt;]+)/g, '<span class="tok-attr">$1</span>=<span class="tok-string">$2</span>');
      }
      return `<span class="tok-tag">${tag}</span>${attrFormatted}<span class="tok-tag">${close}</span>`;
    });
    return escaped;
  }

  // Comments (green)
  escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>');
  escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>');
  escaped = escaped.replace(/(#[^\n]*)/g, '<span class="tok-comment">$1</span>');

  // Strings (amber/yellow)
  escaped = escaped.replace(/(&quot;.*?&quot;|".*?"|'.*?')/g, '<span class="tok-string">$1</span>');

  // Preprocessor / Includes (purple)
  escaped = escaped.replace(/(#include\s+&lt;[^&gt;]+&gt;|#define\s+\w+)/g, '<span class="tok-preprocessor">$1</span>');

  // Keywords (magenta / vibrant red)
  const keywords = /\b(int|float|double|char|void|bool|boolean|typedef|struct|class|public|private|protected|static|final|const|new|return|if|else|while|for|do|switch|case|break|continue|try|catch|finally|throw|throws|import|package|abstract|extends|implements|interface|enum|override|printf|scanf|System|out|println|def|function|var|let|const|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|TABLE|CREATE)\b/g;
  escaped = escaped.replace(keywords, '<span class="tok-keyword">$1</span>');

  // Numbers (cyan)
  escaped = escaped.replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');

  return escaped;
}

const md = {
  render(text) {
    if (!text) return "<p><em>No notes available.</em></p>";

    // Extract code blocks with alphanumeric safe placeholders
    const codeBlocks = [];
    let processedText = text.replace(/```([a-zA-Z0-9_\-\+]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      const language = (lang || "code").trim();
      const isDiagram = language.toLowerCase() === "diagram";
      const cleanCodeStr = code.trim();
      const highlighted = isDiagram ? this._escape(cleanCodeStr) : highlightCode(cleanCodeStr, language);
      const title = isDiagram ? "📊 ARCHITECTURE / FLOW DIAGRAM" : `💻 ${(language || "CODE").toUpperCase()}`;
      
      const blockHtml = `
        <div class="code-container ${isDiagram ? "diagram-container" : ""}">
          <div class="code-header">
            <span class="code-lang">${title}</span>
            <button class="code-copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(cleanCodeStr)}')).then(() => toast.success('Code copied!')).catch(() => toast.error('Copy failed'));">📋 Copy Code</button>
          </div>
          <pre class="code-body"><code>${highlighted}</code></pre>
        </div>
      `;
      codeBlocks.push(blockHtml);
      return `%%%CODEBLOCKTOKEN${index}TOKEN%%%`;
    });

    let html = this._escape(processedText);

    // Headings (H1 to H6)
    html = html.replace(/^######\s(.+)$/gm, "<h6>$1</h6>");
    html = html.replace(/^#####\s(.+)$/gm,  "<h5>$1</h5>");
    html = html.replace(/^####\s(.+)$/gm,   "<h4>$1</h4>");
    html = html.replace(/^###\s(.+)$/gm,    "<h3>$1</h3>");
    html = html.replace(/^##\s(.+)$/gm,     "<h2>$1</h2>");
    html = html.replace(/^#\s(.+)$/gm,      "<h1>$1</h1>");

    // Horizontal Rule
    html = html.replace(/^---+$/gm, "<hr>");

    // Blockquote
    html = html.replace(/^&gt;\s(.+)$/gm, "<blockquote>$1</blockquote>");

    // Bold + Italic formatting (support multiple patterns)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/\*([^\*\n]+)\*/g, "<em>$1</em>");
    html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

    // Inline Code
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

    // Tables
    html = html.replace(/(\|.+\|\r?\n)+/g, (match) => {
      const rows = match.trim().split("\n");
      let table = "<table>";
      rows.forEach((row, i) => {
        if (/^\|[-| ]+\|$/.test(row.trim())) return;
        const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1);
        const tag = i === 0 ? "th" : "td";
        table += "<tr>" + cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>";
      });
      table += "</table>";
      return table;
    });

    // Unordered lists (support leading spaces and multiple bullet chars *, -, +)
    html = html.replace(/^\s*[\*\-\+]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\r?\n?)+/g, (m) => `<ul>${m}</ul>`);

    // Ordered lists
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, "<oli>$1</oli>");
    html = html.replace(/(<oli>.*<\/oli>\r?\n?)+/g, (m) => `<ol>${m.replace(/oli/g, "li")}</ol>`);

    // Paragraphs
    html = html.split(/\n\n+/).map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|li|hr|blockquote|table|tr|div|p)\b/i.test(trimmed) || trimmed.includes("%%%CODEBLOCKTOKEN")) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    }).join("\n\n");

    // Restore Code Blocks
    codeBlocks.forEach((block, idx) => {
      html = html.replace(`%%%CODEBLOCKTOKEN${idx}TOKEN%%%`, block);
    });

    return html;
  },

  _escape(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const utils = {
  formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
  },

  formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  },

  fileIcon(type) {
    const icons = { pdf: "📄", image: "🖼️", doc: "📝" };
    return icons[type] || "📎";
  },

  statusBadge(status) {
    const map = {
      uploaded:       { label: "Uploaded",       class: "badge-secondary" },
      ocr_processing: { label: "Reading...",      class: "badge-warning"   },
      ai_processing:  { label: "Generating...",   class: "badge-warning"   },
      pdf_generating: { label: "Building PDF...", class: "badge-warning"   },
      completed:      { label: "Ready",           class: "badge-success"   },
      error:          { label: "Error",           class: "badge-danger"    },
    };
    const s = map[status] || { label: status, class: "badge-secondary" };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  },

  getInitials(name = "") {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  },

  /** Poll a function until it returns true or timeout */
  async poll(fn, intervalMs = 2000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const done = await fn(i);
      if (done) return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  },
};

// Init security on load
document.addEventListener("DOMContentLoaded", () => security.init());

// Expose globally
window.APP_CONFIG = APP_CONFIG;
window.api   = api;
window.auth  = auth;
window.toast = toast;
window.modal = modal;
window.md    = md;
window.utils = utils;
