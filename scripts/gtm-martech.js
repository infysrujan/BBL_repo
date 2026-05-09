// eslint-disable-next-line import/no-relative-packages
import GtmMartech from '../plugins/gtm-martech/src/index.js';
import { getCookie } from './utils/cookies.js';
import env from './utils/env.js';

const GA_PROPERTY_CONFIG = {
    dev: "G-ZG7X6JC6DG",
    stage: "G-ZG7X6JC6DG",
    prod: "G-ZG7X6JC6DG",
};

// Consent is given if the AnalysisCookie is set to 'Analysis' from the cookie-modal / cookie-alert blocks.
const isConsentGiven = getCookie('AnalysisCookie') === 'Analysis';
// For DA Preview support. Martech is enabled if the martech=off query parameter is not present.
const isEnabled = !window.location.search.includes('martech=off');

const env = env();

// TODO: Update BBL's GA4 measurement ID and GTM Container Ids here
const martech = new GtmMartech({
  analytics: isEnabled && isConsentGiven,
  tags: [GA_PROPERTY_CONFIG[env]],
  containers: {
    lazy: [/* Zero or more GTM Container Ids to load during Lazy Phase */],
    delayed: [/* Zero or more GTM Container Ids to load during Delayed Phase */],
  },
  gtagConfig: { /* Passed to gtag('config', measurementId, …): page fields, transport_url, etc. */ },
  consent: isConsentGiven,
  consentCallback: () => {
    /* Function that handles consent processing, if consent is enabled, this must be specified */
  },
  decorateCallback: /* Function to call on each found or loaded Section/Block */ () => {},
});

export default martech