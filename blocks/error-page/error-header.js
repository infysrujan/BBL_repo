export default function decorate(block) {
  const linkEl = block.querySelector('a');
  const link = linkEl ? linkEl.href : '/en';
  const img = block.querySelector('picture');

  block.textContent = '';

  const logoLink = document.createElement('a');
  logoLink.href = link;
  logoLink.setAttribute('aria-label', 'Bangkok Bank Home');
  if (img) {
    logoLink.append(img);
  }

  block.append(logoLink);
}
