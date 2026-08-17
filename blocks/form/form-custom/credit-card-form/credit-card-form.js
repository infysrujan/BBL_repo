/**
 * @param {HTMLElement | null} form
 * @returns {boolean}
 */
function isCreditCardForm(form) {
  if (!form) return false;

  // createForm() runs before the form is mounted in the section wrapper.
  // Field names vary per campaign (e.g. "field-creditcardhg"), so match by
  // prefix instead of requiring the exact "field-creditcard" class.
  return form.querySelector('[class*="field-creditcard"], .credit-card-form-panel, .creditcard-form-panel') !== null;
}

/**
 * @param {HTMLFormElement} form
 */
export default function decorateCreditCardForm(form) {
  if (!isCreditCardForm(form)) return;
  document.body.classList.add('credit-card-form');

  // On successful submit, submit.js inserts `.form-message.success-message` and only
  // scrolls it partially into view. For the credit card form, scroll it up to just below
  // the sticky header. The `scroll-margin-top: var(--header-scroll-offset)` set in
  // credit-card-form.css keeps the message clear of the sticky header. Watch for the
  // message being inserted, then self-disconnect.
  const observer = new MutationObserver((mutations, obs) => {
    const successMessage = mutations
      .flatMap((mutation) => [...mutation.addedNodes])
      .find((node) => node.nodeType === Node.ELEMENT_NODE
        && node.matches?.('.form-message.success-message'));
    if (!successMessage) return;
    obs.disconnect();
    // Run after submit.js's own scroll (fired on a 100ms timeout) so this wins.
    setTimeout(() => successMessage.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
