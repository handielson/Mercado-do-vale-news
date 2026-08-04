const GROUPS_URL = 'https://www.facebook.com/groups/joins/?nav_source=tab&ordering=viewer_added';

async function waitForTab(tabId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function scrapeAllVisibleGroups() {
  const ignored = new Set(['feed', 'discover', 'create', 'joins', 'requests', 'notifications']);
  const byUrl = new Map();
  const readTargetCount = () => {
    const match = String(document.body?.innerText || '').match(/Todos os grupos dos quais voc[eê] participa\s*\(([\d.]+)\)/i);
    return Number(String(match?.[1] || '').replace(/\D/g, '')) || 0;
  };
  let targetCount = readTargetCount();
  const collect = () => {
    for (const anchor of document.querySelectorAll('a[href*="/groups/"]')) {
      let url;
      try { url = new URL(anchor.href, location.origin); } catch { continue; }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'groups' || !parts[1] || ignored.has(parts[1].toLowerCase())) continue;
      const cardText = String(anchor.closest('li')?.innerText || anchor.parentElement?.parentElement?.innerText || '');
      if (/pediu para participar/i.test(cardText)) continue;
      const rawName = String(anchor.innerText || anchor.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      const name = rawName
        .replace(/\s+(?:Última atividade|Visitado pela última vez).*$/i, '')
        .trim();
      if (!name || /^ver grupo$/i.test(name) || name.length > 255) continue;
      const normalizedUrl = `https://www.facebook.com/groups/${parts[1]}/`;
      const current = byUrl.get(normalizedUrl);
      if (!current || name.length < current.name.length) byUrl.set(normalizedUrl, { name, url: normalizedUrl });
    }
  };

  let stableRounds = 0;
  let previousSize = -1;
  for (let round = 0; round < 160; round += 1) {
    collect();
    targetCount = Math.max(targetCount, readTargetCount());
    if (targetCount && byUrl.size >= targetCount) break;
    stableRounds = byUrl.size === previousSize ? stableRounds + 1 : 0;
    previousSize = byUrl.size;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (stableRounds > 0 && stableRounds % 8 === 0) {
      window.scrollBy(0, -Math.max(window.innerHeight * 0.7, 500));
      await new Promise((resolve) => setTimeout(resolve, 250));
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
    if (!targetCount && stableRounds >= 24) break;
  }
  collect();
  return [...byUrl.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'MDV_COLLECT_FACEBOOK_GROUPS') return false;
  (async () => {
    let tabs = await chrome.tabs.query({ url: ['https://www.facebook.com/groups/*', 'https://facebook.com/groups/*'] });
    let tab = tabs.find((item) => item.active) || tabs[0];
    if (!tab?.id) tab = await chrome.tabs.create({ url: GROUPS_URL, active: true });
    else await chrome.tabs.update(tab.id, { url: GROUPS_URL, active: true });
    if (!tab?.id) return sendResponse({ groups: [], error: 'Não foi possível abrir a lista de grupos.' });
    await waitForTab(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const execution = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeAllVisibleGroups });
    const groups = execution?.[0]?.result || [];
    sendResponse(groups.length ? { groups } : { groups: [], error: 'A lista não carregou. Atualize o Facebook, confirme o login e tente novamente.' });
  })().catch((error) => sendResponse({ groups: [], error: error?.message || String(error) }));
  return true;
});
