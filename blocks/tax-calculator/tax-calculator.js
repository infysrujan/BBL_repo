import { fetchConfigs } from '../../scripts/config.js';

// ─── Utilities ─────────────────────────────────────────────────────────────────

function toPascalCase(str) {
  return str.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function buildI18nMap(sheet) {
  const map = {};
  (sheet?.data || []).forEach(({ Key, Value }) => { map[Key] = Value; });
  return map;
}

function buildConfigMap(sheet) {
  const map = {};
  (sheet?.data || []).forEach(({ Key, Value }) => {
    const num = parseFloat(Value);
    map[toPascalCase(Key)] = Number.isNaN(num) ? Value : num;
  });
  return map;
}

function parseFieldSheet(sheet) {
  if (!sheet?.data?.length) return [];
  return sheet.data.map((row) => {
    const obj = {};
    Object.keys(row).forEach((key) => { obj[toPascalCase(key)] = row[key]; });
    return obj;
  });
}

function getLang() {
  return (document.documentElement.lang || 'en').startsWith('th') ? 'th' : 'en';
}

function fmt(val) {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('en-US');
}

function raw(str) {
  return String(str ?? '').replace(/,/g, '');
}

function t(i18n, key, fallback = '') {
  return i18n[key] || fallback;
}

function el(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

function buildNotes(title, noteLines) {
  const div = document.createElement('div');
  div.className = 'tax-calc-notes';
  const titleEl = document.createElement('p');
  titleEl.className = 'tax-calc-notes-title';
  titleEl.textContent = title;
  div.appendChild(titleEl);
  noteLines.forEach((line) => {
    const p = document.createElement('p');
    p.className = 'tax-calc-notes-body';
    p.innerHTML = line;
    div.appendChild(p);
  });
  return div;
}

// ─── Data ───────────────────────────────────────────────────────────────────────

async function loadData() {
  const [resp, siteConfig] = await Promise.all([
    fetch('/taxsavings.json'),
    fetchConfigs(),
  ]);
  if (!resp.ok) throw new Error('Failed to load taxsavings.json');
  const json = await resp.json();
  const lang = getLang();
  return {
    fields: parseFieldSheet(json.taxSavings),
    i18n: buildI18nMap(json[lang] || json.en || {}),
    cfg: buildConfigMap(json.config || {}),
    apiCalculateTax: siteConfig.calculateTaxWithReduce,
    apiCalculateSaving: siteConfig.calculateSavingTaxBySelf,
  };
}

// ─── Journey 1 field definitions ───────────────────────────────────────────────
// Pulled from taxSavings sheet; cfg provides defaults when sheet is empty.

function getJourney1Fields(fields, i18n, cfg) {
  const sheetFields = fields.filter((f) => !f.GroupId);

  if (sheetFields.length) {
    return sheetFields.map((f) => ({
      id: f.Id,
      label: f.Label,
      placeholder: (f.Placeholder || '{{column-min-value}} - {{column-max-value}}')
        .replace('{{column-min-value}}', fmt(f.MinValue))
        .replace('{{column-max-value}}', fmt(f.MaxValue)),
      defaultValue: parseFloat(f.Value) ?? 0,
      maxLength: f.MaxLength ? Number(f.MaxLength) : null,
      min: parseFloat(f.MinValue) || 0,
      max: parseFloat(f.MaxValue),
      factor: parseFloat(f.MultiplicativeFactor) || 1,
      errorMsg: f.MaxValidationErrorMessage || '',
    }));
  }

  return [
    {
      id: 'Income',
      label: t(i18n, 'steps-step1-currentMonthlyIncomeLabel', 'Salary*'),
      placeholder: `0 - ${fmt(999999999)}`,
      defaultValue: cfg.DefaultsCurrentMonthlyIncome,
      maxLength: 11,
      min: 0,
      max: 999999999,
      factor: 1,
      errorMsg: '',
    },
    {
      id: 'OtherIncome',
      label: t(i18n, 'steps-step1-otherIncomeLabel', 'Other annual income (non-salary)*'),
      placeholder: `0 - ${fmt(999999999)}`,
      defaultValue: null,
      maxLength: 11,
      min: 0,
      max: 999999999,
      factor: 1,
      errorMsg: '',
    },
    {
      id: 'Bonus',
      label: t(i18n, 'steps-step1-annualBonusLabel', 'Annual bonus'),
      placeholder: `0 - ${fmt(999999999)}`,
      defaultValue: cfg.DefaultsAnnualBonus,
      maxLength: 11,
      min: 0,
      max: 999999999,
      factor: 1,
      errorMsg: '',
    },
    {
      id: 'ProvidentFund',
      label: t(i18n, 'steps-step1-providentFundContributionRateLabel', 'Percentage of provident fund contribution (%)'),
      placeholder: '0 - 15',
      defaultValue: cfg.DefaultsProvidentFundContributionRate,
      maxLength: null,
      min: 0,
      max: 15,
      factor: 0.01,
      errorMsg: t(i18n, 'config-validation-maxValueError', 'Maximum up to {max}'),
    },
  ];
}

// ─── Journey 2 field groups ─────────────────────────────────────────────────────
// hint uses {max} as a placeholder — resolved dynamically by buildInputField.

function getJourney2Groups(fields, i18n, apiResponse) {
  const sheetFields = fields.filter((f) => f.GroupId);
  if (sheetFields.length) {
    // TODO: derive groups from sheet data when published
  }

  const allUsedMsg = t(i18n, 'results-noRemainDeduction', 'All tax deductions have been used.');
  const maxErrMsg = t(i18n, 'config-validation-maxValueError', 'Maximum up to {max}');
  const insureHint = t(i18n, 'steps-step2-lifeInsurancePremiumMax', 'Max allowance {max} baht');
  const healthHint = t(i18n, 'steps-step2-healthInsurancePremiumMax', 'Max allowance {max} baht');
  const pensionHint = t(i18n, 'steps-step2-lifePensionInsurancePremiumMax', 'Max allowance {max} baht');
  const fatherInsureHint = t(i18n, 'steps-step2-healthParentInsurancePremiumMax', 'Max allowance {max} baht');
  const rmfHint = t(i18n, 'steps-step2-rmfSavingsMax', 'Max allowance {max} baht');
  const esgHint = t(i18n, 'steps-step2-thaiEsgSavingsMax', 'Max allowance {max} baht');

  return [
    {
      id: 'family',
      label: t(i18n, 'steps-step2-familyDeductionLabel', 'Family'),
      tooltip: t(i18n, 'steps-step2-familyDeductionHint', 'The amount entered must not exceed the amount actually paid and not be more than the tax allowance threshold as specified by the Revenue Department.'),
      fields: [
        {
          id: 'NumberOfChildeBornBefore61',
          label: t(i18n, 'steps-step2-numberOfChildrenBefore2561Label', 'Number of children (born before 2018)'),
          placeholder: '0 - 10',
          defaultValue: 0,
          maxLength: 2,
          min: 0,
          max: 10,
          factor: 1,
          errorMsg: maxErrMsg,
        },
        {
          id: 'NumberOfChildeBorn61OnWards',
          label: t(i18n, 'steps-step2-numberOfChildrenAfter2561Label', 'Number of children (born in or after 2018)'),
          placeholder: '0 - 10',
          defaultValue: 0,
          maxLength: 2,
          min: 0,
          max: 10,
          factor: 1,
          errorMsg: maxErrMsg,
        },
        {
          id: 'FatherMother',
          type: 'checkbox',
          selfLabel: t(i18n, 'steps-step2-parentalDeductionSelfLabel', 'Claim tax deduction for supporting parents (self)'),
          spouseLabel: t(i18n, 'steps-step2-parentalDeductionSpouseLabel', "Claim tax deduction for supporting parents (spouse's)"),
          fatherLabel: t(i18n, 'common-fatherLabel', 'Father'),
          motherLabel: t(i18n, 'common-motherLabel', 'Mother'),
        },
      ],
    },
    {
      id: 'insurance',
      label: t(i18n, 'steps-step2-insuranceSectionLabel', 'Insurance'),
      tooltip: t(i18n, 'steps-step2-insuranceSectionHint', 'The amount entered must not exceed the amount actually paid and not be more than the tax allowance threshold as specified by the Revenue Department.'),
      fields: [
        {
          id: 'Insure',
          label: t(i18n, 'steps-step2-lifeInsurancePremiumLabel', 'Life insurance premiums'),
          placeholder: `0 - ${fmt(apiResponse.MaxInsure)}`,
          defaultValue: 0,
          maxLength: 7,
          min: 0,
          max: apiResponse.MaxInsure,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: insureHint,
          allUsedMsg,
        },
        {
          id: 'HealthInsure',
          label: t(i18n, 'steps-step2-healthInsurancePremiumLabel', 'Health insurance premiums'),
          placeholder: `0 - ${fmt(apiResponse.MaxHealthInsure)}`,
          defaultValue: 0,
          maxLength: 6,
          min: 0,
          max: apiResponse.MaxHealthInsure,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: healthHint,
          allUsedMsg,
        },
        {
          id: 'PensionInsure',
          label: t(i18n, 'steps-step2-lifePensionInsurancePremiumLabel', 'Pension insurance premiums'),
          placeholder: `0 - ${fmt(apiResponse.MaxInsure60)}`,
          defaultValue: 0,
          maxLength: 7,
          min: 0,
          max: apiResponse.MaxInsure60,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: pensionHint,
        },
        {
          id: 'FatherInsure',
          label: t(i18n, 'steps-step2-healthParentInsurancePremiumLabel', "Parents' Health Insurance Premiums"),
          placeholder: `0 - ${fmt(15000)}`,
          defaultValue: 0,
          maxLength: 6,
          min: 0,
          max: 15000,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: fatherInsureHint,
        },
      ],
    },
    {
      id: 'investment',
      label: t(i18n, 'steps-step2-investmentSectionLabel', 'Investment'),
      tooltip: t(i18n, 'steps-step2-investmentSectionHint', 'The amount entered must not exceed the amount actually paid and not be more than the tax allowance threshold as specified by the Revenue Department.'),
      fields: [
        {
          id: 'ReduceRMF',
          label: t(i18n, 'steps-step2-rmfSavingsLabel', 'RMF'),
          placeholder: `0 - ${fmt(apiResponse.MaxRMF)}`,
          defaultValue: 0,
          maxLength: 7,
          min: 0,
          max: apiResponse.MaxRMF,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: rmfHint,
        },
        {
          id: 'ReduceESG',
          label: t(i18n, 'steps-step2-thaiEsgSavingsLabel', 'Thai ESG'),
          placeholder: `0 - ${fmt(apiResponse.MaxESG)}`,
          defaultValue: 0,
          maxLength: 7,
          min: 0,
          max: apiResponse.MaxESG,
          factor: 1,
          errorMsg: maxErrMsg,
          hint: esgHint,
        },
      ],
    },
    {
      id: 'other',
      label: t(i18n, 'steps-step2-otherDeductionsSectionLabel', 'Other allowances'),
      tooltip: t(i18n, 'steps-step2-otherDeductionsSectionHint', '• The amount entered must not exceed the amount actually paid and not be more than the tax allowance threshold as specified by the Revenue Department.\n• For donations eligible for double deduction, enter double the calculated amount, but it must not exceed the tax allowance threshold as specified by the Revenue Department.\n• Enter the eligible amount as specified by the Revenue Department for some other types of tax allowances.'),
      fields: [
        {
          id: 'HomeInterest',
          label: t(i18n, 'steps-step2-homeLoanInterestLabel', 'Mortgage loan interest'),
          placeholder: `0 - ${fmt(100000)}`,
          defaultValue: 0,
          maxLength: 7,
          min: 0,
          max: 100000,
          factor: 1,
          errorMsg: maxErrMsg,
        },
        {
          id: 'Donate',
          label: t(i18n, 'steps-step2-donationLabel', 'Donations'),
          placeholder: `0 - ${fmt(999999999)}`,
          defaultValue: 0,
          maxLength: 11,
          min: 0,
          max: 999999999,
          factor: 1,
          errorMsg: maxErrMsg,
        },
        {
          id: 'Other',
          label: t(i18n, 'steps-step2-otherDeductionsLabel', 'Other'),
          placeholder: `0 - ${fmt(1000000)}`,
          defaultValue: 0,
          maxLength: 9,
          min: 0,
          max: 1000000,
          factor: 1,
          errorMsg: maxErrMsg,
        },
      ],
    },
  ];
}

// ─── Journey 3 field definitions ───────────────────────────────────────────────

function getJourney3InvestFields(apiResult1, i18n) {
  const allUsedMsg = t(i18n, 'results-noRemainDeduction', 'All tax deductions have been used.');
  const upTo = t(i18n, 'results-canInvestMoreLabel', 'Up to');
  const unit = t(i18n, 'common-unit', 'baht');
  const hintTemplate = `${upTo} {max} ${unit}`;
  const maxErrMsg = t(i18n, 'config-validation-maxValueError', 'Maximum up to {max}');

  return [
    {
      id: 'InputRMF',
      label: t(i18n, 'results-rmfLabel', 'RMF*'),
      placeholder: `0 - ${fmt(apiResult1.MaxRMF)}`,
      defaultValue: 0,
      maxLength: 7,
      min: 0,
      max: apiResult1.MaxRMF,
      factor: 1,
      errorMsg: maxErrMsg,
      hint: hintTemplate,
      allUsedMsg,
      disableWhenEmpty: true,
    },
    {
      id: 'InputESG',
      label: t(i18n, 'results-thaiEsgLabel', 'Thai ESG***'),
      placeholder: `0 - ${fmt(apiResult1.MaxESG)}`,
      defaultValue: 0,
      maxLength: 7,
      min: 0,
      max: apiResult1.MaxESG,
      factor: 1,
      errorMsg: maxErrMsg,
      hint: hintTemplate,
      allUsedMsg,
      disableWhenEmpty: true,
    },
    {
      id: 'InputInsure',
      label: t(i18n, 'results-lifeInsuranceLabel', 'Life insurance premiums**'),
      placeholder: `0 - ${fmt(apiResult1.MaxInsure)}`,
      defaultValue: 0,
      maxLength: 7,
      min: 0,
      max: apiResult1.MaxInsure,
      factor: 1,
      errorMsg: maxErrMsg,
      hint: hintTemplate,
      allUsedMsg,
      disableWhenEmpty: true,
    },
    {
      id: 'InputHealthInsure',
      label: t(i18n, 'results-healthInsuranceLabel', 'Health insurance premiums**'),
      placeholder: `0 - ${fmt(apiResult1.MaxHealthInsure)}`,
      defaultValue: 0,
      maxLength: 6,
      min: 0,
      max: apiResult1.MaxHealthInsure,
      factor: 1,
      errorMsg: maxErrMsg,
      hint: hintTemplate,
      allUsedMsg,
      disableWhenEmpty: true,
    },
    {
      id: 'InputInsure60',
      label: t(i18n, 'results-pensionInsuranceLabel', 'Pension insurance premiums*'),
      placeholder: `0 - ${fmt(apiResult1.MaxInsure60)}`,
      defaultValue: 0,
      maxLength: 7,
      min: 0,
      max: apiResult1.MaxInsure60,
      factor: 1,
      errorMsg: maxErrMsg,
      hint: hintTemplate,
      allUsedMsg,
      disableWhenEmpty: true,
    },
  ];
}

// ─── Step Indicator ─────────────────────────────────────────────────────────────

function buildStepIndicator(i18n, activeStep) {
  const steps = [
    t(i18n, 'common-step1Label', 'Income'),
    t(i18n, 'common-step2Label', 'Allowance'),
    t(i18n, 'common-step3Label', 'Result'),
  ];

  const wrap = el('<div class="tax-calc-steps"></div>');

  steps.forEach((label, idx) => {
    const num = idx + 1;
    let mod = '';
    if (num === activeStep) mod = 'tax-calc-step-active';
    else if (num < activeStep) mod = 'tax-calc-step-done';
    const step = el(`
      <div class="tax-calc-step ${mod}">
        <div class="tax-calc-step-circle"><span>${num < activeStep ? '✓' : num}</span></div>
        <div class="tax-calc-step-label">${label}</div>
      </div>
    `);
    wrap.appendChild(step);

    if (idx < steps.length - 1) {
      wrap.appendChild(el(`<div class="tax-calc-connector${num < activeStep ? ' tax-calc-connector-done' : ''}"></div>`));
    }
  });

  return wrap;
}

// ─── Input Field ────────────────────────────────────────────────────────────────

function buildInputField(def, savedValue) {
  let displayVal = fmt(0);
  if (savedValue !== undefined && savedValue !== null) {
    displayVal = fmt(savedValue);
  } else if (def.defaultValue !== null && def.defaultValue !== undefined) {
    displayVal = fmt(def.defaultValue);
  }

  const isEmptyRange = def.max <= 0;
  const displayPlaceholder = isEmptyRange ? '0' : def.placeholder;
  const maxLength = def.max > 0 ? fmt(Math.round(def.max)).length : 1;

  const hintHtml = def.hint
    ? `<p class="tax-calc-field-hint" id="tc-hint-${def.id}">${def.hint.replace('{max}', fmt(def.max))}</p>`
    : '';

  const field = el(`
    <div class="tax-calc-field" data-id="${def.id}">
      <div class="tax-calc-input-wrap">
        <input
          type="text"
          id="tc-${def.id}"
          name="${def.id}"
          class="tax-calc-input"
          placeholder="${displayPlaceholder}"
          value="${displayVal}"
          maxlength="${maxLength}"
          ${isEmptyRange && def.disableWhenEmpty ? 'disabled' : ''}
          ${isEmptyRange && !def.disableWhenEmpty ? 'readonly' : ''}
        />
        <label class="tax-calc-label" for="tc-${def.id}">${def.label}</label>
      </div>
      ${hintHtml}
      <p class="tax-calc-field-error" id="tc-err-${def.id}"></p>
    </div>
  `);

  const wrap = field.querySelector('.tax-calc-input-wrap');
  const input = field.querySelector('.tax-calc-input');
  const hintEl = def.hint ? field.querySelector(`#tc-hint-${def.id}`) : null;
  const errorEl = field.querySelector('.tax-calc-field-error');

  // Only digits allowed
  input.addEventListener('keypress', (e) => {
    if (!/[\d]/.test(e.key)) e.preventDefault();
  });

  // Skip over commas on backspace instead of deleting them
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && input.selectionStart === input.selectionEnd) {
      const pos = input.selectionStart;
      if (pos > 0 && input.value[pos - 1] === ',') {
        e.preventDefault();
        input.setSelectionRange(pos - 1, pos - 1);
      }
    }
  });

  input.addEventListener('focus', () => {
    if (raw(input.value) === '0') input.value = '';
    if (!wrap.classList.contains('tax-calc-input-wrap-error')) {
      wrap.classList.add('tax-calc-input-wrap-focus');
    }
  });

  // Empty on blur → 0, then reformat
  input.addEventListener('blur', () => {
    const val = raw(input.value).trim();
    input.value = fmt(val === '' ? 0 : val);
    wrap.classList.remove('tax-calc-input-wrap-focus');
  });

  // Live reformat + max validation
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    const digitsBeforeCursor = input.value.substring(0, pos).replace(/,/g, '').length;
    const rawVal = raw(input.value);
    const formatted = rawVal === '' ? '' : fmt(rawVal);
    input.value = formatted;

    // Restore cursor position accounting for shifted commas
    let digitCount = 0;
    let newPos = formatted.length;
    for (let i = 0; i < formatted.length; i += 1) {
      if (digitCount === digitsBeforeCursor) { newPos = i; break; }
      if (formatted[i] !== ',') digitCount += 1;
    }
    input.setSelectionRange(newPos, newPos);

    const val = parseFloat(rawVal) || 0;
    if (val > def.max) {
      const msg = (def.errorMsg || t({}, 'config-validation-maxValueError', 'Maximum up to {max}'))
        .replace('{max}', fmt(def.max))
        .replace('{{column-max-value}}', fmt(def.max));
      wrap.classList.add('tax-calc-input-wrap-error');
      wrap.classList.remove('tax-calc-input-wrap-focus');
      input.classList.add('tax-calc-input-error');
      errorEl.textContent = msg;
      if (hintEl) hintEl.hidden = true;
    } else {
      wrap.classList.remove('tax-calc-input-wrap-error');
      input.classList.remove('tax-calc-input-error');
      errorEl.textContent = '';
      if (hintEl) hintEl.hidden = false;
    }
  });

  // Allows external callers to update the max value and hint text dynamically
  field.updateMax = (newMax) => {
    def.max = newMax;
    if (newMax <= 0) {
      input.placeholder = '0';
      input.value = fmt(0);
      if (def.disableWhenEmpty) {
        input.disabled = true;
        input.removeAttribute('readonly');
      } else {
        input.readOnly = true;
        input.disabled = false;
      }
      wrap.classList.remove('tax-calc-input-wrap-error');
      input.classList.remove('tax-calc-input-error');
      errorEl.textContent = '';
      if (hintEl) {
        hintEl.textContent = def.allUsedMsg || 'All tax deductions have been used.';
        hintEl.classList.add('tax-calc-field-hint-warning');
        hintEl.hidden = false;
      }
    } else {
      input.disabled = false;
      input.readOnly = false;
      input.maxLength = fmt(Math.round(newMax)).length;
      input.placeholder = `${fmt(def.min || 0)} - ${fmt(newMax)}`;
      if (hintEl) {
        hintEl.textContent = def.hint.replace('{max}', fmt(newMax));
        hintEl.classList.remove('tax-calc-field-hint-warning');
        hintEl.hidden = false;
      }
      const val = parseFloat(raw(input.value)) || 0;
      if (val <= newMax) {
        wrap.classList.remove('tax-calc-input-wrap-error');
        input.classList.remove('tax-calc-input-error');
        errorEl.textContent = '';
      }
    }
  };

  return field;
}

