import gtmMartech from './gtm-martech.js';
// eslint-disable-next-line import/no-relative-packages
import { updateUserConsent as updateAdobeConsent } from '../plugins/martech/src/index.js';

/**
 * Google Consent Mode update when the user accepts marketing-related storage
 * (aligns with defaults set in aem-gtm-martech when `consent: true`).
 */
const DEFAULT_GTAG_MARKETING_GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  personalization_storage: 'granted',
};

/** Adobe Web SDK / Alloy consent shape for `setConsent` (see martech `updateUserConsent`). */
const DEFAULT_ADOBE_MARKETING_GRANTED = {
  collect: true,
  marketing: true,
  personalize: true,
  share: false,
};

let consentListenerAttached = false;

/**
 * @typedef {Object} ConsentUpdateDetail
 * @property {boolean} [marketing] - If true, applies default granted payloads for both gtag and Adobe (unless overridden).
 * @property {Object} [gtag] - Passed to `gtag('consent', 'update', gtag)`. Overrides default when `marketing` is true.
 * @property {Object} [adobe] - Passed to Adobe `updateUserConsent`. Overrides default when `marketing` is true.
 */

/**
 * Updates Google Consent Mode (gtag) and Adobe Alloy consent from a single payload.
 *
 * @param {ConsentUpdateDetail} [detail] - From `CustomEvent.detail` or call directly.
 * @returns {Promise<void>}
 */
export async function applyMarketingConsentUpdates(detail = {}) {
  const gtagPayload = detail.gtag ?? (detail.marketing === true ? DEFAULT_GTAG_MARKETING_GRANTED : null);
  const adobePayload = detail.adobe ?? (detail.marketing === true ? DEFAULT_ADOBE_MARKETING_GRANTED : null);

  if (gtagPayload && typeof window.gtag === 'function') {
    // eslint-disable-next-line no-console
    console.debug('Updating Google Consent Mode', gtagPayload);
    gtmMartech.updateUserConsent(gtagPayload);
  }

  if (adobePayload) {
    // eslint-disable-next-line no-console
    console.debug('Updating Adobe Alloy Consent', adobePayload);
    await updateAdobeConsent(adobePayload);
  }
}

/**
 * Listens for `consent:update` on `window` and applies gtag + Adobe consent from `event.detail`.
 *
 * Dispatch example:
 * `window.dispatchEvent(new CustomEvent('consent:update', { detail: { marketing: true } }))`
 * or pass explicit `{ gtag: { … }, adobe: { … } }`.
 */
export function initMarketingConsentListener() {
  if (consentListenerAttached) return;
  consentListenerAttached = true;
  // Listen for the cookie:consent-saved event from the cookie-modal block.
  document.addEventListener('cookie:consent-saved', (event) => {
    // eslint-disable-next-line no-console
    console.debug('Consent update event received', event);
    const detail = event?.detail || {};
    void applyMarketingConsentUpdates(detail).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Error applying marketing consent updates', error);
      // Alloy may reject if not ready; CMP can retry or call `applyMarketingConsentUpdates` later.
    });
  });
}
