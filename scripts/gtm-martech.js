// eslint-disable-next-line import/no-relative-packages
import GtmMartech from '../plugins/gtm-martech/src/index.js';
import checkConsent from './check-consent.js';
import env from './utils/env.js';
import { getCookie } from './utils/cookies.js';

const GTM_CONTAINER_CONFIG = {
    dev: {
        lazy: ['GTM-NQNDNXRR'],
        delayed: [],
    },
    stage: {
        lazy: ['GTM-NQNDNXRR'],
        delayed: [],
    },
    prod: {
        lazy: ['GTM-NQNDNXRR'],
        delayed: [],
    },
}

const GA_PROPERTY_CONFIG = {
  dev: 'G-ZG7X6JC6DG',
  stage: 'G-ZG7X6JC6DG',
  prod: 'G-ZG7X6JC6DG',
};

// Consent when AnalysisCookie is 'Analysis' (set from cookie-modal / cookie-alert blocks).
const isConsentGiven = getCookie('AnalysisCookie') === 'Analysis';
// For DA Preview support. Martech is enabled if the martech=off query parameter is not present.
const isEnabled = !window.location.search.includes('martech=off');

// TODO: Update BBL's GA4 measurement ID and GTM Container Ids here
const martech = new GtmMartech({
  analytics: isEnabled && isConsentGiven,
  tags: [GA_PROPERTY_CONFIG[env]],
  containers: {
    lazy: GTM_CONTAINER_CONFIG[env].lazy,
    delayed: GTM_CONTAINER_CONFIG[env].delayed,
  },
  // Passed to gtag('config', measurementId, …): page fields, transport_url, etc.
  gtagConfig: {},
  consent: isConsentGiven,
  consentCallback: checkConsent,
  decorateCallback: /* Function to call on each found or loaded Section/Block */ () => {},
});

export default martech;
