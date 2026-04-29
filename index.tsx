
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Build Version: 2026-02-07-18:00 - Force clean build

// ─── Auto-reload em falha de chunk após deploy novo ───────────────────────────
// Quando o Vercel deploya, o index.html antigo (em cache do browser/CDN) aponta
// pra chunks com hash que já não existem. Vite emite "vite:preloadError" e o
// browser dispara um "error" global. Damos um reload único — sessionStorage flag
// evita loop infinito caso a falha seja persistente (ex.: rede offline real).
const RELOAD_FLAG = '__chunk_reload_attempted';

function shouldReloadOnChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
    return true;
  } catch {
    return false;
  }
}

function isChunkLoadError(message: string): boolean {
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Loading CSS chunk \d+ failed|error loading dynamically imported module|Importing a module script failed/i.test(message);
}

window.addEventListener('vite:preloadError', (event) => {
  console.warn('[chunk-reload] vite:preloadError detectado, recarregando…', event);
  if (shouldReloadOnChunkError()) {
    event.preventDefault?.();
    window.location.reload();
  }
});

window.addEventListener('error', (event) => {
  if (event.message && isChunkLoadError(event.message)) {
    console.warn('[chunk-reload] erro de chunk detectado, recarregando…', event.message);
    if (shouldReloadOnChunkError()) window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || event.reason || '');
  if (isChunkLoadError(msg)) {
    console.warn('[chunk-reload] promise rejection de chunk detectada, recarregando…', msg);
    if (shouldReloadOnChunkError()) window.location.reload();
  }
});

// Limpa o flag após carregamento estável (5s sem novos erros) pra permitir
// reloads em deploys futuros nesta mesma sessão.
window.addEventListener('load', () => {
  setTimeout(() => {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* */ }
  }, 5000);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
