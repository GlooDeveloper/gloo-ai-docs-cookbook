/**
 * Gloo AI Search - Frontend
 *
 * A simple frontend that calls the proxy server for search and RAG.
 * Works with any language's proxy server running on localhost.
 */

const API_BASE = "http://localhost:3000";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const limitSelect = document.getElementById("limitSelect");
const searchBtn = document.getElementById("searchBtn");
const ragBtn = document.getElementById("ragBtn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");
const ragResponseEl = document.getElementById("ragResponse");
const ragContentEl = document.getElementById("ragContent");
const ragSourcesEl = document.getElementById("ragSources");

function showLoading(message) {
  loadingEl.querySelector("p").textContent = message || "Searching...";
  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  ragResponseEl.classList.add("hidden");
}

function hideLoading() {
  loadingEl.classList.add("hidden");
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function renderResults(data) {
  if (!data.data || data.data.length === 0) {
    resultsEl.innerHTML = '<div class="no-results">No results found.</div>';
    return;
  }

  const countHtml = `<div class="result-count">Found ${data.data.length} results</div>`;

  const cardsHtml = data.data
    .map((result) => {
      const props = result.properties || {};
      const meta = result.metadata || {};
      const snippet = props.snippet
        ? props.snippet.substring(0, 300) + "..."
        : "";
      const authors = (props.author || []).join(", ") || "Unknown";
      const score = ((meta.certainty || 0) * 100).toFixed(1);

      return `
      <div class="result-card">
        <div class="result-header">
          <span class="result-title">${escapeHtml(props.item_title || "Untitled")}</span>
          <span class="result-score">${score}%</span>
        </div>
        <div class="result-meta">${escapeHtml(props.type || "Unknown")} &middot; ${escapeHtml(authors)}</div>
        <div class="result-snippet">${escapeHtml(snippet)}</div>
      </div>
    `;
    })
    .join("");

  resultsEl.innerHTML = countHtml + cardsHtml;
}

function sanitizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return "#";
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = escapeHtml(sanitizeUrl(url));
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  return html;
}

function renderBasicMarkdown(markdownText) {
  const markdown = String(markdownText || "").replace(/\r\n/g, "\n").trim();
  if (!markdown) {
    return "<p>No response generated.</p>";
  }

  const lines = markdown.split("\n");
  const htmlParts = [];
  const paragraphLines = [];
  let openList = null;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    htmlParts.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    paragraphLines.length = 0;
  }

  function closeList() {
    if (!openList) return;
    htmlParts.push(`</${openList}>`);
    openList = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (openList !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        openList = "ul";
      }
      htmlParts.push(`<li>${renderInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (openList !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        openList = "ol";
      }
      htmlParts.push(`<li>${renderInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    closeList();
    paragraphLines.push(line);
  }

  flushParagraph();
  closeList();

  return htmlParts.join("\n");
}

function sanitizeRenderedHtml(html) {
  if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blockedTags = doc.querySelectorAll("script, style, iframe, object, embed, link, meta");
  blockedTags.forEach((node) => node.remove());

  const allNodes = doc.querySelectorAll("*");
  allNodes.forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
      }
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}

function renderMarkdown(markdownText) {
  const markdown = String(markdownText || "").replace(/\r\n/g, "\n").trim();
  if (!markdown) {
    return "<p>No response generated.</p>";
  }

  if (window.marked && typeof window.marked.parse === "function") {
    const rendered = window.marked.parse(markdown, {
      gfm: true,
      breaks: true,
    });
    return sanitizeRenderedHtml(rendered);
  }

  return renderBasicMarkdown(markdown);
}

function renderRAGResponse(data) {
  const responseText = data.response || "No response generated.";
  const renderedHtml = renderMarkdown(responseText);
  ragContentEl.innerHTML = renderedHtml;

  if (data.sources && data.sources.length > 0) {
    const sourcesHtml = data.sources
      .map((s) => `${escapeHtml(s.title)} (${escapeHtml(s.type)})`)
      .join(", ");
    ragSourcesEl.textContent = "Sources: " + sourcesHtml;
  } else {
    ragSourcesEl.textContent = "";
  }

  ragResponseEl.classList.remove("hidden");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Search handler
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  const limit = limitSelect.value;

  showLoading("Searching...");

  try {
    const response = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    hideLoading();
    renderResults(data);
  } catch (err) {
    hideLoading();
    showError(`Search failed: ${err.message}. Is the proxy server running?`);
  }
});

// RAG handler
ragBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) {
    showError("Please enter a search query first.");
    return;
  }

  const limit = parseInt(limitSelect.value, 10);

  showLoading("Generating AI response...");

  try {
    const response = await fetch(`${API_BASE}/api/search/rag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    hideLoading();
    renderRAGResponse(data);
  } catch (err) {
    hideLoading();
    showError(`RAG request failed: ${err.message}. Is the proxy server running?`);
  }
});
