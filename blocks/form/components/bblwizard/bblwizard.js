/**
 * BBL Wizard Steps — step progress indicator for Adaptive Forms.
 *
 * Renders a horizontal numbered step indicator (① ── ② ── ③) and keeps it
 * in sync with the form's panel visibility via MutationObserver.
 *
 * Authored properties (stored in fd.properties, editable in Universal Editor):
 *   stepTitles : string[]  – Label shown under each circle, one per step
 *   stepPanels : string[]  – The `name` of the form panel for each step
 *
 * Step states:
 *   is-completed  – all panels before the active step (filled blue + checkmark)
 *   is-active     – the currently visible panel (outlined blue + number)
 *   (neither)     – panels that follow the active step (gray + number)
 *
 * Panel detection relies on form.js setting `wrapper.name = fd.name` on every
 * panel <fieldset>, so panels are found via fieldset[name="panelName"].
 */

import { subscribe } from '../../rules/index.js';

const CHECKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

/**
 * Normalises a multi-value authored field.
 * UE stores arrays; doc-based / CRXDE stores newline-delimited strings.
 *
 * @param {string|string[]} value
 * @returns {string[]}
 */
function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split('\n').map((v) => v.trim()).filter(Boolean);
}

/**
 * Reads a property from the fd object, trying several storage locations:
 *   1. fd.properties[key]             – standard AEM Forms runtime (nested)
 *   2. fd.properties['properties.key']– dot-notation preserved inside properties
 *   3. fd['properties.key']           – flat dot-notation directly on fd
 *   4. fd[key]                        – direct property (doc-based payloads)
 *
 * @param {Object} fd
 * @param {string} key
 * @returns {*}
 */
function getProp(fd, key) {
  const nested = fd.properties?.[key];
  if (nested !== undefined && nested !== null && nested !== '') return nested;
  const nestedDot = fd.properties?.[`properties.${key}`];
  if (nestedDot !== undefined && nestedDot !== null && nestedDot !== '') return nestedDot;
  const flat = fd[`properties.${key}`];
  if (flat !== undefined && flat !== null && flat !== '') return flat;
  return fd[key];
}

/**
 * Returns the 0-based index of the last step whose panel is currently visible.
 * Walking in reverse ensures we return the furthest-reached step.
 *
 * @param {HTMLFormElement} form
 * @param {string[]}        stepPanels – ordered array of panel names
 * @returns {number}
 */
function getActiveIndex(form, stepPanels) {
  for (let i = stepPanels.length - 1; i >= 0; i -= 1) {
    const fieldset = form.querySelector(`fieldset[name="${stepPanels[i]}"]`);
    if (fieldset && fieldset.dataset.visible !== 'false') return i;
  }
  return 0;
}

/**
 * Builds the initial <nav> DOM for the step indicator.
 * States are applied lazily via applyState() after the form renders.
 *
 * @param {{ title: string, panel: string }[]} steps
 * @returns {HTMLElement}
 */
function buildNav(steps) {
  const nav = document.createElement('nav');
  nav.className = 'bbl-wizard-steps';
  nav.setAttribute('aria-label', 'Form progress');
  nav.setAttribute('role', 'list');

  steps.forEach(({ title }, i) => {
    if (i > 0) {
      const connector = document.createElement('div');
      connector.className = 'bbl-wizard-step-connector';
      connector.setAttribute('aria-hidden', 'true');
      nav.append(connector);
    }

    const item = document.createElement('div');
    item.className = 'bbl-wizard-step';
    item.dataset.stepIndex = i;
    item.setAttribute('role', 'listitem');

    const indicator = document.createElement('div');
    indicator.className = 'bbl-wizard-step-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = String(i + 1);

    const titleEl = document.createElement('span');
    titleEl.className = 'bbl-wizard-step-title';
    titleEl.textContent = title;

    item.append(indicator, titleEl);
    nav.append(item);
  });

  return nav;
}

/**
 * Updates every step item and connector to reflect the current activeIndex.
 *
 * @param {HTMLElement} nav
 * @param {number}      activeIndex
 */
