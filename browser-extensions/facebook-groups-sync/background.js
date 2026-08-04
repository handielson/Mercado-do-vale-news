async function readFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'MDV_READ_VISIBLE_FACEBOOK_GROUPS' });
  } catch {
    return { groups: [] };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'MDV_COLLECT_FACEBOOK_GROUPS') return false;
  (async () => {
    let tabs = await chrome.tabs.query({ url: ['https://www.facebook.com/groups/*', 'https://facebook.com/groups/*'] });
    let tab = tabs.find((item) => item.active) || tabs[0];
    if (!tab?.id) {
      tab = await chrome.tabs.create({ url: 'https://www.facebook.com/groups/feed/', active: true });
      await new Promise((resolve) => setTimeout(resolve, 4500));
    }
    if (!tab?.id) return sendResponse({ groups: [], error: 'Não foi possível abrir os grupos do Facebook.' });
    await chrome.tabs.update(tab.id, { active: true });
    const response = await readFromTab(tab.id);
    sendResponse(response?.groups?.length ? response : { groups: [], error: 'Abra a página “Seus grupos” no Facebook, aguarde carregar e tente novamente.' });
  })().catch((error) => sendResponse({ groups: [], error: error?.message || String(error) }));
  return true;
});