// ─── Tooltip Icon ───────────────────────────────────────────────────────────────

function buildTooltipIcon(text) {
  const wrap = el(`
    <div class="tax-calc-tooltip-wrap">
      <button type="button" class="tax-calc-tooltip-trigger" aria-label="More information">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#0064FF" stroke-width="2" stroke-miterlimit="10"/>
          <path d="M12 17V11" stroke="#0064FF" stroke-width="2" stroke-miterlimit="10"/>
          <path d="M12 7.5C12.4418 7.5 12.7997 7.85807 12.7998 8.2998C12.7998 8.74163 12.4418 9.09961 12 9.09961C11.5583 9.0995 11.2002 8.74157 11.2002 8.2998C11.2003 7.85813 11.5583 7.50011 12 7.5Z" fill="#0064FF" stroke="#0064FF" stroke-miterlimit="10"/>
        </svg>
      </button>
      <div class="tax-calc-tooltip" role="tooltip">${text.replace(/\\n|\n/g, '<br>')}</div>
    </div>
  `);

  const trigger = wrap.querySelector('.tax-calc-tooltip-trigger');
  const tooltip = wrap.querySelector('.tax-calc-tooltip');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = tooltip.classList.contains('tax-calc-tooltip-open');
    document.querySelectorAll('.tax-calc-tooltip-open').forEach((tip) => tip.classList.remove('tax-calc-tooltip-open'));
    if (!isOpen) tooltip.classList.add('tax-calc-tooltip-open');
  });

  document.addEventListener('click', () => tooltip.classList.remove('tax-calc-tooltip-open'));

  return wrap;
}

