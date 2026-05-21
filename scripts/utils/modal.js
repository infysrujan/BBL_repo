function fromHTML(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

/**
 * Creates a modal shell: overlay[role=dialog,aria-modal] > dialog, with a detached closeBtn.
 * The caller is responsible for positioning closeBtn inside dialog/overlay and
 * appending any block-specific content before calling showModal.
 *
 * @param {object} opts
 * @param {string}      opts.overlayClass
 * @param {string}      opts.dialogClass
 * @param {string}      opts.closeBtnClass
 * @param {string}      [opts.ariaLabel]         aria-label on overlay
 * @param {string}      [opts.ariaLabelledBy]    aria-labelledby on overlay
 * @param {string}      [opts.ariaDescribedBy]   aria-describedby on overlay
 * @param {string}      [opts.closeBtnAriaLabel] aria-label on the close button (default: 'Close')
 * @param {string}      [opts.closeBtnHTML]      innerHTML for the close button (default: '&times;')
 * @param {string|null} [opts.tabindex]          tabindex on overlay; null = omit (default: null)
 * @returns {{ overlay: HTMLElement, dialog: HTMLElement, closeBtn: HTMLButtonElement }}
 */
export function createModalShell({
  overlayClass,
  dialogClass,
  closeBtnClass,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  closeBtnAriaLabel = 'Close',
  closeBtnHTML = '&times;',
  tabindex = null,
} = {}) {
  const overlayAttrs = [
    `class="${overlayClass}"`,
    'role="dialog"',
    'aria-modal="true"',
    ariaLabel ? `aria-label="${ariaLabel}"` : '',
    ariaLabelledBy ? `aria-labelledby="${ariaLabelledBy}"` : '',
    ariaDescribedBy ? `aria-describedby="${ariaDescribedBy}"` : '',
    tabindex !== null ? `tabindex="${tabindex}"` : '',
  ].filter(Boolean).join(' ');

  const overlay = fromHTML(`<div ${overlayAttrs}></div>`);
  const dialog = fromHTML(`<div class="${dialogClass}"></div>`);
  const closeBtn = fromHTML(
    `<button class="${closeBtnClass}" type="button" aria-label="${closeBtnAriaLabel}">${closeBtnHTML}</button>`,
  );

  overlay.appendChild(dialog);
  return { overlay, dialog, closeBtn };
}

/**
 * Shows a modal: appends to document.body if not already connected,
 * then adds visibleClass on the next animation frame for the CSS transition.
 *
 * @param {HTMLElement} overlay
 * @param {string}      visibleClass
 */
export function showModal(overlay, visibleClass) {
  if (!overlay.isConnected) document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add(visibleClass));
}

/**
 * Hides a modal: removes visibleClass, waits for the CSS opacity/transform
 * transition to finish (or skips immediately for prefers-reduced-motion),
 * then removes the element from the DOM.
 *
 * @param {HTMLElement} overlay
 * @param {string}      visibleClass
 * @param {Function}    [onClosed]  Optional callback invoked after removal
 */
export function hideModal(overlay, visibleClass, onClosed) {
  overlay.classList.remove(visibleClass);

  const prefersReducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.remove();
    onClosed?.();
  };

  if (prefersReducedMotion) {
    finish();
    return;
  }

  overlay.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 300);
}
