const ICON_VARIANTS = ['tiled-tab', 'icon-tab-carousel'];

function createAuthoringButton(tabName, tabVariant, tabIcon, tabIconAlt, index) {
  const button = document.createElement('button');
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
  if (index === 0) button.classList.add('active');

  if (ICON_VARIANTS.includes(tabVariant) && tabIcon) {
    const img = document.createElement('img');
    img.src = tabIcon;
    img.alt = tabIconAlt || '';
    button.appendChild(img);
  }

  button.appendChild(document.createTextNode(tabName));
  return button;
}

function createMediaImages(validTabs) {
  const imagesContainer = document.createElement('div');
  imagesContainer.className = 'tabs-images';

  validTabs.forEach(({ tabIcon, tabIconAlt }, index) => {
    const imageItem = document.createElement('div');
    if (index === 0) imageItem.classList.add('active');
    if (tabIcon) {
      const img = document.createElement('img');
      img.src = tabIcon;
      img.alt = tabIconAlt || '';
      imageItem.appendChild(img);
    }
    imagesContainer.appendChild(imageItem);
  });

  return imagesContainer;
}

export default function buildAuthoringNav(tabGroups) {
  tabGroups.forEach((group) => {
    const validTabs = group.filter((tab) => tab.tabName && tab.tabName.trim() !== '');
    if (validTabs.length === 0) return;

    const firstVariant = validTabs[0].tabVariant;

    const tabsWrapper = document.createElement('div');
    tabsWrapper.className = `tabs ${firstVariant}`;

    if (firstVariant === 'media-tab') {
      tabsWrapper.appendChild(createMediaImages(validTabs));
    }

    const tabsNavWrapper = document.createElement('div');
    tabsNavWrapper.className = 'tabs';

    const tabsNav = document.createElement('div');
    tabsNav.className = 'tabs-nav';
    tabsNav.setAttribute('role', 'tablist');

    validTabs.forEach(({
      tabName, tabVariant, tabIcon, tabIconAlt,
    }, index) => {
      tabsNav.appendChild(createAuthoringButton(tabName, tabVariant, tabIcon, tabIconAlt, index));
    });

    tabsNavWrapper.appendChild(tabsNav);
    tabsWrapper.appendChild(tabsNavWrapper);
    validTabs[0].section.insertAdjacentElement('beforebegin', tabsWrapper);
  });
}
