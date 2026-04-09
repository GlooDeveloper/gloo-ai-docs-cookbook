/**
 * Smart Resource Recommender — Frontend
 *
 * Calls the proxy server (localhost:3000) which forwards requests to Gloo AI.
 * Three endpoints are used:
 *   POST /api/recommendations/base      → publisher items, metadata only
 *   POST /api/recommendations/verbose   → publisher items, with snippet text
 *   POST /api/recommendations/affiliates → cross-publisher affiliate network
 */

const API_BASE = '';  // Same origin as the proxy server

// DOM references
const form = document.getElementById('query-form');
const queryInput = document.getElementById('query-input');
const searchBtn = document.getElementById('search-btn');
const verboseToggle = document.getElementById('verbose-toggle');
const itemCountSelect = document.getElementById('item-count');
const errorBanner = document.getElementById('error-banner');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');

const publisherSection = document.getElementById('publisher-section');
const publisherResults = document.getElementById('publisher-results');
const publisherModeBadge = document.getElementById('publisher-mode-badge');

const affiliatesSection = document.getElementById('affiliates-section');
const affiliatesResults = document.getElementById('affiliates-results');

// ----- UI helpers --------------------------------------------------------

function showLoading() {
  loading.classList.remove('hidden');
  emptyState.classList.add('hidden');
  publisherSection.classList.add('hidden');
  affiliatesSection.classList.add('hidden');
  errorBanner.classList.add('hidden');
  searchBtn.disabled = true;
}

function hideLoading() {
  loading.classList.add('hidden');
  searchBtn.disabled = false;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function renderRelevance(certainty) {
  const pct = Math.round((certainty ?? 0) * 100);
  return `<span class="relevance-bar" title="${pct}% relevance">
    <span class="relevance-fill" style="width:${pct}%"></span>
    <span class="relevance-label">${pct}%</span>
  </span>`;
}

// ----- Card builders -----------------------------------------------------

function buildPublisherCard(item, verbose) {
  const title = item.item_title || 'Untitled';
  const authors = (item.author || []).join(', ');
  const uuids = item.uuids || [];
  const top = uuids[0] || {};
  const certainty = top.certainty ?? null;
  const section = top.ai_title || '';
  const summary = top.item_summary || '';
  const snippet = top.snippet || '';
  const url = item.item_url || null;

  const authorHtml = authors
    ? `<p class="card-meta">By ${authors}</p>`
    : '';

  const relevanceHtml = certainty !== null
    ? `<div class="card-relevance">${renderRelevance(certainty)}</div>`
    : '';

  const sectionHtml = section
    ? `<p class="card-section">${section}</p>`
    : '';

  // verbose mode: show snippet pull-quote instead of summary
  let bodyHtml = '';
  if (verbose && snippet) {
    const preview = snippet.length > 220 ? snippet.slice(0, 220) + '…' : snippet;
    bodyHtml = `<blockquote class="card-snippet">"${preview}"</blockquote>`;
  } else if (summary) {
    const preview = summary.length > 180 ? summary.slice(0, 180) + '…' : summary;
    bodyHtml = `<p class="card-summary">${preview}</p>`;
  }

  const linkHtml = url
    ? `<a class="card-link" href="${url}" target="_blank" rel="noopener">View resource →</a>`
    : '';

  return `
    <article class="card">
      <h3 class="card-title">${title}</h3>
      ${authorHtml}
      ${relevanceHtml}
      ${sectionHtml}
      ${bodyHtml}
      ${linkHtml}
    </article>`;
}

function buildAffiliateCard(item) {
  const title = item.item_title || 'Untitled';
  const authors = (item.author || []).join(', ');
  const subtitle = item.item_subtitle || '';
  const tradition = item.tradition || '';
  const url = item.item_url || null;

  const authorHtml = authors
    ? `<p class="card-meta">By ${authors}</p>`
    : '';

  const traditionHtml = tradition
    ? `<p class="card-tradition">${tradition}</p>`
    : '';

  const subtitleHtml = subtitle
    ? `<p class="card-summary">${subtitle.length > 160 ? subtitle.slice(0, 160) + '…' : subtitle}</p>`
    : '';

  const linkHtml = url
    ? `<a class="card-link" href="${url}" target="_blank" rel="noopener">View resource →</a>`
    : '';

  return `
    <article class="card card-affiliate">
      <h3 class="card-title">${title}</h3>
      ${authorHtml}
      ${traditionHtml}
      ${subtitleHtml}
      ${linkHtml}
    </article>`;
}

// ----- API calls ---------------------------------------------------------

async function fetchRecommendations(query, itemCount, verbose) {
  const endpoint = verbose
    ? `${API_BASE}/api/recommendations/verbose`
    : `${API_BASE}/api/recommendations/base`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, item_count: itemCount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function fetchAffiliates(query, itemCount) {
  const res = await fetch(`${API_BASE}/api/recommendations/affiliates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, item_count: itemCount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ----- Main handler ------------------------------------------------------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const query = queryInput.value.trim();
  if (!query) return;

  const verbose = verboseToggle.checked;
  const itemCount = parseInt(itemCountSelect.value, 10);

  showLoading();

  try {
    // Fire both requests in parallel
    const [publisherItems, affiliateItems] = await Promise.all([
      fetchRecommendations(query, itemCount, verbose),
      fetchAffiliates(query, itemCount),
    ]);

    hideLoading();

    // Publisher recommendations
    if (publisherItems && publisherItems.length > 0) {
      publisherResults.innerHTML = publisherItems
        .map(item => buildPublisherCard(item, verbose))
        .join('');

      publisherModeBadge.textContent = verbose ? 'With previews' : 'Metadata only';
      publisherModeBadge.className = verbose
        ? 'badge badge-verbose'
        : 'badge badge-base';

      publisherSection.classList.remove('hidden');
    }

    // Affiliate network
    if (affiliateItems && affiliateItems.length > 0) {
      affiliatesResults.innerHTML = affiliateItems
        .map(item => buildAffiliateCard(item))
        .join('');
      affiliatesSection.classList.remove('hidden');
    }

    if (
      (!publisherItems || publisherItems.length === 0) &&
      (!affiliateItems || affiliateItems.length === 0)
    ) {
      emptyState.querySelector('p').textContent =
        'No results found for that query. Try a different topic.';
      emptyState.classList.remove('hidden');
    }

  } catch (err) {
    hideLoading();
    showError(`Error: ${err.message}`);
  }
});

// Re-run the last query when the verbose toggle changes (if there's already a query)
verboseToggle.addEventListener('change', () => {
  if (queryInput.value.trim() && !publisherSection.classList.contains('hidden')) {
    form.dispatchEvent(new Event('submit'));
  }
});
