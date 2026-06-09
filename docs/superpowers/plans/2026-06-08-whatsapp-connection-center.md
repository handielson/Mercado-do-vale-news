# WhatsApp Connection Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the WhatsApp connection experience from the legacy AutoResponder screen into `/admin/settings/whatsapp`, establishing that page as the new WhatsApp center while keeping the old module working.

**Architecture:** Keep the existing VPS/Fastify endpoints and `autoResponderService` methods for now, because they are already connected to Evolution and production-tested. Add focused React components for the new WhatsApp center: a connection panel and a migration checklist. The legacy `/admin/atendimento-automatico` route remains untouched during this phase.

**Tech Stack:** React/Vite/TypeScript admin UI, existing `vpsClient`, existing `autoResponderService`, Fastify VPS routes already deployed, static Node regression tests in `tmp-tests`.

---

## Progress Update - 2026-06-08

Implemented and deployed:

- WhatsApp Center available at `/admin/settings/whatsapp` with connection/status/debug panel.
- Migration checklist added to the WhatsApp Center.
- Recent conversations/attendance panel added to the WhatsApp Center.
- Human pause controls added for 1h, 4h and reset.
- Bot log history panel added to each conversation.
- Missing deployed VPS route fixed for `GET /autoresponder/conversations/:sender/logs`.
- Customer name confirmation flow connected to Google Contacts integration.
- Customer-facing replies now use only the first name after confirmation; the full confirmed name remains available for Google Contacts.
- Broadcast list opt-in documented in `docs/autoresponder/archive/Bot_Whatsapp.md`: customer must be asked before being included.

Verification already performed:

- `node tmp-tests\whatsapp-connection-center-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-greeting-message-static.test.mjs`
- `node tmp-tests\autoresponder-google-contact-flow-static.test.mjs`
- `npm.cmd run build`
- Production VPS route check returned `200 OK` for the conversation history endpoint after backend deploy.

Latest pushed commits for this block:

- `0c840d9 fix(whatsapp): deploy conversation logs route`
- `05a2494 feat(whatsapp): use first name for confirmed contacts`

Next recommended block:

- Continue in the WhatsApp Center with the atendimento/operation surface: message sending from the panel, clearer queue states and human handoff workflow.
- Keep ChatGPT/tooling migration as the next larger block after attendance is operationally comfortable.

---

## File Structure

- Modify `pages/admin/settings/WhatsAppPage.tsx`: turn the existing simple settings page into the new WhatsApp center shell and render the connection panel.
- Create `components/whatsapp/WhatsAppConnectionPanel.tsx`: owns connection state, QR generation, disconnect action, and debug rendering.
- Create `components/whatsapp/WhatsAppMigrationChecklist.tsx`: shows what has been migrated and what remains.
- Create `tmp-tests/whatsapp-connection-center-static.test.mjs`: static regression test that verifies the new page uses the connection panel, keeps migration checklist visible, and does not remove the legacy AutoResponder route.
- Optionally keep `services/autoResponderService.ts` unchanged in this phase; it already exposes `getWhatsAppConnectionState`, `getWhatsAppDebug`, `connectWhatsApp`, and `disconnectWhatsApp`.

---

### Task 1: Static Test For New WhatsApp Center Contract

**Files:**
- Create: `tmp-tests/whatsapp-connection-center-static.test.mjs`
- Read: `pages/admin/settings/WhatsAppPage.tsx`
- Read: `components/whatsapp/WhatsAppConnectionPanel.tsx`
- Read: `components/whatsapp/WhatsAppMigrationChecklist.tsx`
- Read: `routes/index.tsx`
- Read: `services/autoResponderService.ts`

- [ ] **Step 1: Write the failing static test**

