window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.type !== 'MDV_FACEBOOK_GROUPS_REQUEST') return;
  chrome.runtime.sendMessage({ type: 'MDV_COLLECT_FACEBOOK_GROUPS' }, (response) => {
    const error = chrome.runtime.lastError?.message;
    window.postMessage({
      type: 'MDV_FACEBOOK_GROUPS_RESULT',
      groups: response?.groups || [],
      error: error || response?.error || null,
    }, window.location.origin);
  });
});
