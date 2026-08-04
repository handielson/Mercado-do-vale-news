// Leitor de compatibilidade. A versão 1.1 usa chrome.scripting no processo principal,
// portanto funciona inclusive quando a aba do Facebook já estava aberta na instalação.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'MDV_READ_VISIBLE_FACEBOOK_GROUPS') return false;
  const groups = [];
  const seen = new Set();
  for (const anchor of document.querySelectorAll('a[href*="/groups/"]')) {
    const match = String(anchor.href || '').match(/facebook\.com\/groups\/([^/?#]+)/i);
    const name = String(anchor.innerText || '').replace(/\s+(?:Última atividade|Visitado pela última vez).*$/i, '').trim();
    if (!match || !name || seen.has(match[1])) continue;
    seen.add(match[1]);
    groups.push({ name, url: `https://www.facebook.com/groups/${match[1]}/` });
  }
  sendResponse({ groups });
  return false;
});
