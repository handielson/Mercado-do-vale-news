// Safe, read-only provider probe shared by the Bling page and system status.
function createBlingConnectionHealth({ getAuthHeader, fetchImpl = fetch, now = Date.now }) {
  let pending;
  let cached;
  return async function read() {
    if (pending) return pending;
    pending = (async () => {
      let state = 'unavailable';
      let authorization;
      try {
        authorization = await getAuthHeader();
        if (cached && cached.authorization === authorization && now() - cached.time < 30000) return cached.value;
        if (!authorization) state = 'disconnected';
        else {
          const response = await fetchImpl('https://api.bling.com.br/Api/v3/categorias/produtos?pagina=1&limite=1', {
            method: 'GET', headers: { Authorization: authorization, Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
          });
          if (response.status === 401) state = 'disconnected';
          else if (response.status === 403) state = 'forbidden';
          else if (response.ok && Array.isArray((await response.json()).data)) state = 'connected';
        }
      } catch { /* Never expose credentials or provider error bodies. */ }
      const value = { state, checkedAt: new Date(now()).toISOString() };
      cached = { time: now(), value, authorization };
      return value;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
module.exports = { createBlingConnectionHealth };
