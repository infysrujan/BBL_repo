export default function buildAuthoringNav(tabGroups) {
  tabGroups.forEach((group) => {
    const validTabs = group.filter((tab) => tab.tabName && tab.tabName.trim() !== '');
    if (validTabs.length === 0) return;

    const firstVariant = validTabs[0].tabVariant;

    const tabsWrapper = document.createElement('div');
    tabsWrapper.className = `tabs ${firstVariant}`;

    const tabsNavWrapper = document.createElement('div');
    tabsNavWrapper.className = 'tabs-nav-wrapper';

    const tabsNav = document.createElement('div');
    tabsNav.className = 'tabs-nav';
    tabsNav.setAttribute('role', 'tablist');

    validTabs.forEach(({ tabName }, index) => {
      const button = document.createElement('button');
      button.textContent = tabName;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      if (index === 0) button.classList.add('active');
      tabsNav.appendChild(button);
    });

    tabsNavWrapper.appendChild(tabsNav);
    tabsWrapper.appendChild(tabsNavWrapper);
    validTabs[0].section.insertAdjacentElement('beforebegin', tabsWrapper);
  });
}