Create `tmp-tests/whatsapp-connection-center-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const whatsappPage = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');

assert.ok(
  existsSync('components/whatsapp/WhatsAppConnectionPanel.tsx'),
  'WhatsApp center must have a focused connection panel component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppMigrationChecklist.tsx'),
  'WhatsApp center must show a migration checklist component',
);

const connectionPanel = readFileSync('components/whatsapp/WhatsAppConnectionPanel.tsx', 'utf8');
const checklist = readFileSync('components/whatsapp/WhatsAppMigrationChecklist.tsx', 'utf8');

[
  'WhatsAppConnectionPanel',
  'WhatsAppMigrationChecklist',
  'Centro WhatsApp',
  'Conexao WhatsApp',
].forEach((needle) => {
  assert.ok(whatsappPage.includes(needle), `WhatsAppPage must include ${needle}`);
});

[
  'getWhatsAppConnectionState',
  'getWhatsAppDebug',
  'connectWhatsApp',
  'disconnectWhatsApp',
  'Gerar QR Code / Conectar',
  'Desconectar WhatsApp',
  'pairingCode',
  'base64',
  'evolutionStatus',
  'fetchInstances',
  'connectionState',
].forEach((needle) => {
  assert.ok(connectionPanel.includes(needle), `connection panel must include ${needle}`);
});

[
  'Conexao',
  'Atendimento',
  'ChatGPT',
  'Lista de celulares',
  'Curadoria',
  'Configuracoes',
].forEach((needle) => {
  assert.ok(checklist.includes(needle), `migration checklist must include ${needle}`);
});

[
  'getWhatsAppConnectionState',
  'getWhatsAppDebug',
  'connectWhatsApp',
  'disconnectWhatsApp',
].forEach((needle) => {
  assert.ok(service.includes(needle), `autoResponderService must keep ${needle}`);
});

assert.ok(
  routes.includes('path: "/admin/settings/whatsapp"'),
  'new WhatsApp center route must stay at /admin/settings/whatsapp',
);
assert.ok(
  routes.includes('path: "/admin/atendimento-automatico"'),
  'legacy AutoResponder route must remain during phase 1',
);

console.log('whatsapp connection center static checks passed');
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node tmp-tests\whatsapp-connection-center-static.test.mjs
```

Expected: FAIL because `components/whatsapp/WhatsAppConnectionPanel.tsx` and `components/whatsapp/WhatsAppMigrationChecklist.tsx` do not exist yet.

- [ ] **Step 3: Commit the failing test**

Run:

```powershell
git add -- 'tmp-tests/whatsapp-connection-center-static.test.mjs'
git commit -m "test(whatsapp): define connection center contract"
```

---

### Task 2: Build Migration Checklist Component

**Files:**
- Create: `components/whatsapp/WhatsAppMigrationChecklist.tsx`
- Test: `tmp-tests/whatsapp-connection-center-static.test.mjs`

- [ ] **Step 1: Create the checklist component**

Create `components/whatsapp/WhatsAppMigrationChecklist.tsx`:

```tsx
import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

type MigrationStatus = 'done' | 'testing' | 'pending';

const items: Array<{ label: string; status: MigrationStatus; description: string }> = [
  {
    label: 'Conexao',
    status: 'testing',
    description: 'Status, QR Code, pairing code, desconexao e debug da Evolution.',
  },
  {
    label: 'Atendimento',
    status: 'pending',
    description: 'Fila de conversas, pausa para humano e historico de mensagens.',
  },
  {
    label: 'ChatGPT',
    status: 'pending',
    description: 'Atendente principal com limites, ferramentas oficiais e fallback seguro.',
  },
  {
    label: 'Lista de celulares',
    status: 'pending',
    description: 'Ferramenta oficial preservada para listar celulares reais do catalogo.',
  },
  {
    label: 'Curadoria',
    status: 'pending',
    description: 'Perguntas nao respondidas, treinamento e melhoria continua.',
  },
  {
    label: 'Configuracoes',
    status: 'pending',
    description: 'Parametros finos, chaves, horarios, politicas e seguranca.',
  },
];

function statusMeta(status: MigrationStatus) {
  if (status === 'done') {
    return {
      icon: <CheckCircle2 size={16} />,
      label: 'feito',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (status === 'testing') {
    return {
      icon: <Clock size={16} />,
      label: 'em teste',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }
  return {
    icon: <Circle size={16} />,
    label: 'pendente',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  };
}

export function WhatsAppMigrationChecklist() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Migracao para o Centro WhatsApp</h3>
        <p className="mt-1 text-xs text-slate-500">
          Acompanhamento das funcoes que saem do AutoResponder legado e entram nesta pagina.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const meta = statusMeta(item.status);
          return (
            <div key={item.label} className={`rounded-lg border p-3 ${meta.className}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                <span className="text-xs font-medium uppercase">{meta.label}</span>
              </div>
              <p className="mt-2 text-xs leading-5">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run the static test and verify it still fails for the missing connection panel**

