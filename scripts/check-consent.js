import { getCookie } from './utils/cookies.js';

/**
 * Resolves Google Consent Mode state from site cookies (no external CMP).
 * Used as `consentCallback` by GtmMartech; kept separate from `consent.js` to avoid an import cycle
 * with `gtm-martech.js`.
 *
 * @returns {Promise<Object>} Consent types for gtag `consent` / default update payloads.
 */
export async function checkConsent() {
  return new Promise((resolve) => {
    // Perform the Consent popup check here.
    // Not using a CMP, therefore we must resolve to the desired Consent State.

    resolve({
      ad_storage: getCookie('AdvertisingCookie') === 'Advertising' ? 'granted' : 'denied',
      ad_user_data: getCookie('AdvertisingCookie') === 'Advertising' ? 'granted' : 'denied',
      ad_personalization: getCookie('AdvertisingCookie') === 'Advertising' ? 'granted' : 'denied',
      analytics_storage: getCookie('AnalysisCookie') === 'Analysis' ? 'granted' : 'denied',
      functionality_storage: getCookie('AnalysisCookie') === 'Analysis' ? 'granted' : 'denied',
      personalization_storage: getCookie('AnalysisCookie') === 'Analysis' ? 'granted' : 'denied',
    });
  });
}
