/**
 * Custom Dropdown Component
 *
 * Replaces the visual presentation of the default drop-down field
 * (fieldType: "drop-down") with a fully custom <div>-based listbox widget,
 * following the WAI-ARIA "Collapsible Dropdown Listbox" pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-collapsible/
 *
 * The native <select> produced by form.js (createSelect / createDropdownUsingEnum)
 * is kept in the DOM (visually hidden, but still a real form control) so that:
 *  - submit.js can still find/serialize it via `[...form.elements]`
 *  - the AF rule engine (rules/index.js) can keep driving it via `.value`,
 *    `.setCustomValidity()`, `.disabled`, and `createDropdownUsingEnum()` rebuilds
 *  - functions.js' branch/province grouping helpers and change-poller keep working
 *
 * The visible widget mirrors the hidden select's options/value/disabled state and
 * writes user selections back into it, dispatching a real 'change' event so the
 * rule engine picks it up exactly as it would from a native select.
 */

import { subscribe } from '../../rules/index.js';

const OPEN_CLASS = 'is-open';
const ACTIVE_CLASS = 'is-active';
const SELECTED_CLASS = 'is-selected';
const TYPEAHEAD_RESET_MS = 500;

function isSkippable(select) {
  // Multi-select (array-typed) fields keep the native <select multiple> UI;
  // building a custom multi-select listbox is out of scope for this phase.
  return select.multiple;
}

function getOptionEls(listbox) {
  return Array.from(listbox.querySelectorAll('[role="option"]'));
}

function getEnabledOptionEls(listbox) {
  return getOptionEls(listbox).filter((li) => li.getAttribute('aria-disabled') !== 'true');
}

function setActiveOption(listbox, optionEl) {
  getOptionEls(listbox).forEach((li) => li.classList.remove(ACTIVE_CLASS));
  if (optionEl) {
    optionEl.classList.add(ACTIVE_CLASS);
    listbox.setAttribute('aria-activedescendant', optionEl.id);
    optionEl.scrollIntoView({ block: 'nearest' });
  } else {
    listbox.removeAttribute('aria-activedescendant');
  }
}

function getActiveOption(listbox) {
  const id = listbox.getAttribute('aria-activedescendant');
  return id ? listbox.querySelector(`#${CSS.escape(id)}`) : null;
}

function syncTriggerLabel(select, trigger) {
  const label = trigger.querySelector('.custom-dropdown-label');
  const selected = select.options[select.selectedIndex];
  label.textContent = selected ? selected.textContent : '';
  trigger.classList.toggle('is-placeholder', !!(selected && selected.disabled));
}

function syncDisabledState(select, fieldDiv, trigger) {
  const { disabled } = select;
  trigger.toggleAttribute('disabled', disabled);
  trigger.setAttribute('aria-disabled', String(disabled));
  trigger.tabIndex = disabled ? -1 : 0;
  fieldDiv.classList.toggle('field-disabled', disabled);
}

function renderOptions(select, listbox, trigger) {
  listbox.innerHTML = '';
  Array.from(select.options).forEach((opt, index) => {
    const li = document.createElement('li');
    li.className = 'custom-dropdown-option';
    li.id = `${select.id}-option-${index}`;
    li.setAttribute('role', 'option');
    li.textContent = opt.textContent;
    li.dataset.value = opt.value;
    if (opt.disabled) {
      li.classList.add('is-placeholder');
      li.setAttribute('aria-disabled', 'true');
    }
    const isSelected = opt.selected && !opt.disabled;
    li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    if (isSelected) {
      li.classList.add(SELECTED_CLASS);
    }
    listbox.append(li);
  });
  syncTriggerLabel(select, trigger);
}

function closeListbox(trigger, listbox) {
  if (listbox.hidden) return;
  listbox.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.classList.remove(OPEN_CLASS);
  setActiveOption(listbox, null);
}

function openListbox(trigger, listbox, { focusOption } = {}) {
  if (!listbox.hidden) return;
  listbox.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.classList.add(OPEN_CLASS);
  const enabled = getEnabledOptionEls(listbox);
  const preferred = focusOption
    || enabled.find((li) => li.classList.contains(SELECTED_CLASS))
    || enabled[0]
    || null;
  setActiveOption(listbox, preferred);
  listbox.focus();
}

function selectOption(select, trigger, listbox, optionEl) {
  if (!optionEl || optionEl.getAttribute('aria-disabled') === 'true') return;
  const { value } = optionEl.dataset;
  if (select.value !== value) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  renderOptions(select, listbox, trigger);
  closeListbox(trigger, listbox);
  trigger.focus();
}