Run:

```powershell
node tmp-tests\whatsapp-connection-center-static.test.mjs
```

Expected: FAIL because `components/whatsapp/WhatsAppConnectionPanel.tsx` still does not exist.

- [ ] **Step 3: Commit checklist component**

Run:

```powershell
git add -- 'components/whatsapp/WhatsAppMigrationChecklist.tsx'
git commit -m "feat(whatsapp): add migration checklist"
```

---

### Task 3: Build Connection Panel Component

**Files:**
- Create: `components/whatsapp/WhatsAppConnectionPanel.tsx`
- Test: `tmp-tests/whatsapp-connection-center-static.test.mjs`

- [ ] **Step 1: Create the connection panel component**

Create `components/whatsapp/WhatsAppConnectionPanel.tsx`:

```tsx
import React from 'react';
import { Bot, CheckCircle2, PlugZap, Power, QrCode, RefreshCw, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';

type WhatsAppState = 'loading' | 'open' | 'connecting' | 'close' | 'error';

function normalizeConnectionState(value: unknown): WhatsAppState {
  const state = String(value || '').toLowerCase();
  if (state === 'open') return 'open';
  if (state === 'connecting') return 'connecting';
  if (state === 'close' || state === 'closed') return 'close';
  return 'close';
}

function summarizeDebug(debug: any) {
  const instance = Array.isArray(debug?.fetchInstances?.body)
    ? debug.fetchInstances.body.find((item: any) => item?.name === debug?.instanceName) || debug.fetchInstances.body[0]
    : null;

  return {
    version: debug?.evolutionStatus?.body?.version || '-',
    instanceName: debug?.instanceName || '-',
    number: instance?.number || '-',
    state: debug?.connectionState?.body?.instance?.state || instance?.connectionStatus || '-',
    lastError: instance?.disconnectionObject || debug?.connectionState?.body?.response?.message?.join?.('; ') || '',
  };
}

export function WhatsAppConnectionPanel() {
  const [state, setState] = React.useState<WhatsAppState>('loading');
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [pairingCode, setPairingCode] = React.useState<string | null>(null);
  const [debug, setDebug] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadState = React.useCallback(async () => {
    try {
      setError(null);
      const result = await autoResponderService.getWhatsAppConnectionState();
      setState(normalizeConnectionState(result?.instance?.state));
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Falha ao verificar conexao do WhatsApp.');
    }
  }, []);

  const loadDebug = React.useCallback(async () => {
    try {
      const result = await autoResponderService.getWhatsAppDebug();
      setDebug(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar debug da Evolution.');
    }
  }, []);

  React.useEffect(() => {
    void loadState();
    void loadDebug();
  }, [loadDebug, loadState]);

  React.useEffect(() => {
    if (state !== 'connecting') return;
    const interval = window.setInterval(() => {
      void loadState();
      void loadDebug();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loadDebug, loadState, state]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const result = await autoResponderService.connectWhatsApp();
      setQrCode(result?.base64 || null);
      setPairingCode(result?.pairingCode || null);
      setState(result?.instance?.state === 'open' ? 'open' : 'connecting');
      await loadDebug();
      toast.success('QR Code gerado para conexao do WhatsApp');
    } catch (err) {
      setState('close');
      setError(err instanceof Error ? err.message : 'Nao foi possivel gerar o QR Code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Tem certeza de que deseja desconectar o WhatsApp?')) return;
    setBusy(true);
    setError(null);
    try {
      await autoResponderService.disconnectWhatsApp();
      setQrCode(null);
      setPairingCode(null);
      await loadState();
      await loadDebug();
      toast.success('WhatsApp desconectado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desconectar WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  const debugSummary = summarizeDebug(debug);
  const isConnected = state === 'open';

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-600">Conexao WhatsApp</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Evolution API</h3>
          <p className="mt-1 text-sm text-slate-500">
            Conecte o numero da loja para receber mensagens e responder pela nossa ferramenta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadState();
              void loadDebug();
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Power size={16} />
              Desconectar WhatsApp
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <QrCode size={16} />
              {busy ? 'Gerando...' : 'Gerar QR Code / Conectar'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          {state === 'loading' && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="animate-spin" size={28} />
              <span className="text-sm font-semibold">Verificando conexao...</span>
            </div>
          )}

          {isConnected && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={30} />
              </div>
              <h4 className="text-base font-semibold text-slate-900">WhatsApp conectado</h4>
              <p className="max-w-md text-sm text-slate-500">
                A loja ja pode receber mensagens pela Evolution e responder usando a nossa ferramenta.
              </p>
            </div>
          )}

          {state !== 'loading' && !isConnected && qrCode && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <h4 className="text-base font-semibold text-slate-900">Leia o QR Code abaixo</h4>
              <img src={qrCode} alt="QR Code do WhatsApp" className="h-64 w-64 rounded-lg border border-slate-200 bg-white p-2" />
              {pairingCode && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                  Codigo: {pairingCode}
                </div>
              )}
            </div>
          )}

          {state !== 'loading' && !isConnected && !qrCode && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <WifiOff size={30} />
              </div>
              <h4 className="text-base font-semibold text-slate-900">WhatsApp desconectado</h4>
              <p className="max-w-md text-sm text-slate-500">
                Gere um QR Code para conectar o numero da loja na Evolution API.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-900">
            <Bot size={18} />
            <h4 className="text-sm font-semibold">Debug Evolution</h4>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-400">Versao</dt>
              <dd className="font-medium text-slate-700">{debugSummary.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Instancia</dt>
              <dd className="font-medium text-slate-700">{debugSummary.instanceName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Numero</dt>
              <dd className="font-medium text-slate-700">{debugSummary.number}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Estado</dt>
              <dd className="font-medium text-slate-700">{debugSummary.state}</dd>
            </div>
          </dl>
          {debugSummary.lastError && (
            <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Ultimo erro</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">{debugSummary.lastError}</pre>
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run the static test and verify it still fails for missing page integration**

Run:

```powershell
node tmp-tests\whatsapp-connection-center-static.test.mjs
```

Expected: FAIL because `WhatsAppPage.tsx` does not render `WhatsAppConnectionPanel` yet.

- [ ] **Step 3: Commit connection panel**

Run:

```powershell
git add -- 'components/whatsapp/WhatsAppConnectionPanel.tsx'
git commit -m "feat(whatsapp): add connection panel"
```

---

### Task 4: Convert WhatsApp Page Into New Center Shell

**Files:**
- Modify: `pages/admin/settings/WhatsAppPage.tsx`
- Test: `tmp-tests/whatsapp-connection-center-static.test.mjs`

- [ ] **Step 1: Replace the old settings-only page with the new center shell**

Edit `pages/admin/settings/WhatsAppPage.tsx` so it becomes:

```tsx
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WhatsAppConnectionPanel } from '../../../components/whatsapp/WhatsAppConnectionPanel';
import { WhatsAppMigrationChecklist } from '../../../components/whatsapp/WhatsAppMigrationChecklist';

