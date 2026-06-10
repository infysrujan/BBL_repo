import { loadFragment } from '../fragment/fragment.js';

async function fetchCampaignRow(campaignId) {
  try {
    const resp = await fetch('/en/cc-campaign.json');
    if (!resp.ok) return null;
    const json = await resp.json();
    const rows = json.data || [];
    return rows.find(
      (row) => String(row.campaignId || '').trim() === String(campaignId).trim(),
    ) || null;
  } catch {
    return null;
  }
}

function injectHiddenField(form, name, value) {
  if (!value || form.querySelector(`input[name="${name}"]`)) return;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

function injectCampaignFields(form, campaign) {
  injectHiddenField(form, 'campaignName', campaign.campaignName);
  injectHiddenField(form, 'campaignDetail', campaign.campaignDetail);
}

async function insertBottomFragment(path) {
  if (!path) return;
  const fragment = await loadFragment(path);
  if (!fragment) return;
  const formBlock = document.querySelector('.form');
  const insertTarget = formBlock?.parentElement || document.querySelector('main');
  if (insertTarget) insertTarget.appendChild(fragment);
}

export default async function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const campaignId = params.get('campaignid');
  if (!campaignId) return;

  const campaign = await fetchCampaignRow(campaignId);
  if (!campaign) return;

  // Load top fragment (campaign-specific title + card images)
  if (campaign.fragmentPathTop) {
    const fragment = await loadFragment(campaign.fragmentPathTop);
    if (fragment) {
      block.replaceChildren(...fragment.childNodes);
    }
  }

  // Inject campaignName + campaignDetail as hidden fields into the form
  const formEl = document.querySelector('.form form');
  if (formEl) {
    injectCampaignFields(formEl, campaign);
  } else {
    const observer = new MutationObserver(() => {
      const f = document.querySelector('.form form');
      if (f) {
        injectCampaignFields(f, campaign);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Load bottom fragment after form (if defined)
  insertBottomFragment(campaign.fragmentPathBottom);
}
