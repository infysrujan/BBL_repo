import { moveInstrumentation } from '../../scripts/scripts.js';

// ── Constants ──────────────────────────────────────────────────────────────────

/** sessionStorage keys shared with mf-results block */
const SESSION = {
  riskLevel: 'mfRiskLevel',
  fxRisk: 'mfFxRisk',
  taxBenefit: 'mfTaxBenefit',
};

/**
 * Block row mapping (matches _mf-questionnaire.json model, rows 0-10 are config):
 *   Row 0   screen1Title       – Screen 1 question text
 *   Row 1   screen1Disclaimer  – Richtext: per-level descriptions shown below tabs
 *   Row 2   screen2Title       – Screen 2 question text
 *   Row 3   screen2Description – Richtext: optional body text on screen 2
 *   Row 4   screen2YesLabel    – Yes CTA label
 *   Row 5   screen2NoLabel     – No CTA label
 *   Row 6   screen3Title       – Screen 3 question text
 *   Row 7   screen3Description – Richtext: optional body text on screen 3
 *   Row 8   screen3YesLabel    – Yes CTA label
 *   Row 9   screen3NoLabel     – No CTA label
 *   Row 10  resultsPageUrl     – aem-content: destination after screen 3 answer
 *   Row 11+ mf-risk-option sub-items — each row: [label] [icon img] [riskValue]
 */
const CONFIG_ROWS = 11;

// ── Row-reading helpers ────────────────────────────────────────────────────────

function readText(row) {
  // Value cell is children[1] for 2-col rows; fall back to any <p> in the row
  return row?.children[1]?.querySelector('p')?.textContent?.trim()
    ?? row?.children[1]?.textContent?.trim()
    ?? row?.querySelector('p')?.textContent?.trim()
    ?? '';
}

function readHtml(row) {
  return row?.children[1]?.innerHTML?.trim()
    ?? row?.querySelector('p')?.outerHTML
    ?? '';
}

function readUrl(row) {
  const anchor = row?.querySelector('a');
  if (anchor) return anchor.href;
  return readText(row);
}

// ── Progress indicator ─────────────────────────────────────────────────────────

function buildProgress(totalSteps) {
  const nav = document.createElement('nav');
  nav.className = 'mfq-progress';
  nav.setAttribute('aria-label', 'Questionnaire progress');
  for (let i = 0; i < totalSteps; i += 1) {
    const dot = document.createElement('span');
    dot.className = `mfq-progress-dot${i === 0 ? ' is-active' : ''}`;
    dot.setAttribute('aria-hidden', 'true');
    nav.appendChild(dot);
  }
  return nav;
}

// ── Screen 1: risk-level tabs ──────────────────────────────────────────────────

function buildScreen1(cfg, riskOptions) {
  const screen = document.createElement('div');
  screen.className = 'mfq-screen mfq-screen-1 mfq-screen-active';
  screen.dataset.screen = '0';

  if (cfg.s1Title) {
    const q = document.createElement('h2');
    q.className = 'mfq-question';
    q.textContent = cfg.s1Title;
    screen.appendChild(q);

    const divider = document.createElement('span');
    divider.className = 'mfq-divider';
    divider.setAttribute('aria-hidden', 'true');
    screen.appendChild(divider);
  }

  const tabs = document.createElement('ul');
  tabs.className = 'mfq-risk-tabs';
  tabs.setAttribute('role', 'list');

  riskOptions.forEach(({ label, iconImg, riskValue }) => {
    const li = document.createElement('li');
    li.className = 'mfq-risk-tab';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.dataset.riskValue = riskValue || label;

    if (iconImg) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'mfq-tab-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      const img = iconImg.cloneNode(true);
      img.removeAttribute('width');
      img.removeAttribute('height');
      iconWrap.appendChild(img);
      li.appendChild(iconWrap);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'mfq-tab-label';
    labelEl.textContent = label;
    li.appendChild(labelEl);

    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.click();
      }
    });

    tabs.appendChild(li);
  });

  screen.appendChild(tabs);

  if (cfg.s1Disclaimer) {
    const disclaimer = document.createElement('div');
    disclaimer.className = 'mfq-disclaimer';
    disclaimer.innerHTML = cfg.s1Disclaimer;
    screen.appendChild(disclaimer);
  }

  return screen;
}