export default function WhatsAppPage() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <MessageCircle className="text-emerald-500" size={28} />
          Centro WhatsApp
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Nova central para conexao, atendimento, ChatGPT, ferramentas oficiais e migracao gradual das funcoes do AutoResponder legado.
        </p>
      </div>

      <div className="space-y-4">
        <WhatsAppMigrationChecklist />
        <WhatsAppConnectionPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the static test and verify it passes**

Run:

```powershell
node tmp-tests\whatsapp-connection-center-static.test.mjs
```

Expected: PASS with `whatsapp connection center static checks passed`.

- [ ] **Step 3: Run existing WhatsApp/Evolution regression tests**

Run:

```powershell
node tmp-tests\autoresponder-whatsapp-evolution-static.test.mjs
node tmp-tests\autoresponder-admin-page-static.test.mjs
```

Expected: both PASS.

- [ ] **Step 4: Commit page integration**

Run:

```powershell
git add -- 'pages/admin/settings/WhatsAppPage.tsx'
git commit -m "feat(whatsapp): make settings page the connection center"
```

---

### Task 5: Build, Publish, And Browser Verify

**Files:**
- Verify: `dist`
- Publish via existing VPS site deploy script

- [ ] **Step 1: Build locally**

Run:

```powershell
npm.cmd run build
```