// ─── Section Header ─────────────────────────────────────────────────────────────

function buildSectionHeader(label, tooltipText) {
  const header = el(`<div class="tax-calc-section-header"><h3 class="tax-calc-section-title">${label}</h3></div>`);
  header.appendChild(buildTooltipIcon(tooltipText));
  return header;
}

// ─── Parental Checkboxes (FatherMother) ─────────────────────────────────────────

function buildParentalCheckboxes(fieldDef, savedValue) {
  const {
    selfLabel, spouseLabel, fatherLabel, motherLabel,
  } = fieldDef;
  const saved = savedValue || 0;
  const checks = [false, false, false, false];
  for (let i = 0; i < saved && i < 4; i += 1) checks[i] = true;

  return el(`
    <div class="tax-calc-parental">
      <div class="tax-calc-parental-group">
        <p class="tax-calc-parental-title">${selfLabel}</p>
        <div class="tax-calc-parental-checks">
          <label class="tax-calc-parental-check">
            <input type="checkbox" class="tax-calc-checkbox" id="tc-father-self" ${checks[0] ? 'checked' : ''}>
            <span>${fatherLabel}</span>
          </label>
          <label class="tax-calc-parental-check">
            <input type="checkbox" class="tax-calc-checkbox" id="tc-mother-self" ${checks[1] ? 'checked' : ''}>
            <span>${motherLabel}</span>
          </label>
        </div>
      </div>
      <div class="tax-calc-parental-group">
        <p class="tax-calc-parental-title">${spouseLabel}</p>
        <div class="tax-calc-parental-checks">
          <label class="tax-calc-parental-check">
            <input type="checkbox" class="tax-calc-checkbox" id="tc-father-spouse" ${checks[2] ? 'checked' : ''}>
            <span>${fatherLabel}</span>
          </label>
          <label class="tax-calc-parental-check">
            <input type="checkbox" class="tax-calc-checkbox" id="tc-mother-spouse" ${checks[3] ? 'checked' : ''}>
            <span>${motherLabel}</span>
          </label>
        </div>
      </div>
    </div>
  `);
}

