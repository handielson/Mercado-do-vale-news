type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
const browser = globalThis as typeof globalThis & { turnstile?: Turnstile };
let loading: Promise<Turnstile> | undefined;

function load(): Promise<Turnstile> {
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(failed, 15000);
    function failed() {
      window.clearTimeout(timeout); script.remove(); loading = undefined;
      reject(new Error('Não foi possível carregar a verificação de segurança. Tente novamente.'));
    }
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onerror = failed;
    script.onload = () => {
      if (!browser.turnstile) { failed(); return; }
      window.clearTimeout(timeout); resolve(browser.turnstile);
    };
    document.head.appendChild(script);
  });
  return loading;
}

// One fresh token for each POST. No cached token or fallback that skips checks.
export async function storefrontCaptchaToken(sitekey: string | undefined, action: 'print3d_auth' | 'mdv_auth'): Promise<string> {
  if (!sitekey) throw new Error('Verificação de segurança ainda não configurada.');
  const api = await load();
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Verificação de segurança');
    dialog.style.cssText = 'border:1px solid #d9dcd7;border-radius:16px;padding:24px;max-width:calc(100vw - 24px);';
    const label = document.createElement('p');
    label.textContent = 'Verificando sua solicitação…';
    label.setAttribute('role', 'status');
    const container = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancelar'; cancel.type = 'button';
    cancel.style.cssText = 'display:block;margin-top:16px;padding:8px;cursor:pointer;';
    dialog.append(label, container, cancel); document.body.appendChild(dialog); dialog.showModal();
    let widget: string | undefined;
    let settled = false;
    const timeout = window.setTimeout(() => finish(undefined), 120000);
    const finish = (token?: string) => {
      if (settled) return;
      settled = true; window.clearTimeout(timeout);
      if (widget !== undefined) api.remove(widget);
      dialog.close(); dialog.remove();
      if (token) resolve(token);
      else reject(new Error('Verificação não concluída. Tente novamente.'));
    };
    cancel.onclick = () => finish();
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    try {
      widget = api.render(container, {
        sitekey, action, language: 'pt-br', size: 'compact',
        callback: (token: string) => finish(token),
        'error-callback': () => finish(), 'expired-callback': () => finish(),
        'timeout-callback': () => finish(), retry: 'never',
      });
    } catch { finish(); }
  });
}

export function print3dCaptchaToken(): Promise<string> {
  return storefrontCaptchaToken(import.meta.env.VITE_PRINT3D_TURNSTILE_SITE_KEY, 'print3d_auth');
}