function applyState(nav, activeIndex) {
  const items = nav.querySelectorAll('.bbl-wizard-step');
  const connectors = nav.querySelectorAll('.bbl-wizard-step-connector');

  items.forEach((item, i) => {
    const indicator = item.querySelector('.bbl-wizard-step-indicator');
    item.classList.remove('is-completed', 'is-active');
    item.removeAttribute('aria-current');

    if (i < activeIndex) {
      // Completed steps are navigable — clicking one jumps back to it.
      item.classList.add('is-completed');
      indicator.innerHTML = CHECKMARK_SVG;
      item.setAttribute('aria-label', `Step ${i + 1} completed, activate to go back`);
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
    } else if (i === activeIndex) {
      item.classList.add('is-active');
      indicator.textContent = String(i + 1);
      item.setAttribute('aria-current', 'step');
      item.setAttribute('aria-label', `Step ${i + 1} current`);
      item.setAttribute('role', 'listitem');
      item.removeAttribute('tabindex');
    } else {
      // Upcoming steps are not reachable by clicking — only submitting advances the form.
      indicator.textContent = String(i + 1);
      item.setAttribute('aria-label', `Step ${i + 1} upcoming`);
      item.setAttribute('role', 'listitem');
      item.removeAttribute('tabindex');
    }
  });

  // Connector i sits between step[i] and step[i+1].
  // It is "completed" (blue) when both steps are at or before the active step,
  // i.e. when i < activeIndex.
  connectors.forEach((conn, i) => {
    conn.classList.toggle('is-completed', i < activeIndex);
  });
}

/**
 * Default export — invoked by mappings.js when fd['fd:viewType'] === 'bbl-wizard'.
 *
 * @param {HTMLElement} fieldDiv – The .field-wrapper rendered by form.js
 * @param {Object}      fd       – The field definition from AEM Forms
 * @param {HTMLElement} _container
 * @param {string}      formId   – Id used to look up the live rule-engine model
 * @returns {HTMLElement}
 */
export default function decorate(fieldDiv, fd, _container, formId) {
  const titles = toArray(getProp(fd, 'stepTitles'));
  const panels = toArray(getProp(fd, 'stepPanels'));

  if (!titles.length || !panels.length) return fieldDiv;

  const count = Math.min(titles.length, panels.length);
  const steps = Array.from({ length: count }, (_, i) => ({
    title: titles[i],
    panel: panels[i],
  }));
  const panelNames = steps.map((s) => s.panel);

  fieldDiv.classList.add('field-bbl-wizard');
  fieldDiv.innerHTML = '';

  const nav = buildNav(steps);
  fieldDiv.appendChild(nav);

  // Defer observer setup to allow the rest of the form's panels to render.
  // By the next animation frame all fieldsets are in the DOM.
  requestAnimationFrame(() => {
    const form = fieldDiv.closest('form');
    if (!form) return;

    // Set initial state
    let lastActiveIndex = getActiveIndex(form, panelNames);
    applyState(nav, lastActiveIndex);

    // Watch for data-visible changes on any of the tracked panels. This fires for both
    // forward navigation (the form's own Next/Submit flow revealing the next panel) and
    // backward navigation (goToStep below) — either way, keep the stepper scrolled into
    // view so the user always lands where the step indicator is visible.
    const observer = new MutationObserver(() => {
      const activeIndex = getActiveIndex(form, panelNames);
      applyState(nav, activeIndex);
      if (activeIndex !== lastActiveIndex) {
        lastActiveIndex = activeIndex;
        nav.scrollIntoView({ behavior: 'smooth' });
      }
    });

    observer.observe(form, {
      attributes: true,
      attributeFilter: ['data-visible'],
      subtree: true,
    });

    // Resolve the live rule-engine model for this field so goToStep can correct the
    // model's own cached `visible` value, not just the DOM attribute. The rule engine
    // only re-syncs the DOM (rules/index.js `case 'visible'`) when its cached value
    // actually changes; if we only flip dataset.visible here, the model never learns
    // about it, and the next time the form's own Next/Submit flow recomputes visibility
    // for these panels it sees no change from its stale cache, so it never re-reveals
    // them — leaving required fields permanently hidden (and unfocusable) at submit time.
    let formModel;
    if (formId) {
      subscribe(fieldDiv, formId, (el, model, eventType) => {
        if (eventType === 'register') formModel = model?.form;
      });
    }

    // Clicking a step icon only ever goes backward to an already-completed step.
    // Moving forward is never done from here — the form's own submit/next action
    // is what reveals the next panel.
    const goToStep = (targetIndex) => {
      const activeIndex = getActiveIndex(form, panelNames);
      if (targetIndex >= activeIndex) return;
      panelNames.forEach((name, i) => {
        const fieldset = form.querySelector(`fieldset[name="${name}"]`);
        if (!fieldset) return;
        const isVisible = i <= targetIndex;
        if (formModel) {
          const panelModel = formModel.getElement(fieldset.dataset.id);
          if (panelModel) panelModel.visible = isVisible;
        }
        fieldset.dataset.visible = String(isVisible);
      });
    };

    const onActivate = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      const stepEl = e.target.closest('.bbl-wizard-step');
      if (!stepEl) return;
      if (e.type === 'keydown') e.preventDefault();
      goToStep(Number(stepEl.dataset.stepIndex));
    };
    nav.addEventListener('click', onActivate);
    nav.addEventListener('keydown', onActivate);
  });

  return fieldDiv;
}