Expected: Vite build succeeds.

- [ ] **Step 2: Deploy frontend site to VPS**

Run:

```powershell
node scripts\deploy-vps-site.cjs
```

Expected:
- New release is uploaded under `/var/www/mdv-site/releases/<timestamp>`.
- `/var/www/mdv-site/current` points to the new release.

- [ ] **Step 3: Verify backend is still healthy**

Run:

```powershell
curl.exe -s -o NUL -w "%{http_code}" https://api.xiaomipetrolina.com.br/health
```

Expected: `200`.

- [ ] **Step 4: Verify the new page loads in production**

Open:

```text
https://www.mercadodovale.com.br/admin/settings/whatsapp
```

Expected:
- Header says `Centro WhatsApp`.
- Checklist appears.
- Connection panel appears.
- Current state shows connected or disconnected correctly.
- Debug panel shows Evolution version and instance name.

- [ ] **Step 5: Verify QR flow only if disconnected**

If the panel shows disconnected, click `Gerar QR Code / Conectar`.

Expected:
- QR Code appears.
- No 502 error appears.
- After scanning, status changes to connected.

If the panel already shows connected, do not disconnect during this phase unless the user explicitly asks.

- [ ] **Step 6: Commit any verification-only doc update if needed**

If verification reveals a useful operational note, append it to `docs/autoresponder/archive/Bot_Whatsapp.md` or a new WhatsApp migration note. Otherwise do not create a docs-only commit.

---

### Task 6: Final Cleanup And Handoff

**Files:**
- Verify: working tree
- Verify: latest commits

- [ ] **Step 1: Check working tree**

Run:

```powershell
git status --short
```

Expected: clean working tree.

- [ ] **Step 2: Push commits**

Run:

```powershell
git push origin HEAD:main
```

Expected: push succeeds.

- [ ] **Step 3: Report the phase result**

Report:
- New page path: `/admin/settings/whatsapp`.
- What migrated: Conexao WhatsApp.
- What remains legacy: Atendimento, ChatGPT, Lista de celulares, Curadoria, Configuracoes.
- Production verification result.

---

## Self-Review

- Spec coverage: The plan covers the first approved phase only: move WhatsApp connection/status/debug into `/admin/settings/whatsapp`, keep the legacy AutoResponder route, and show migration status.
- Placeholder scan: No deferred implementation placeholders remain. Each task has concrete files, commands, expected output, and code.
- Type consistency: Component names, service methods, route strings, and checklist labels match across tests and implementation tasks.
