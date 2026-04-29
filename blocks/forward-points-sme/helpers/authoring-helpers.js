function parseListItems(listElement) {
  if (!listElement) return [];
  return [...listElement.querySelectorAll('li')]
    .map((li) => li.textContent.trim())
    .filter(Boolean);
}

export default function parseAuthoring(block) {
  const rows = [...block.children];

  // Row 0: Section 1 - "Update as of" label
  const section1CalendarLabel = rows[0]?.textContent?.trim() || '';
  // Row 1: Section 1 - GO CTA label
  const section1GoCtaLabel = rows[1]?.textContent?.trim() || '';
  // Row 2: Section 1 - table column headings (richtext list)
  const s1HeadingsSrc = rows[2];
  const s1HeadingsList = s1HeadingsSrc?.querySelector('ul');
  const section1Columns = parseListItems(s1HeadingsList);
  // Row 3: Section 1 - unit label
  const section1UnitLabel = rows[3]?.textContent?.trim() || '';
  // Row 4: Section 2 - "Update as of" label
  const section2CalendarLabel = rows[4]?.textContent?.trim() || '';
  // Row 5: Section 2 - Go CTA label
  const section2GoCtaLabel = rows[5]?.textContent?.trim() || '';
  // Row 6: Print CTA label
  const printCtaLabel = rows[6]?.textContent?.trim() || '';
  // Row 7: Section 2 - forward points table title
  const section2TableTitle = rows[7]?.textContent?.trim() || '';
  // Row 8: Section 2 - table sub-title 1 (low revenue)
  const section2SubTitle1 = rows[8]?.textContent?.trim() || '';
  // Row 9: Section 2 - table sub-title 2 (mid revenue)
  const section2SubTitle2 = rows[9]?.textContent?.trim() || '';
  // Row 10: Section 2 - table column headings (richtext list)
  const s2ColsSrc = rows[10];
  const s2ColsList = s2ColsSrc?.querySelector('ul');
  const section2Columns = parseListItems(s2ColsList);
  // Row 11: Section 2 - table row headings (richtext list)
  const s2RowsSrc = rows[11];
  const s2RowsList = s2RowsSrc?.querySelector('ul');
  const section2Rows = parseListItems(s2RowsList);
  // Row 12: Section 2 - unit label
  const section2UnitLabel = rows[12]?.textContent?.trim() || '';
  // Row 13: Remark / disclaimer text (richtext)
  const remarkHtml = rows[13]?.firstElementChild?.innerHTML || '';
  // Row 14: Print logo (image reference — renders as picture/img element)
  const printLogoEl = rows[14]?.querySelector('picture, img');
  const printLogoHtml = printLogoEl?.outerHTML || '';

  return {
    section1CalendarLabel,
    section1GoCtaLabel,
    section1Columns,
    section1UnitLabel,
    section2CalendarLabel,
    section2GoCtaLabel,
    printCtaLabel,
    section2TableTitle,
    section2SubTitle1,
    section2SubTitle2,
    section2Columns,
    section2Rows,
    section2UnitLabel,
    remarkHtml,
    printLogoHtml,
  };
}
