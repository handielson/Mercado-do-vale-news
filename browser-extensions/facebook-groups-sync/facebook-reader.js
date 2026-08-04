function collectVisibleGroups() {
  const ignored = new Set(['feed', 'discover', 'create', 'joins', 'requests', 'notifications']);
  const byUrl = new Map();
  for (const anchor of document.querySelectorAll('a[href*="/groups/"]')) {
    let url;
    try { url = new URL(anchor.href, location.origin); } catch { continue; }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'groups' || !parts[1] || ignored.has(parts[1].toLowerCase())) continue;
    const normalizedUrl = `https://www.facebook.com/groups/${parts[1]}/`;
    const name = String(anchor.innerText || anchor.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 255) continue;
    byUrl.set(normalizedUrl, { name, url: normalizedUrl });
  }
  return [...byUrl.values()];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'MDV_READ_VISIBLE_FACEBOOK_GROUPS') return false;
  sendResponse({ groups: collectVisibleGroups() });
  return false;
});