// ─── Journey 1: Income ─────────────────────────────────────────────────────────

function renderJourney1(block, data, onNext, savedValues = {}) {
  block.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const { fields, i18n, cfg } = data;
  const fieldDefs = getJourney1Fields(fields, i18n, cfg);

  const container = el('<div class="tax-calc"></div>');
  container.appendChild(buildStepIndicator(i18n, 1));

  const card = el('<div class="tax-calc-card"></div>');
  const cardBody = el('<div class="tax-calc-body"></div>');
  const fieldsWrap = el('<div class="tax-calc-fields"></div>');

  fieldDefs.forEach((def) => {
    // ProvidentFund is stored as decimal (0.05); display as percent (5)
    const savedVal = def.id === 'ProvidentFund' && savedValues[def.id] !== undefined
      ? savedValues[def.id] * 100
      : savedValues[def.id];
    fieldsWrap.appendChild(buildInputField(def, savedVal));
  });

  cardBody.appendChild(fieldsWrap);

  cardBody.appendChild(buildNotes(
    t(i18n, 'config-notes-title', 'Notes'),
    [t(i18n, 'common-noteText', '*Enter only taxable income without deducting personal allowances and Social Security contributions.')],
  ));

  card.appendChild(cardBody);

  const footer = el(`
    <div class="tax-calc-footer">
      <button type="button" class="tax-calc-btn tax-calc-btn-primary">${t(i18n, 'buttons-nextButton', 'Next')}</button>
    </div>
  `);
  card.appendChild(footer);
  container.appendChild(card);
  block.appendChild(container);

  const primaryBtn = footer.querySelector('.tax-calc-btn-primary');
  const syncBtnState = () => { primaryBtn.disabled = !!block.querySelector('.tax-calc-field-error:not(:empty)'); };
  container.addEventListener('input', syncBtnState);

  footer.querySelector('.tax-calc-btn-primary').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    let valid = true;

    fieldDefs.forEach((def) => {
      const input = block.querySelector(`#tc-${def.id}`);
      const wrap = input.closest('.tax-calc-input-wrap');
      const errorEl = block.querySelector(`#tc-err-${def.id}`);
      const val = parseFloat(raw(input.value)) || 0;

      if (val > def.max) {
        const msg = (def.errorMsg || 'Maximum up to {max}').replace('{max}', fmt(def.max));
        wrap.classList.add('tax-calc-input-wrap-error');
        input.classList.add('tax-calc-input-error');
        errorEl.textContent = msg;
        valid = false;
      }
    });

    if (!valid) return;

    const values = {};
    fieldDefs.forEach((def) => {
      const input = block.querySelector(`#tc-${def.id}`);
      const val = parseFloat(raw(input.value)) || 0;
      values[def.id] = val * def.factor;
    });

    btn.disabled = true;
    try {
      const payload = {
        ...values,
        NumberOfChildeBornBefore61: 0,
        NumberOfChildeBorn61OnWards: 0,
        FatherMother: 0,
        HomeInterest: 0,
        FatherInsure: 0,
        Insure: 0,
        PensionInsure: 0,
        HealthInsure: 0,
        ReduceSSF: 0,
        ReduceRMF: 0,
        ReduceESG: 0,
        Donate: 0,
        Other: 0,
      };
      const resp = await fetch(data.apiCalculateTax, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('API error');
      const result = await resp.json();
      onNext(values, result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Tax calculator API error:', err);
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Journey 2: Allowance ──────────────────────────────────────────────────────

const COMBINED_INSURANCE_MAX = 100000;

function renderJourney2(block, data, state, onBack, onCalculate) {
  block.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const { fields, i18n } = data;
  const { apiResponse, journey2 = {} } = state;
  const groups = getJourney2Groups(fields, i18n, apiResponse);

  const container = el('<div class="tax-calc"></div>');
  container.appendChild(buildStepIndicator(i18n, 2));

  const card = el('<div class="tax-calc-card"></div>');
  const cardBody = el('<div class="tax-calc-body"></div>');

  groups.forEach((group) => {
    cardBody.appendChild(buildSectionHeader(group.label, group.tooltip));

    group.fields.forEach((def) => {
      if (def.type === 'checkbox') {
        cardBody.appendChild(buildParentalCheckboxes(def, journey2[def.id]));
      } else {
        const savedVal = journey2[def.id] !== undefined ? journey2[def.id] : null;
        cardBody.appendChild(buildInputField(def, savedVal));
      }
    });
  });

  cardBody.appendChild(buildNotes(
    t(i18n, 'config-notes-title', 'Notes'),
    [
      t(i18n, 'config-notes-taxNote', '• Life insurance premiums, pension insurance premiums, health insurance premiums, RMF, Thai ESG, and donations must not exceed the allowable personal income tax deduction limits, as specified by the Revenue Department.'),
      t(i18n, 'config-notes-thaiEsgNote', '• If you have invested in Thai ESGX, please enter the amount in the "Other" field. The entered amount must comply with the conditions as specified by the Revenue Department.'),
    ],
  ));

  card.appendChild(cardBody);

  const footer = el(`
    <div class="tax-calc-footer">
      <button type="button" class="tax-calc-btn tax-calc-btn-outline">${t(i18n, 'buttons-backButton', 'Back')}</button>
      <button type="button" class="tax-calc-btn tax-calc-btn-primary">${t(i18n, 'buttons-calculateButton', 'Calculate')}</button>
    </div>
  `);
  card.appendChild(footer);
  container.appendChild(card);
  block.appendChild(container);

  const j2PrimaryBtn = footer.querySelector('.tax-calc-btn-primary');
  const syncJ2BtnState = () => { j2PrimaryBtn.disabled = !!block.querySelector('.tax-calc-field-error:not(:empty)'); };
  container.addEventListener('input', syncJ2BtnState);

  // Wire Insure + HealthInsure combined max constraint
  const insureField = block.querySelector('[data-id="Insure"]');
  const healthInsureField = block.querySelector('[data-id="HealthInsure"]');
  const insureInput = block.querySelector('#tc-Insure');
  const healthInsureInput = block.querySelector('#tc-HealthInsure');

  if (insureInput && healthInsureInput) {
    insureInput.addEventListener('input', () => {
      const val = parseFloat(raw(insureInput.value)) || 0;
      const newMax = Math.min(apiResponse.MaxHealthInsure, COMBINED_INSURANCE_MAX - val);
      if (healthInsureField?.updateMax) healthInsureField.updateMax(Math.max(0, newMax));
      syncJ2BtnState();
    });

    healthInsureInput.addEventListener('input', () => {
      const val = parseFloat(raw(healthInsureInput.value)) || 0;
      const newMax = Math.min(apiResponse.MaxInsure, COMBINED_INSURANCE_MAX - val);
      if (insureField?.updateMax) insureField.updateMax(Math.max(0, newMax));
      syncJ2BtnState();
    });
  }

  footer.querySelector('.tax-calc-btn-outline').addEventListener('click', onBack);

  footer.querySelector('.tax-calc-btn-primary').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    let valid = true;

    groups.forEach((group) => {
      group.fields.forEach((def) => {
        if (def.type === 'checkbox') return;
        const input = block.querySelector(`#tc-${def.id}`);
        if (!input) return;
        const wrap = input.closest('.tax-calc-input-wrap');
        const errorEl = block.querySelector(`#tc-err-${def.id}`);
        const val = parseFloat(raw(input.value)) || 0;

        if (val > def.max) {
          const msg = (def.errorMsg || 'Maximum up to {max}').replace('{max}', fmt(def.max));
          wrap.classList.add('tax-calc-input-wrap-error');
          input.classList.add('tax-calc-input-error');
          errorEl.textContent = msg;
          valid = false;
        }
      });
    });

    if (!valid) return;

    const values = {};
    groups.forEach((group) => {
      group.fields.forEach((def) => {
        if (def.type === 'checkbox') {
          values[def.id] = block.querySelectorAll('.tax-calc-parental .tax-calc-checkbox:checked').length;
        } else {
          const input = block.querySelector(`#tc-${def.id}`);
          values[def.id] = parseFloat(raw(input.value)) || 0;
        }
      });
    });

    btn.disabled = true;
    try {
      const payload = { ...state.journey1, ...values };
      const [resp1, resp2] = await Promise.all([
        fetch(data.apiCalculateTax, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(data.apiCalculateSaving, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ]);
      if (!resp1.ok || !resp2.ok) throw new Error('API error');
      const [result1, result2] = await Promise.all([resp1.json(), resp2.json()]);
      onCalculate(values, result1, result2);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Tax calculator API error:', err);
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Journey 3: Result ────────────────────────────────────────────────────────

function renderJourney3(block, data, state, onBack, onRecalculate) {
  block.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const { i18n } = data;
  const {
    apiResult1, apiResult2, apiResult3, journey3 = {},
  } = state;

  const taxPayment = Math.round(apiResult1.TaxPayment || 0);
  const noTax = taxPayment === 0;
  // Tax card rate comes from second API (CalculateSavingTaxBySelf); summary rate from first
  const cardTaxRate = Math.round(((apiResult2 || apiResult1).MaxTaxRateStep || 0) * 100);
  const summaryTaxRate = Math.round((apiResult1.MaxTaxRateStep || 0) * 100);

  const container = el('<div class="tax-calc"></div>');
  container.appendChild(buildStepIndicator(i18n, 3));

  const card = el('<div class="tax-calc-card"></div>');
  const cardBody = el('<div class="tax-calc-body"></div>');

  // ── Tax card(s) ──
  const bahtUnit = t(i18n, 'common-unit', 'baht');
  const noTaxLabel = t(i18n, 'results-noTaxPayable', 'No Tax Payable');
  const taxRateTpl = t(i18n, 'results-taxRateLabel', '(Tax rate {rate}%)');

  if (noTax) {
    cardBody.appendChild(el(`
      <div class="tax-calc-no-tax">
        <p class="tax-calc-no-tax-text">${noTaxLabel}</p>
      </div>
    `));
  } else if (apiResult3) {
    const newTaxAmount = Math.round(apiResult3.TaxPaymentReduce || 0);
    const savedAmount = Math.round(apiResult3.SavingTax || 0);
    const newTaxRate = Math.round((apiResult3.MaxTaxRateStep || 0) * 100);
    const cardRateStr = taxRateTpl.replace('{rate}', cardTaxRate);
    const newRateStr = taxRateTpl.replace('{rate}', newTaxRate);
    const savedLabel = t(i18n, 'results-taxSavedLabel', 'Saved');
    cardBody.appendChild(el(`
      <div class="tax-calc-tax-cards tax-calc-tax-cards-two">
        <div class="tax-calc-tax-card-wrap">
          <div class="tax-calc-tax-card tax-calc-tax-card-original">
            <p class="tax-calc-tax-card-title">${t(i18n, 'results-taxToBePaidOriginalLabel', 'Tax payable')}</p>
            <div class="tax-calc-tax-card-saved tax-calc-tax-card-saved-placeholder" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" stroke="#2DCD73"/>
              </svg>
              <p></p>
            </div>
            <p class="tax-calc-tax-card-amount">${fmt(taxPayment)} <span class="tax-calc-tax-card-unit">${bahtUnit}</span></p>
          </div>
          <p class="tax-calc-tax-rate">${cardRateStr}</p>
        </div>
        <div class="tax-calc-tax-card-wrap">
          <div class="tax-calc-tax-card tax-calc-tax-card-new">
            <p class="tax-calc-tax-card-title">${t(i18n, 'results-taxToBePaidNewLabel', 'New tax payable')}</p>
            <div class="tax-calc-tax-card-saved">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" stroke="#2DCD73"/>
              </svg>
              <p>${savedLabel} -${fmt(savedAmount)} <span class="tax-calc-tax-card-unit">${bahtUnit}</span></p>
            </div>
            <p class="tax-calc-tax-card-amount">${fmt(newTaxAmount)} <span class="tax-calc-tax-card-unit">${bahtUnit}</span></p>
          </div>
          <p class="tax-calc-tax-rate">${newRateStr}</p>
        </div>
      </div>
    `));
  } else {
    const cardRateStr = taxRateTpl.replace('{rate}', cardTaxRate);
    cardBody.appendChild(el(`
      <div class="tax-calc-tax-cards">
        <div class="tax-calc-tax-card-wrap">
          <div class="tax-calc-tax-card tax-calc-tax-card-original">
            <p class="tax-calc-tax-card-title">${t(i18n, 'results-taxToBePaidLabel', 'Tax payable')}</p>
            <p class="tax-calc-tax-card-amount">${fmt(taxPayment)} <span class="tax-calc-tax-card-unit">${bahtUnit}</span></p>
          </div>
          <p class="tax-calc-tax-rate">${cardRateStr}</p>
        </div>
      </div>
    `));
  }

  // ── Summary box (always shown, values from apiResult1) ──
  const savingTax = Math.round(apiResult1.SavingTax || 0);
  const budget = Math.round(apiResult1.Budget || 0);
  const taxPaymentReduce = Math.round(apiResult1.TaxPaymentReduce || 0);
  const summaryRateTpl = t(i18n, 'results-taxRateRemainLabel', '(The maximum tax base {rate}%)');
  const summarySubtitle = (noTax || taxPaymentReduce === 0)
    ? noTaxLabel
    : summaryRateTpl.replace('{rate}', summaryTaxRate);

  cardBody.appendChild(el(`
    <div class="tax-calc-summary-box">
      <div class="tax-calc-summary-row">
        <p class="tax-calc-summary-label">${t(i18n, 'results-maxTaxSavingsResult', 'You can save tax up to')}</p>
        <p class="tax-calc-summary-value"><span>${fmt(savingTax)}</span> <span class="tax-calc-summary-unit">${bahtUnit}</span></p>
      </div>
      <div class="tax-calc-summary-row">
        <p class="tax-calc-summary-label">${t(i18n, 'results-maxInvestmentSavingsResult', 'By investing only')}</p>
        <p class="tax-calc-summary-value"><span>${fmt(budget)}</span> <span class="tax-calc-summary-unit">${bahtUnit}</span></p>
      </div>
      <div class="tax-calc-summary-row">
        <p class="tax-calc-summary-label">${t(i18n, 'results-remainingTaxResult', 'Remaining tax')}</p>
        <p class="tax-calc-summary-value"><span>${fmt(taxPaymentReduce)}</span> <span class="tax-calc-summary-unit">${bahtUnit}</span></p>
      </div>
      <p class="tax-calc-summary-subtitle">${summarySubtitle}</p>
    </div>
  `));

  // ── Invest table (only when tax is payable) ──
  const rmfPensionMax = (apiResult1.MaxRMF || 0) + (apiResult1.MaxInsure60 || 0);
  const notesEl = buildNotes(
    t(i18n, 'config-notes-title', 'Notes'),
    [
      t(i18n, 'config-notes-investmentCalculation', 'Calculate the maximum amount that you can invest according to the conditions of the Revenue Department.'),
      t(i18n, 'config-notes-rmfAndPension', `* The combined amount of RMF and pension insurance premiums must not exceed ${fmt(rmfPensionMax)} baht`).replace('{combinedRMFPensionMax}', fmt(rmfPensionMax)),
      t(i18n, 'config-notes-lifeAndHealthInsurance', `** The combined amount of life insurance premiums and health insurance premiums must not exceed ${fmt(COMBINED_INSURANCE_MAX)} baht`).replace('{combinedLifeHealthMax}', fmt(COMBINED_INSURANCE_MAX)),
      t(i18n, 'config-notes-thaiEsg', `*** Investing in Thai ESG funds must not exceed 30% of taxable income or ${fmt(apiResult1.MaxESG)} baht whichever is lower`).replace('{thaiEsgMax}', fmt(apiResult1.MaxESG)),
    ],
  );

  if (!noTax) {
    const investFieldDefs = getJourney3InvestFields(apiResult1, i18n);

    cardBody.appendChild(el(`
      <div class="tax-calc-invest-heading">
        <h2 class="tax-calc-invest-title">${t(i18n, 'results-chooseMoreInvestmentLabel', 'Save more on tax by investing or buying insurance')}</h2>
      </div>
    `));

    const tableWrap = el('<div class="tax-calc-invest-table"></div>');
    tableWrap.appendChild(el(`
      <div class="tax-calc-invest-header">
        <div class="tax-calc-invest-header-cell">${t(i18n, 'results-investmentAmountLabel', 'Additional investment or insurance (baht)')}</div>
        <div class="tax-calc-invest-header-cell">${t(i18n, 'results-totalInvestmentLabel', 'Total amount for each item (baht)')}</div>
      </div>
    `));

    const j3ToJ2 = {
      InputRMF: 'ReduceRMF',
      InputESG: 'ReduceESG',
      InputInsure: 'Insure',
      InputHealthInsure: 'HealthInsure',
      InputInsure60: 'PensionInsure',
    };

    const fieldEls = {};
    const totalEls = {};

    investFieldDefs.forEach((def) => {
      const j2Key = j3ToJ2[def.id];
      const j2Val = state.journey2?.[j2Key] ?? 0;
      const savedJ3Val = journey3[def.id] !== undefined ? journey3[def.id] : null;
      const inputField = buildInputField(def, savedJ3Val);
      const j3Val = parseFloat(raw(inputField.querySelector('.tax-calc-input')?.value || '0')) || 0;
      const initialTotal = j2Val + j3Val;

      const row = el(`
        <div class="tax-calc-invest-row">
          <div class="tax-calc-invest-input-col"></div>
          <div class="tax-calc-invest-total-col"><span class="tax-calc-invest-total">${fmt(initialTotal)}</span></div>
        </div>
      `);
      row.querySelector('.tax-calc-invest-input-col').appendChild(inputField);
      tableWrap.appendChild(row);

      fieldEls[def.id] = inputField;
      totalEls[def.id] = row.querySelector('.tax-calc-invest-total');
    });

    cardBody.appendChild(tableWrap);
    cardBody.appendChild(notesEl);

    card.appendChild(cardBody);

    const hasJ3Values = investFieldDefs.some((def) => (journey3[def.id] || 0) > 0);
    const footer = el(`
      <div class="tax-calc-footer">
        <button type="button" class="tax-calc-btn tax-calc-btn-outline">${t(i18n, 'buttons-backButton', 'Back')}</button>
        <button type="button" class="tax-calc-btn tax-calc-btn-primary" id="tc-recalculate" ${hasJ3Values ? '' : 'disabled'}>${t(i18n, 'buttons-recalculateButton', 'Recalculate')}</button>
      </div>
    `);
    card.appendChild(footer);
    container.appendChild(card);
    block.appendChild(container);

    // Live total column updates (J2 base + J3 input)
    investFieldDefs.forEach((def) => {
      const inp = fieldEls[def.id]?.querySelector('.tax-calc-input');
      if (!inp) return;
      const j2Base = state.journey2?.[j3ToJ2[def.id]] ?? 0;
      inp.addEventListener('input', () => {
        const j3Val = parseFloat(raw(inp.value)) || 0;
        if (totalEls[def.id]) totalEls[def.id].textContent = fmt(j2Base + j3Val);
      });
    });

    // InputInsure + InputHealthInsure combined max constraint.
    // The 100k cap spans J2 + J3 together, so remaining room for J3 inputs is:
    // COMBINED_INSURANCE_MAX - J2_Insure - J2_HealthInsure
    const j2InsureBase = state.journey2?.Insure ?? 0;
    const j2HealthBase = state.journey2?.HealthInsure ?? 0;
    const remainingCombined = Math.max(0, COMBINED_INSURANCE_MAX - j2InsureBase - j2HealthBase);

    const insureField = fieldEls.InputInsure;
    const healthField = fieldEls.InputHealthInsure;
    const insureInput = insureField?.querySelector('#tc-InputInsure');
    const healthInput = healthField?.querySelector('#tc-InputHealthInsure');

    // Enable/disable recalculate
    const recalcBtn = footer.querySelector('#tc-recalculate');
    const checkRecalcEnabled = () => {
      const hasErrors = !!block.querySelector('.tax-calc-invest-table .tax-calc-field-error:not(:empty)');
      const anyNonZero = investFieldDefs.some((def) => {
        const inp = block.querySelector(`#tc-${def.id}`);
        return inp && (parseFloat(raw(inp.value)) || 0) > 0;
      });
      recalcBtn.disabled = !anyNonZero || hasErrors;
    };
    block.querySelectorAll('.tax-calc-invest-table .tax-calc-input').forEach((inp) => {
      inp.addEventListener('input', checkRecalcEnabled);
    });

    if (insureInput && healthInput) {
      const syncHealthMax = () => {
        const insureVal = parseFloat(raw(insureInput.value)) || 0;
        const cap = Math.min(apiResult1.MaxHealthInsure, remainingCombined - insureVal);
        if (healthField?.updateMax) healthField.updateMax(Math.max(0, cap));
      };
      const syncInsureMax = () => {
        const healthVal = parseFloat(raw(healthInput.value)) || 0;
        const cap = Math.min(apiResult1.MaxInsure, remainingCombined - healthVal);
        if (insureField?.updateMax) insureField.updateMax(Math.max(0, cap));
      };

      insureInput.addEventListener('input', () => { syncHealthMax(); checkRecalcEnabled(); });
      healthInput.addEventListener('input', () => { syncInsureMax(); checkRecalcEnabled(); });

      // Apply immediately so pre-populated J2 values are reflected on first render
      syncHealthMax();
      syncInsureMax();
    }

    footer.querySelector('.tax-calc-btn-outline').addEventListener('click', onBack);

    recalcBtn.addEventListener('click', async () => {
      const j3Values = {};
      investFieldDefs.forEach((def) => {
        const inp = block.querySelector(`#tc-${def.id}`);
        j3Values[def.id] = parseFloat(raw(inp?.value || '0')) || 0;
      });

      recalcBtn.disabled = true;
      try {
        const payload = {
          ...state.journey1,
          ...state.journey2,
          InputRMF: j3Values.InputRMF,
          InputESG: j3Values.InputESG,
          InputInsure: j3Values.InputInsure,
          InputHealthInsure: j3Values.InputHealthInsure,
          InputInsure60: j3Values.InputInsure60,
        };
        const resp = await fetch(data.apiCalculateSaving, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error('API error');
        const apiResult3Result = await resp.json();
        onRecalculate(j3Values, apiResult3Result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Tax calculator API error:', err);
        recalcBtn.disabled = false;
      }
    });
  } else {
    cardBody.appendChild(notesEl);
    card.appendChild(cardBody);

    const footer = el(`
      <div class="tax-calc-footer">
        <button type="button" class="tax-calc-btn tax-calc-btn-primary">${t(i18n, 'buttons-backButton', 'Back')}</button>
      </div>
    `);
    card.appendChild(footer);
    container.appendChild(card);
    block.appendChild(container);

    footer.querySelector('.tax-calc-btn-primary').addEventListener('click', onBack);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  block.innerHTML = '';
  try {
    const data = await loadData();
    const state = {};

    const goToJourney1 = () => {
      renderJourney1(block, data, (journey1Values, apiResponse) => {
        state.journey1 = journey1Values;
        state.apiResponse = apiResponse;
        goToJourney2(); // eslint-disable-line no-use-before-define
      }, state.journey1 || {});
    };

    const goToJourney3 = () => {
      // eslint-disable-next-line no-use-before-define
      renderJourney3(block, data, state, goToJourney2, (j3Values, apiResult3) => {
        state.journey3 = j3Values;
        state.apiResult3 = apiResult3;
        goToJourney3();
      });
    };

    const goToJourney2 = () => {
      renderJourney2(block, data, state, goToJourney1, (journey2Values, result1, result2) => {
        state.journey2 = journey2Values;
        state.apiResult1 = result1;
        state.apiResult2 = result2;
        goToJourney3();
      });
    };

    goToJourney1();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Tax calculator failed to initialise:', e);
  }
}
