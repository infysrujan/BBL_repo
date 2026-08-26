import createDownloadLink from '../../scripts/utils/download-helpers.js';

export default function decorate(block) {
  const [buttonRow, ...otherRows] = [...block.children];
  if (!buttonRow) return;

  const button = createDownloadLink(buttonRow);

  let isExplicitlyTrue = false;
  let isExplicitlyFalse = false;
  const contentRows = [];

  otherRows.forEach((row) => {
    const rawText = row.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    const isBoxedProp = Boolean(
      row.querySelector('[data-aue-prop="boxedCard"]')
      || row.dataset.aueProp === 'boxedCard'
      || row.querySelector('input[name="boxedCard"]'),
    );

    const isTrueVal = rawText === 'true' || rawText === 'on' || rawText === 'yes' || rawText === '1';
    const isFalseVal = rawText === 'false' || rawText === 'off' || rawText === 'no' || rawText === '0';

    if (isBoxedProp || isTrueVal || isFalseVal) {
      if (isTrueVal || (isBoxedProp && !isFalseVal && rawText !== 'false')) {
        isExplicitlyTrue = true;
      } else if (isFalseVal) {
        isExplicitlyFalse = true;
      }
      return;
    }

    if (row.textContent.trim()) {
      contentRows.push(row);
    }
  });

  let isBoxed = false;
  if (isExplicitlyTrue) {
    isBoxed = true;
  } else if (isExplicitlyFalse) {
    isBoxed = false;
  } else if (block.classList.contains('boxed-card')) {
    isBoxed = true;
  } else if (contentRows.length > 0) {
    isBoxed = true;
  }

  let titleEl = null;
  const dateElements = [];

  if (isBoxed) {
    contentRows.forEach((row) => {
      const heading = row.querySelector(':is(h1, h2, h3, h4, h5, h6), [data-aue-prop="title"]');
      if (heading && !titleEl && heading.textContent.trim()) {
        titleEl = heading;
        return;
      }

      const dateMatches = [...row.querySelectorAll('[data-aue-prop="authorableDate"], p')];
      if (dateMatches.length > 0) {
        dateMatches.forEach((el) => {
          if (el !== titleEl && el.textContent.trim()) {
            dateElements.push(el);
          }
        });
      } else if (row !== titleEl?.closest('div') && row.textContent.trim()) {
        const p = document.createElement('p');
        p.textContent = row.textContent.trim();
        dateElements.push(p);
      }
    });
  }

  block.textContent = '';

  if (isBoxed) {
    block.classList.add('boxed-card');

    if (titleEl && titleEl.textContent.trim()) {
      titleEl.classList.add('download-file-title');
      block.appendChild(titleEl);
    }
  } else {
    block.classList.remove('boxed-card');
  }

  if (button) {
    block.appendChild(button);
  }

  if (isBoxed && dateElements.length > 0) {
    dateElements.forEach((el) => {
      el.classList.add('download-file-date');
      block.appendChild(el);
    });
  }
}