// ── Screens 2 & 3: Yes / No ────────────────────────────────────────────────────

function buildYesNoScreen({
  screenClass, screenIndex, title, description, yesLabel, noLabel,
}) {
  const screen = document.createElement('div');
  screen.className = `mfq-screen ${screenClass}`;
  screen.dataset.screen = String(screenIndex);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'mfq-back-btn';
  backBtn.setAttribute('aria-label', 'Go back to previous step');
  screen.appendChild(backBtn);

  if (title) {
    const q = document.createElement('h2');
    q.className = 'mfq-question';
    q.textContent = title;
    screen.appendChild(q);

    const divider = document.createElement('span');
    divider.className = 'mfq-divider';
    divider.setAttribute('aria-hidden', 'true');
    screen.appendChild(divider);
  }

  if (description) {
    const desc = document.createElement('div');
    desc.className = 'mfq-screen-desc';
    desc.innerHTML = description;
    screen.appendChild(desc);
  }

  const actions = document.createElement('div');
  actions.className = 'mfq-answer-actions';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'mfq-answer-btn mfq-answer-btn-yes';
  yesBtn.textContent = yesLabel || 'Yes';
  yesBtn.dataset.answer = 'yes';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'mfq-answer-btn mfq-answer-btn-no';
  noBtn.textContent = noLabel || 'No';
  noBtn.dataset.answer = 'no';

  actions.appendChild(yesBtn);
  actions.appendChild(noBtn);
  screen.appendChild(actions);

  return screen;
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function decorate(block) {
  // UE duplication guard — same resource path = same block instance re-decorated
  const blockResource = block.dataset.aueResource;
  document.querySelectorAll('.mf-questionnaire.block').forEach((other) => {
    if (other === block) return;
    if (!other.querySelector('.mfq-dialog')) return;
    const otherResource = other.dataset.aueResource;
    if (blockResource && otherResource && otherResource !== blockResource) return;
    other.remove();
  });

  // Remove previously built dialog on re-decoration (UE child-item edits)
  const existing = block.querySelector('.mfq-dialog');
  if (existing) existing.remove();

  // Un-hide source rows from any previous pass before reading
  [...block.children].forEach((row) => row.classList.remove('mfq-source-row'));

  const rows = [...block.children];

  // ── Read config rows 0–10 ──────────────────────────────────────────────────
  const cfg = {
    s1Title: readText(rows[0]),
    s1Disclaimer: readHtml(rows[1]),
    s2Title: readText(rows[2]),
    s2Desc: readHtml(rows[3]),
    s2Yes: readText(rows[4]),
    s2No: readText(rows[5]),
    s3Title: readText(rows[6]),
    s3Desc: readHtml(rows[7]),
    s3Yes: readText(rows[8]),
    s3No: readText(rows[9]),
    resultsUrl: readUrl(rows[10]),
  };

  // ── Read risk-option sub-items from row 11+ ────────────────────────────────
  // Each sub-item row has 3 cells: [label] [icon img] [riskValue]
  const riskOptions = [];
  for (let i = CONFIG_ROWS; i < rows.length; i += 1) {
    const cells = [...rows[i].children];
    const label = cells[0]?.querySelector('p')?.textContent?.trim()
      ?? cells[0]?.textContent?.trim()
      ?? '';
    const iconImg = cells[1]?.querySelector('img') ?? null;
    const riskValue = cells[2]?.querySelector('p')?.textContent?.trim()
      ?? cells[2]?.textContent?.trim()
      ?? label;
    if (label) riskOptions.push({ label, iconImg, riskValue });
  }

  // Move instrumentation attrs from source rows to block for UE editing
  rows.forEach((row) => moveInstrumentation(row, block));

  // Hide authored rows (CSS class + !important prevents UE override)
  rows.forEach((row) => row.classList.add('mfq-source-row'));

  // ── Build dialog ───────────────────────────────────────────────────────────
  const dialog = document.createElement('dialog');
  dialog.className = 'mfq-dialog';
  dialog.setAttribute('aria-modal', 'true');

  // Close button (top-right ×)
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mfq-close';
  closeBtn.setAttribute('aria-label', 'Close questionnaire');
  dialog.appendChild(closeBtn);

  // Progress step dots
  const progress = buildProgress(3);
  dialog.appendChild(progress);

  // Build the three screens
  const screen1 = buildScreen1(cfg, riskOptions);
  const screen2 = buildYesNoScreen({
    screenClass: 'mfq-screen-2',
    screenIndex: 1,
    title: cfg.s2Title,
    description: cfg.s2Desc,
    yesLabel: cfg.s2Yes,
    noLabel: cfg.s2No,
  });
  const screen3 = buildYesNoScreen({
    screenClass: 'mfq-screen-3',
    screenIndex: 2,
    title: cfg.s3Title,
    description: cfg.s3Desc,
    yesLabel: cfg.s3Yes,
    noLabel: cfg.s3No,
  });

  const screensWrap = document.createElement('div');
  screensWrap.className = 'mfq-screens';
  [screen1, screen2, screen3].forEach((s) => screensWrap.appendChild(s));
  dialog.appendChild(screensWrap);

  block.appendChild(dialog);

  // ── Navigation state ───────────────────────────────────────────────────────
  const screens = [screen1, screen2, screen3];
  const dots = [...progress.querySelectorAll('.mfq-progress-dot')];

  function showScreen(index) {
    screens.forEach((s, i) => s.classList.toggle('mfq-screen-active', i === index));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    dialog.scrollTop = 0;
  }

  function reset() {
    screen1.querySelectorAll('.mfq-risk-tab').forEach((t) => t.classList.remove('is-selected'));
    showScreen(0);
  }

  // Screen 1: tab selection → advance to screen 2 with brief visual feedback
  screen1.addEventListener('click', (e) => {
    const tab = e.target.closest('.mfq-risk-tab');
    if (!tab) return;
    screen1.querySelectorAll('.mfq-risk-tab').forEach((t) => t.classList.remove('is-selected'));
    tab.classList.add('is-selected');
    try { sessionStorage.setItem(SESSION.riskLevel, tab.dataset.riskValue); } catch { /* ignore */ }
    setTimeout(() => showScreen(1), 200);
  });

  // Screen 2: Yes/No → advance to screen 3
  screen2.addEventListener('click', (e) => {
    const btn = e.target.closest('.mfq-answer-btn');
    if (!btn) return;
    try { sessionStorage.setItem(SESSION.fxRisk, btn.dataset.answer); } catch { /* ignore */ }
    showScreen(2);
  });

  // Screen 3: Yes/No → redirect to results page
  screen3.addEventListener('click', (e) => {
    const btn = e.target.closest('.mfq-answer-btn');
    if (!btn) return;
    try { sessionStorage.setItem(SESSION.taxBenefit, btn.dataset.answer); } catch { /* ignore */ }
    if (cfg.resultsUrl) window.location.href = cfg.resultsUrl;
  });

  // Back buttons: screen2.back → screen1, screen3.back → screen2
  screen2.querySelector('.mfq-back-btn')?.addEventListener('click', () => showScreen(0));
  screen3.querySelector('.mfq-back-btn')?.addEventListener('click', () => showScreen(1));

  // ── Close handlers ─────────────────────────────────────────────────────────
  function closeModal() {
    dialog.close();
    reset();
  }

  closeBtn.addEventListener('click', closeModal);

  // Click on backdrop (dialog element itself, not its children)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeModal();
  });

  // Native ESC closes dialog — reset state after it closes
  dialog.addEventListener('close', reset);

  // ── Global API ─────────────────────────────────────────────────────────────
  window.mfQuestionnaire = {
    show() {
      reset();
      dialog.showModal();
    },
  };

  // Listen for cross-block / cross-page trigger event
  document.addEventListener('mf:open-questionnaire', () => window.mfQuestionnaire?.show());

  // Auto-open when returning from results page via "Start Over" redirect
  if (new URLSearchParams(window.location.search).has('mf-start-over')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('mf-start-over');
    window.history.replaceState({}, '', url.toString());
    // Defer until after EDS section reveals
    requestAnimationFrame(() => window.mfQuestionnaire?.show());
  }

  showScreen(0);
}
