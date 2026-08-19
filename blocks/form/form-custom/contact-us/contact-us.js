/**
 * @param {HTMLElement | null} form
 * @returns {boolean}
 */
function isContactUsForm(form) {
  if (!form) return false;

  // createForm() runs before the form is mounted in the section wrapper.
  // The outer fragment panel's class differs across environments
  // (field-contact in dev, field-contactfragment in prod), but the
  // main panel must always be nested inside it — matching either class
  // alone is too broad and matches unrelated forms.
  return form.querySelector('.field-contact .field-main-panel, .field-contactfragment .field-main-panel') !== null;
}

/**
 * @param {HTMLFormElement} form
 */
export default function decorateContactUsForm(form) {
  if (!isContactUsForm(form)) return;
  document.body.classList.add('contact-us');
}
