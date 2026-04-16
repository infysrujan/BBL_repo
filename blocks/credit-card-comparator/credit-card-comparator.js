export default function decorate(block) {
  const rows = [...block.children];

  const getValue = (row) => row?.children[1]?.textContent?.trim() ?? '';

  const link = rows[0]?.children[1]?.querySelector('a')?.href ?? '';
  const linkText = getValue(rows[1]);
  const linkTitle = getValue(rows[2]);
  const linkType = getValue(rows[3]);
  const targetLink = getValue(rows[4]);

  // eslint-disable-next-line no-console
  console.log('Credit Card Comparator - Compare CTA values:', {
    link,
    linkText,
    linkTitle,
    linkType,
    targetLink,
  });
}
