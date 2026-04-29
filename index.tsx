
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

// ─── Detecção proativa de nova versão (antes do erro acontecer) ───────────────
// Captura o hash do bundle no carregamento e compara com /index.html em eventos
// naturais (foco, visibilidade, primeira interação, intervalo). Se mudou, recarrega
// SILENCIOSAMENTE antes do usuário clicar em rota lazy que daria 404.
let initialBundleSig: string | null = null;
let isReloadingForNewVersion = false;

function captureCurrentBundleSig(): string | null {
  // Vite gera <script type="module" src="/assets/index-HASH.js">
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  for (const s of Array.from(scripts)) {
    const m = s.src.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
    if (m) return m[1];
  }
  return null;
}

async function checkForNewVersion() {
  if (isReloadingForNewVersion || !initialBundleSig) return;
  try {
    const html = await fetch('/index.html', { cache: 'no-store' }).then(r => r.ok ? r.text() : '');
    if (!html) return;
    const match = html.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
    const latestSig = match?.[1] || null;
    if (latestSig && latestSig !== initialBundleSig) {
      isReloadingForNewVersion = true;
      console.log('[version-check] nova versão detectada, recarregando silenciosamente…');
      window.location.reload();
    }
  } catch { /* offline ou problema de rede — ignora */ }
}

window.addEventListener('load', () => {
  initialBundleSig = captureCurrentBundleSig();
  if (!initialBundleSig) return;

  // Volta de aba inativa — é o caso mais comum: usuário deixa aba aberta, deploy acontece, volta
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewVersion();
  });

  // Foco na janela (pode acontecer sem mudar visibilidade)
  window.addEventListener('focus', checkForNewVersion);

  // Primeira interação após >30s de inatividade (cobre casos onde aba ficou aberta sem foco)
  let lastActivity = Date.now();
  const onActivity = () => {
    if (Date.now() - lastActivity > 30000) checkForNewVersion();
    lastActivity = Date.now();
  };
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, onActivity, { passive: true })
  );

  // Polling de fallback pra sessões muito longas sem mudanças de foco/visibilidade
  setInterval(checkForNewVersion, 5 * 60 * 1000);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
