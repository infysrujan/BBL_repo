import { moveInstrumentation } from '../../scripts/scripts.js';
import { openModal, closeModal } from '../../scripts/modal.js';

// ── sessionStorage keys (shared with mf-comparator-results) ───────────────────
const SESSION = {
  riskLevel: 'mfRiskLevel',
  fxRisk: 'mfFxRisk',
  taxBenefit: 'mfTaxBenefit',
};

// ── Row-reading helpers ────────────────────────────────────────────────────────

function readText(row) {
  return row?.children[1]?.querySelector('p')?.textContent?.trim()
    ?? row?.children[1]?.textContent?.trim()
    ?? '';
}

function readHtml(row) {
  return row?.children[1]?.innerHTML?.trim() ?? '';
}

function readUrl(row) {
  const anchor = row?.querySelector('a');
  if (anchor) return anchor.getAttribute('href') || anchor.textContent.trim();
  return row?.children[1]?.textContent?.trim() ?? '';
}

// ── Build screen 2 / screen 3 modal content ───────────────────────────────────

function buildYesNoContent({
  title, yesLabel, noLabel, disclaimer, onYes, onNo,
}) {
  const wrap = document.createElement('div');
  wrap.className = 'mfq-screen';

  if (title) {
    const h = document.createElement('h2');
    h.className = 'mfq-title';
    h.textContent = title;
    wrap.appendChild(h);

    const divider = document.createElement('span');
    divider.className = 'mfq-divider';
    divider.setAttribute('aria-hidden', 'true');
    wrap.appendChild(divider);
  }

  const actions = document.createElement('div');
  actions.className = 'mfq-actions';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'mfq-btn mfq-btn-yes';
  yesBtn.textContent = yesLabel || 'Yes';
  yesBtn.addEventListener('click', onYes);

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'mfq-btn mfq-btn-no';
  noBtn.textContent = noLabel || 'No';
  noBtn.addEventListener('click', onNo);

  actions.appendChild(yesBtn);
  actions.appendChild(noBtn);
  wrap.appendChild(actions);

  if (disclaimer) {
    const disc = document.createElement('div');
    disc.className = 'mfq-disclaimer';
    disc.innerHTML = disclaimer;
    wrap.appendChild(disc);
  }

  return wrap;
}

// ── Main export ────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const rows = [...block.children];

  // ── Read authored rows ───────────────────────────────────────────────────
  const cfg = {
    screen1Title: readText(rows[0]),
    screen1FragmentPath: readUrl(rows[1]),
    screen1Description: readHtml(rows[2]),
    screen2Title: readText(rows[3]),
    screen2Yes: readText(rows[4]),
    screen2No: readText(rows[5]),
    screen3Title: readText(rows[6]),
    screen3Yes: readText(rows[7]),
    screen3No: readText(rows[8]),
    disclaimer: readHtml(rows[9]),
    resultsUrl: readUrl(rows[10]),
  };

  // Move UE instrumentation to block, hide source rows
  rows.forEach((row) => moveInstrumentation(row, block));
  rows.forEach((row) => row.classList.add('mfq-source-row'));

  // ── Screen 3 opener ──────────────────────────────────────────────────────
  function openScreen3() {
    const content = buildYesNoContent({
      title: cfg.screen3Title,
      yesLabel: cfg.screen3Yes,
      noLabel: cfg.screen3No,
      disclaimer: cfg.disclaimer,
      onYes: () => {
        try { sessionStorage.setItem(SESSION.taxBenefit, 'yes'); } catch { /* ignore */ }
        closeModal(document);
        if (cfg.resultsUrl) window.location.href = cfg.resultsUrl;
      },
      onNo: () => {
        try { sessionStorage.setItem(SESSION.taxBenefit, 'no'); } catch { /* ignore */ }
        closeModal(document);
        if (cfg.resultsUrl) window.location.href = cfg.resultsUrl;
      },
    });

    // Replace modal body content directly (modal is already open)
    const modalBody = document.querySelector('.custom-modal .modal-body');
    if (modalBody) modalBody.replaceChildren(content);
  }

  // ── Screen 2 opener ──────────────────────────────────────────────────────
  function openScreen2() {
    const content = buildYesNoContent({
      title: cfg.screen2Title,
      yesLabel: cfg.screen2Yes,
      noLabel: cfg.screen2No,
      disclaimer: cfg.disclaimer,
      onYes: () => {
        try { sessionStorage.setItem(SESSION.fxRisk, 'yes'); } catch { /* ignore */ }
        openScreen3();
      },
      onNo: () => {
        try { sessionStorage.setItem(SESSION.fxRisk, 'no'); } catch { /* ignore */ }
        openScreen3();
      },
    });

    const modalBody = document.querySelector('.custom-modal .modal-body');
    if (modalBody) modalBody.replaceChildren(content);
  }

  // ── Screen 1 opener ──────────────────────────────────────────────────────
  async function openScreen1() {
    // Load the risk options fragment into the modal
    await openModal(document, cfg.screen1FragmentPath);

    const modalBody = document.querySelector('.custom-modal .modal-body');
    if (!modalBody) return;

    // Append title above fragment content
    const titleEl = document.createElement('h2');
    titleEl.className = 'mfq-title';
    titleEl.textContent = cfg.screen1Title;

    const divider = document.createElement('span');
    divider.className = 'mfq-divider';
    divider.setAttribute('aria-hidden', 'true');

    modalBody.prepend(divider);
    modalBody.prepend(titleEl);

    // Append description below fragment content
    if (cfg.screen1Description) {
      const desc = document.createElement('div');
      desc.className = 'mfq-description';
      desc.innerHTML = cfg.screen1Description;
      modalBody.appendChild(desc);
    }

    // Append disclaimer
    if (cfg.disclaimer) {
      const disc = document.createElement('div');
      disc.className = 'mfq-disclaimer';
      disc.innerHTML = cfg.disclaimer;
      modalBody.appendChild(disc);
    }

    // Wire up risk option card clicks — cards must have data-risk-value attribute
    modalBody.addEventListener('click', (e) => {
      const card = e.target.closest('[data-risk-value]');
      if (!card) return;
      e.preventDefault();
      try {
        sessionStorage.setItem(SESSION.riskLevel, card.dataset.riskValue);
      } catch { /* ignore */ }
      openScreen2();
    });
  }

  // ── Expose global API for trigger buttons ────────────────────────────────
  window.mfQuestionnaire = {
    show: openScreen1,
  };

  document.addEventListener('mf:open-questionnaire', openScreen1);
}
