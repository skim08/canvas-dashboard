// Runs before first paint: applies the saved theme so dark mode never flashes
// white (B5), and hands the tab back to Chrome when the new-tab override is off (A2).
(function () {
  try {
    var theme = localStorage.getItem('boot:theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    var palette = localStorage.getItem('boot:palette'); // J1: no flash of the wrong colors
    if (/^(classic|matcha|ocean|polar|honey)$/.test(palette || '')) document.documentElement.setAttribute('data-palette', palette); // J8
    var isNewTab = /newtab\.html$/.test(location.pathname) && location.search.indexOf('app=1') === -1;
    if (isNewTab && localStorage.getItem('boot:newtab') === '0' && typeof chrome !== 'undefined' && chrome.tabs) {
      document.documentElement.style.visibility = 'hidden';
      chrome.tabs.getCurrent(function (tab) {
        if (tab) chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' });
      });
    }
  } catch (e) {
    /* storage unavailable: fall back to system theme */
  }
})();
