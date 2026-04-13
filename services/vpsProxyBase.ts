const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const env = (import.meta as any).env ?? {};
const isDevBuild = Boolean(env.DEV);
const forceLocalProxy = env.VITE_FORCE_LOCAL_VPS_PROXY === '1';
const isLocalRuntime =
  typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);

export const VPS_PROXY_BASE =
  isDevBuild || forceLocalProxy || isLocalRuntime ? '/vps-proxy' : '/api/vps-proxy';