function moveActive(listbox, direction) {
  const enabled = getEnabledOptionEls(listbox);
  if (!enabled.length) return;
  const current = getActiveOption(listbox);
  const currentIndex = current ? enabled.indexOf(current) : -1;
  let nextIndex;
  if (direction === 'first') {
    nextIndex = 0;
  } else if (direction === 'last') {
    nextIndex = enabled.length - 1;
  } else if (direction === 'next') {
    nextIndex = Math.min(currentIndex + 1, enabled.length - 1);
  } else {
    nextIndex = Math.max(currentIndex - 1, 0);
  }
  if (currentIndex === -1) nextIndex = direction === 'previous' || direction === 'last' ? enabled.length - 1 : 0;
  setActiveOption(listbox, enabled[nextIndex]);
}

function setupTypeahead(listbox) {
  let searchString = '';
  let lastKeyTime = 0;
  return (key) => {
    const now = Date.now();
    searchString = (now - lastKeyTime > TYPEAHEAD_RESET_MS) ? key : searchString + key;
    lastKeyTime = now;
    const match = getEnabledOptionEls(listbox)
      .find((li) => li.textContent.trim().toLowerCase().startsWith(searchString.toLowerCase()));
    if (match) setActiveOption(listbox, match);
  };
}

export default function decorate(fieldDiv, fd, _container, formId) {
  const select = fieldDiv.querySelector('select');
  if (!select || isSkippable(select)) return fieldDiv;

  select.classList.add('custom-dropdown-native-select');
  select.setAttribute('aria-hidden', 'true');

  const widget = document.createElement('div');
  widget.className = 'custom-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  trigger.id = `${select.id}-trigger`;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.tabIndex = 0;

  const label = document.createElement('span');
  label.className = 'custom-dropdown-label';
  const arrow = document.createElement('span');
  arrow.className = 'custom-dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  trigger.append(label, arrow);

  const listbox = document.createElement('ul');
  listbox.className = 'custom-dropdown-listbox';
  listbox.id = `${select.id}-listbox`;
  listbox.setAttribute('role', 'listbox');
  listbox.tabIndex = -1;
  listbox.hidden = true;
  trigger.setAttribute('aria-controls', listbox.id);

  widget.append(trigger, listbox);
  select.insertAdjacentElement('afterend', widget);

  if (fd.tooltip) trigger.title = select.title;
  if (select.hasAttribute('aria-describedby')) {
    trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
  }
  trigger.setAttribute('aria-required', String(!!select.required));

  renderOptions(select, listbox, trigger);
  syncDisabledState(select, fieldDiv, trigger);

  // Programmatic focus (e.g. rule-engine focusing an invalid field, or a stray
  // Tab into the hidden select) should land on the visible trigger instead.
  select.addEventListener('focus', () => trigger.focus());

  trigger.addEventListener('click', () => {
    if (trigger.disabled) return;
    if (listbox.hidden) {
      openListbox(trigger, listbox);
    } else {
      closeListbox(trigger, listbox);
    }
  });

  trigger.addEventListener('keydown', (e) => {
    if (trigger.disabled) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        e.preventDefault();
        openListbox(trigger, listbox);
        break;
      case 'Home':
        e.preventDefault();
        openListbox(trigger, listbox, { focusOption: null });
        moveActive(listbox, 'first');
        break;
      case 'End':
        e.preventDefault();
        openListbox(trigger, listbox, { focusOption: null });
        moveActive(listbox, 'last');
        break;
      default:
        break;
    }
  });

  const typeahead = setupTypeahead(listbox);

  listbox.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(listbox, 'next');
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(listbox, 'previous');
        break;
      case 'Home':
        e.preventDefault();
        moveActive(listbox, 'first');
        break;
      case 'End':
        e.preventDefault();
        moveActive(listbox, 'last');
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectOption(select, trigger, listbox, getActiveOption(listbox));
        break;
      case 'Escape':
        e.preventDefault();
        closeListbox(trigger, listbox);
        trigger.focus();
        break;
      case 'Tab':
        closeListbox(trigger, listbox);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          typeahead(e.key);
        }
        break;
    }
  });

  listbox.addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li) selectOption(select, trigger, listbox, li);
  });

  document.addEventListener('click', (e) => {
    if (!widget.contains(e.target)) {
      closeListbox(trigger, listbox);
    }
  });

  // Keeps the widget in sync with rule-engine driven changes that bypass real
  // DOM events entirely (direct `.value =` assignment, enum/enumNames rebuilds,
  // enabled/readOnly toggles) — see rules/index.js `fieldChanged`.
  if (formId) {
    subscribe(fieldDiv, formId, (el, model, eventType) => {
      if (eventType === 'register' || eventType === 'change') {
        closeListbox(trigger, listbox);
        renderOptions(select, listbox, trigger);
        syncDisabledState(select, fieldDiv, trigger);
        trigger.setAttribute('aria-required', String(!!select.required));
      }
    }, { listenChanges: true });
  }

  return fieldDiv;
}
