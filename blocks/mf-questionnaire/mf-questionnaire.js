import { moveInstrumentation } from '../../scripts/scripts.js';
import { openModal, closeModal, createModal } from '../../scripts/utils/modal-helpers.js';
import buildThumbSquareList from '../../scripts/utils/thumb-square-list.js';

// ── sessionStorage keys (shared with mf-comparator-results) ───────────────────
const SESSION = {
  riskLevel: 'mfRiskLevel',
  fxRisk: 'mfFxRisk',
  taxBenefit: 'mfTaxBenefit',
};

// ── Row-reading helpers ────────────────────────────────────────────────────────

// Prefer cell[1] (two-column table), fall back to cell[0] (single-column)
function cell(row) {
  return row?.children[1] ?? row?.children[0];
}

function readText(row) {
  const c = cell(row);
  return c?.querySelector('p')?.textContent?.trim() ?? c?.textContent?.trim() ?? '';
}

function readHtml(row) {
  return cell(row)?.innerHTML?.trim() ?? '';
}

function readUrl(row) {
  const anchor = row?.querySelector('a');
  if (anchor) return anchor.getAttribute('href') || anchor.textContent.trim();
  return cell(row)?.textContent?.trim() ?? '';
}

function readListItems(row) {
  return [...(cell(row)?.querySelectorAll('li') ?? [])].map((li) => li.innerHTML.trim()).filter(Boolean);
}

// Returns { iconEl, label } for each <li> in the risk options row.
// Icon is the decorated <span class="icon ..."> (may have an <img> child after decorateIcons).
function readRiskItems(row) {
  return [...(cell(row)?.querySelectorAll('li') ?? [])].map((li) => {
    const iconEl = li.querySelector('span.icon') ?? null;
    // Label = text content with icon text stripped
    const label = [...li.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join('') || li.textContent.trim();
    return { iconEl, label };
  }).filter(({ label }) => label);
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
  const screen1FragmentPath = readUrl(rows[1]);
  const cfg = {
    screen1Title: readText(rows[0]),
    screen1FragmentPath: screen1FragmentPath.startsWith('/') ? screen1FragmentPath : '',
    screen1RiskItems: readRiskItems(rows[1]),
    screen1RiskDescriptions: readListItems(rows[2]),
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

  // ── Build inline risk option cards from authored list items ─────────────
  function buildInlineRiskCards() {
    const wrap = document.createElement('div');
    wrap.className = 'mfq-screen mfq-risk-options';

    const listItems = cfg.screen1RiskItems.map(({ iconEl, label }) => ({
      iconEl,
      label,
      dataset: { riskValue: label.toLowerCase().replace(/\s+/g, '-') },
    }));

    const cardList = buildThumbSquareList(listItems, document);
    wrap.appendChild(cardList);

    // Descriptions as bullet list below the cards
    if (cfg.screen1RiskDescriptions.length) {
      const descEl = document.createElement('div');
      descEl.className = 'mfq-description';
      const ul = document.createElement('ul');
      cfg.screen1RiskDescriptions.forEach((desc) => {
        const li = document.createElement('li');
        li.innerHTML = desc;
        ul.appendChild(li);
      });
      descEl.appendChild(ul);
      wrap.appendChild(descEl);
    }

    return wrap;
  }

  // ── Screen 1 opener ──────────────────────────────────────────────────────
  async function openScreen1() {
    if (cfg.screen1FragmentPath) {
      // Load external risk-options fragment into the modal
      await openModal(document, cfg.screen1FragmentPath);
    } else {
      // No external fragment — build risk option cards from inline authored data
      const modal = createModal(document);
      const modalBody = modal.querySelector('.modal-body');
      if (!modalBody) return;
      modalBody.replaceChildren(buildInlineRiskCards());
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    }

    const modalBody = document.querySelector('.custom-modal .modal-body');
    if (!modalBody) return;

    // Prepend title + divider
    const titleEl = document.createElement('h2');
    titleEl.className = 'mfq-title';
    titleEl.textContent = cfg.screen1Title;

    const divider = document.createElement('span');
    divider.className = 'mfq-divider';
    divider.setAttribute('aria-hidden', 'true');

    modalBody.prepend(divider);
    modalBody.prepend(titleEl);

    // Append description (only for fragment path variant)
    if (cfg.screen1FragmentPath && cfg.screen1Description) {
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

    // Wire up risk option card clicks — works for both inline cards and fragment cards
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
    fragmentPath: cfg.screen1FragmentPath,
  };

  document.addEventListener('mf:open-questionnaire', openScreen1);

  // Auto-show screen 1 when loaded as a modal fragment.
  // block is in a detached <main> at decorate time — observe document.body
  // so we catch the moment replaceChildren moves the block into .modal-body.
  if (!document.body.contains(block)) {
    const observer = new MutationObserver(() => {
      if (block.closest('.modal-body')) {
        observer.disconnect();
        openScreen1();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
