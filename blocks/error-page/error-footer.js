export default function decorate(block) {
  const rows = Array.from(block.children);
  const row1 = rows[0];
  const row2 = rows[1];

  const footerContainer = document.createElement('div');
  footerContainer.className = 'error-footer-container';

  const topRow = document.createElement('div');
  topRow.className = 'error-footer-row top-row';

  const copyright = document.createElement('div');
  copyright.className = 'error-footer-copyright';
  if (row1?.children[0]) {
    copyright.append(...row1.children[0].childNodes);
  }

  const links = document.createElement('div');
  links.className = 'error-footer-links';

  const linkElements = row1?.children[1]?.querySelectorAll('a');
  if (linkElements) {
    const linksList = Array.from(linkElements);
    linksList.forEach((link, index) => {
      links.append(link.cloneNode(true));
      if (index < linksList.length - 1) {
        const pipe = document.createElement('span');
        pipe.className = 'error-footer-pipe';
        pipe.textContent = '|';
        links.append(pipe);
      }
    });
  }
  topRow.append(copyright, links);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'error-footer-row bottom-row';
  if (row2?.children[0]) {
    bottomRow.append(...row2.children[0].childNodes);
  } else if (row2) {
    bottomRow.append(...row2.childNodes);
  }
  footerContainer.append(topRow, bottomRow);
  block.textContent = '';
  block.append(footerContainer);
}
