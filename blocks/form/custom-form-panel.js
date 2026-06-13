/**
 * Decorates custom-form panels with stable cc-panel-item-* role classes on inner items.
 * Panel types are identified by authoring cc-app-* classes — not field-* names.
 */

const CC_ITEM = 'cc-panel-item';

/** @type {Record<string, { roles: string[] }>} */
const PANEL_LAYOUTS = {
  'cc-app-main-form': {
    roles: [
      'form-title',
      'form-input',
      'form-input',
      'form-cover',
      'form-consent',
      'form-actions',
    ],
  },
  'cc-app-approved': {
    roles: [
      'timeline-step',
      'timeline-step',
      'timeline-step',
      'timeline-message',
      'timeline-bg',
      'timeline-date',
      'timeline-caption',
      'panel-action',
    ],
  },
  'cc-app-denied': {
    roles: [
      'timeline-step',
      'timeline-bg',
      'timeline-status',
      'timeline-message',
      'timeline-caption',
      'timeline-muted',
      'panel-action',
    ],
  },
  'cc-app-cancel': {
    roles: [
      'timeline-step',
      'timeline-bg',
      'timeline-status',
      'timeline-message',
      'timeline-caption',
      'timeline-muted',
      'panel-action',
    ],
  },
  'cc-app-pending': {
    roles: [
      'timeline-step',
      'timeline-bg',
      'timeline-status',
      'timeline-message',
      'timeline-caption',
      'timeline-muted',
      'panel-action',
    ],
  },
  'cc-app-incomplete': {
    roles: [
      'timeline-step',
      'timeline-bg',
      'timeline-status',
      'timeline-message',
      'timeline-caption',
      'timeline-muted',
      'panel-action',
    ],
  },
  'cc-app-callback': {
    roles: [
      'timeline-step',
      'timeline-bg',
      'timeline-status',
      'timeline-message',
      'timeline-caption',
      'timeline-muted',
      'callback-prompt',
      'callback-input',
      'callback-actions',
    ],
  },
  'cc-app-notfound': {
    roles: [
      'timeline-status',
      'timeline-message',
      'timeline-bg',
      'timeline-caption',
    ],
  },
  'cc-app-message-form': {
    roles: [
      'form-title',
      'form-input-half',
      'form-input-half',
      'form-input',
      'form-input',
      'form-radio',
      'form-branch',
      'form-hidden',
      'form-actions',
    ],
  },
  'field-submitbuttonpanel': {
    roles: ['panel-action', 'panel-action-primary'],
  },
  'field-submitbuttonpanel2': {
    roles: ['panel-action', 'panel-action-primary'],
  },
  'field-button-panel': {
    roles: ['panel-action-primary', 'panel-action-secondary'],
  },
};

const CC_APP_PANEL_SELECTOR = Object.keys(PANEL_LAYOUTS)
  .filter((key) => key.startsWith('cc-app-'))
  .map((key) => `fieldset.panel-wrapper.${key}`)
  .join(',');

const CUSTOM_FORM_SECTION_SELECTOR = '.form-container.custom-forms';

function isCustomForm(form) {
  if (!form) return false;

  if (form.closest(CUSTOM_FORM_SECTION_SELECTOR)) return true;

  // createForm() runs before the form is mounted in the section wrapper.
  return form.querySelector(CC_APP_PANEL_SELECTOR) !== null;
}

function getPanelKey(panel) {
  return [...panel.classList].find((cls) => PANEL_LAYOUTS[cls]);
}

function getDirectItems(panel) {
  return [...panel.children].filter(
    (el) => el.classList?.contains('field-wrapper') && el.dataset.visible !== 'false',
  );
}

function assignItemRole(element, role, stepIndex) {
  element.classList.add(CC_ITEM, `${CC_ITEM}-${role}`);
  if (role === 'timeline-step' && stepIndex != null) {
    element.classList.add(`${CC_ITEM}-timeline-step-${stepIndex}`);
  }
}

function decoratePanel(panel) {
  const panelKey = getPanelKey(panel);
  if (!panelKey) return;

  const layout = PANEL_LAYOUTS[panelKey];
  const items = getDirectItems(panel);
  let stepIndex = 0;

  items.forEach((item, index) => {
    const role = layout.roles[index];
    if (!role) return;

    if (role === 'timeline-step') {
      stepIndex += 1;
      assignItemRole(item, role, stepIndex);
      return;
    }

    assignItemRole(item, role);

    if (item.classList.contains('panel-wrapper') && item.classList.contains('field-wrapper')) {
      decoratePanel(item);
    }
  });
}

/**
 * @param {HTMLFormElement} form
 */
export default function decorateCustomFormPanels(form) {
  if (!isCustomForm(form)) return;

  form.querySelectorAll('fieldset.panel-wrapper.field-wrapper').forEach(decoratePanel);
}
