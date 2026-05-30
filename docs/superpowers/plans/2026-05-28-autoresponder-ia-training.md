# AutoResponder IA Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VPS-backed "Treinamento IA" area inside AutoResponder so admins can teach ChatGPT store rules, tone, policies, and examples without editing code.

**Architecture:** Training entries live in MySQL on the VPS and are managed through new `/autoresponder/ai-training` endpoints. The admin page gets a new tab that reads/writes those entries through `autoResponderService`, and the webhook includes active training snippets as context when calling OpenAI. The ChatGPT hard safety prompt remains server-owned and cannot be overwritten by training content.

**Tech Stack:** Fastify/CommonJS VPS server (`vps_server.cjs` and `vps_server.js`), MySQL via `pool.query`, React/Vite TypeScript admin page, existing `vpsClient`, static Node tests in `tmp-tests`.

**Infrastructure Rule:** Nothing in this feature may be created in Vercel or Supabase. Before implementation, audit the touched files for `supabase`, `vercel`, `VITE_SUPABASE`, `SUPABASE`, and serverless routes. If any dependency tied to AutoResponder/WhatsApp/IA is found, migrate it to VPS/Synology or add it to `Bot_Whatsapp.md` Fase 11 before continuing.

---

## File Structure

- Modify `vps_server.cjs` and `vps_server.js`: add migration, CRUD helpers/routes, and active training context injection into `callAutoresponderOpenAi`.
- Modify `types/autoResponder.ts`: add `AutoResponderAiTraining`, input, update, and filter types.
- Modify `services/autoResponderService.ts`: add list/create/update/delete methods for training entries.
- Modify `pages/admin/AutoResponderPage.tsx`: add the `Treinamento IA` tab and UI state/actions.
- Modify `Bot_Whatsapp.md`: mark Fase 7 items as delivered after verification.
- Create `tmp-tests/autoresponder-ai-training-static.test.mjs`: static regression coverage that checks VPS-only storage, routes, service methods, types, UI tab, and OpenAI context wiring.

---

### Task 1: Static Test For IA Training Contract

**Files:**
- Create: `tmp-tests/autoresponder-ai-training-static.test.mjs`

- [ ] **Step 1: Audit for Vercel/Supabase dependencies in the touched scope**

Run:

```powershell
rg -n "supabase|vercel|VITE_SUPABASE|SUPABASE|npx\\.cmd vercel|npx vercel" vps_server.cjs vps_server.js pages/admin/AutoResponderPage.tsx services/autoResponderService.ts types/autoResponder.ts Bot_Whatsapp.md docs/superpowers/plans/2026-05-28-autoresponder-ia-training.md
```

Expected: existing unrelated mentions may appear in docs or legacy shared server code, but the new IA training implementation must not add any Supabase/Vercel usage. Any AutoResponder/WhatsApp/IA dependency found must be recorded in `Bot_Whatsapp.md` under Fase 11 before moving on.

- [ ] **Step 2: Write the failing static test**

Create `tmp-tests/autoresponder-ai-training-static.test.mjs`:

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const types = fs.readFileSync('types/autoResponder.ts', 'utf8');
const service = fs.readFileSync('services/autoResponderService.ts', 'utf8');
const page = fs.readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS autoresponder_ai_training/, `${file} must create the VPS training table`);
  assert.match(source, /GET',? \/autoresponder\/ai-training|fastify\.get\('\/autoresponder\/ai-training'/, `${file} must expose GET /autoresponder/ai-training`);
  assert.match(source, /fastify\.post\('\/autoresponder\/ai-training'/, `${file} must expose POST /autoresponder/ai-training`);
  assert.match(source, /fastify\.patch\('\/autoresponder\/ai-training\/:id'/, `${file} must expose PATCH /autoresponder/ai-training/:id`);
  assert.match(source, /fastify\.delete\('\/autoresponder\/ai-training\/:id'/, `${file} must expose DELETE /autoresponder/ai-training/:id`);
  assert.match(source, /loadActiveAutoresponderAiTraining/, `${file} must load active training entries`);
  assert.match(source, /buildAutoresponderAiTrainingContext/, `${file} must format training context for OpenAI`);
  assert.match(source, /AUTORESPONDER_AI_SYSTEM_PROMPT[\s\S]+buildAutoresponderAiTrainingContext/, `${file} must keep server safety prompt separate from training context`);
  assert.doesNotMatch(source, /supabase[\s\S]{0,120}autoresponder_ai_training/i, `${file} must not store IA training in Supabase`);
}

assert.match(types, /export interface AutoResponderAiTraining/, 'types must define AutoResponderAiTraining');
assert.match(types, /export interface AutoResponderAiTrainingInput/, 'types must define AutoResponderAiTrainingInput');
assert.match(types, /export interface AutoResponderAiTrainingUpdate/, 'types must define AutoResponderAiTrainingUpdate');

assert.match(service, /listAiTraining/, 'service must list IA training entries');
assert.match(service, /createAiTraining/, 'service must create IA training entries');
assert.match(service, /updateAiTraining/, 'service must update IA training entries');
assert.match(service, /deleteAiTraining/, 'service must delete IA training entries');
assert.doesNotMatch(service, /supabase\.from\(['"]autoresponder_ai_training['"]\)/, 'service must use vpsClient, not Supabase');

assert.match(page, /Treinamento IA/, 'admin page must include the Treinamento IA tab');
assert.match(page, /aiTrainingEntries/, 'admin page must keep IA training entries in state');
assert.match(page, /handleSaveAiTraining/, 'admin page must save IA training entries');
assert.match(page, /handleDeleteAiTraining/, 'admin page must delete IA training entries');
assert.match(page, /Tipo de treinamento/, 'admin page must expose the training type field');
assert.match(page, /Testar resposta/, 'admin page must let admin test responses after training changes');

console.log('autoresponder IA training static checks passed');
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
node tmp-tests\autoresponder-ai-training-static.test.mjs
```

Expected: FAIL because `autoresponder_ai_training`, routes, types, service methods, and UI tab do not exist yet.

---

### Task 2: VPS Backend Table, Helpers, And Routes

**Files:**
- Modify: `vps_server.cjs`
- Modify: `vps_server.js`

- [ ] **Step 1: Add migration for `autoresponder_ai_training`**

In `runMigrations()`, near the other AutoResponder tables/columns, add:

```js
  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_ai_training (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      training_type ENUM('store_instruction','faq','category_guidance','policy') NOT NULL DEFAULT 'store_instruction',
      content TEXT NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ai_training_active_priority (active, priority, id),
      INDEX idx_ai_training_type (training_type)
    )
  `);
```

- [ ] **Step 2: Add backend helpers**

Add these helpers near the existing OpenAI helpers:

```js
const AUTORESPONDER_AI_TRAINING_TYPES = new Set([
  'store_instruction',
  'faq',
  'category_guidance',
  'policy',
]);

function normalizeAutoresponderAiTrainingType(value) {
  const type = String(value || 'store_instruction').trim();
  return AUTORESPONDER_AI_TRAINING_TYPES.has(type) ? type : 'store_instruction';
}

function sanitizeAutoresponderAiTrainingInput(body = {}, partial = false) {
  const input = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'title')) {
    input.title = String(body.title || '').trim();
    if (!input.title) throw new Error('Titulo do treinamento e obrigatorio');
    if (input.title.length > 120) throw new Error('Titulo deve ter no maximo 120 caracteres');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'training_type')) {
    input.training_type = normalizeAutoresponderAiTrainingType(body.training_type);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'content')) {
    input.content = String(body.content || '').trim();
    if (!input.content) throw new Error('Conteudo do treinamento e obrigatorio');
    if (input.content.length > 8000) throw new Error('Conteudo deve ter no maximo 8000 caracteres');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'priority')) {
    const priority = Number(body.priority || 0);
    if (!Number.isFinite(priority)) throw new Error('Prioridade invalida');
    input.priority = Math.trunc(priority);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'active')) {
    input.active = boolInt(body.active);
  }

  return input;
}

async function loadActiveAutoresponderAiTraining(limit = 12) {
  const [rows] = await pool.query(
    `SELECT id, title, training_type, content, priority
     FROM autoresponder_ai_training
     WHERE active = 1
     ORDER BY priority DESC, id ASC
     LIMIT ?`,
    [Math.max(1, Math.min(Number(limit) || 12, 30))]
  );
  return rows;
}

function buildAutoresponderAiTrainingContext(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const lines = ['Treinamento adicional aprovado pelo Mercado do Vale:'];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. [${entry.training_type}] ${entry.title}: ${entry.content}`);
  });
  return lines.join('\n');
}
```

- [ ] **Step 3: Add CRUD routes**

Add routes near `/autoresponder/settings`:

```js
fastify.get('/autoresponder/ai-training', { preHandler: requireSyncKey }, async (request) => {
  const type = String(request.query?.type || '').trim();
  const active = request.query?.active;
  const where = [];
  const values = [];

  if (type) {
    where.push('training_type = ?');
    values.push(normalizeAutoresponderAiTrainingType(type));
  }
  if (active !== undefined && active !== null && String(active) !== '') {
    where.push('active = ?');
    values.push(boolInt(active));
  }

  const sql = [
    'SELECT * FROM autoresponder_ai_training',
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    'ORDER BY priority DESC, id ASC',
  ].filter(Boolean).join(' ');

  const [rows] = await pool.query(sql, values);
  return rows;
});

fastify.post('/autoresponder/ai-training', { preHandler: requireSyncKey }, async (request, reply) => {
  let input;
  try {
    input = sanitizeAutoresponderAiTrainingInput(request.body || {}, false);
  } catch (err) {
    return reply.code(400).send({ error: err.message });
  }

  const [result] = await pool.query(
    `INSERT INTO autoresponder_ai_training (title, training_type, content, priority, active)
     VALUES (?, ?, ?, ?, ?)`,
    [input.title, input.training_type, input.content, input.priority, input.active]
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_ai_training WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] || null;
});

fastify.patch('/autoresponder/ai-training/:id', { preHandler: requireSyncKey }, async (request, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });

  let input;
  try {
    input = sanitizeAutoresponderAiTrainingInput(request.body || {}, true);
  } catch (err) {
    return reply.code(400).send({ error: err.message });
  }

  const entries = Object.entries(input);
  if (entries.length === 0) return reply.code(400).send({ error: 'No valid training fields provided' });

  const sets = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  values.push(id);

  await pool.query(`UPDATE autoresponder_ai_training SET ${sets.join(', ')} WHERE id = ?`, values);
  const [rows] = await pool.query('SELECT * FROM autoresponder_ai_training WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/ai-training/:id', { preHandler: requireSyncKey }, async (request, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });
  await pool.query('DELETE FROM autoresponder_ai_training WHERE id = ?', [id]);
  return reply.code(204).send();
});
```

- [ ] **Step 4: Run syntax checks**

Run:

```powershell
node --check vps_server.cjs
node --check vps_server.js
```

Expected: both commands exit 0.

---

### Task 3: Include Active Training In OpenAI Context

**Files:**
- Modify: `vps_server.cjs`
- Modify: `vps_server.js`

- [ ] **Step 1: Extend `callAutoresponderOpenAi`**

Update `callAutoresponderOpenAi` so it loads active training and appends it after the fixed safety prompt:

```js
async function callAutoresponderOpenAi({ input, maxOutputTokens = 120, settings = null }) {
  if (!isAutoresponderAiEnabled(settings)) return null;
  const aiConfig = getAutoresponderAiConfig(settings);
  try {
    const trainingContext = buildAutoresponderAiTrainingContext(await loadActiveAutoresponderAiTraining());
    const systemInput = trainingContext
      ? `${AUTORESPONDER_AI_SYSTEM_PROMPT}\n\n${trainingContext}`
      : AUTORESPONDER_AI_SYSTEM_PROMPT;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        input: [
          { role: 'system', content: systemInput },
          { role: 'user', content: input },
        ],
        max_output_tokens: maxOutputTokens,
      }),
    });
```

Keep the existing response parsing and catch block unchanged.

- [ ] **Step 2: Run targeted tests**

Run:

```powershell
node tmp-tests\autoresponder-ai-training-static.test.mjs
node tmp-tests\autoresponder-openai-settings-static.test.mjs
node --check vps_server.cjs
node --check vps_server.js
```

Expected: all commands exit 0 after Task 4 and Task 5 are also complete; during this task, only syntax checks must pass.

---

### Task 4: Frontend Types And Service Methods

**Files:**
- Modify: `types/autoResponder.ts`
- Modify: `services/autoResponderService.ts`

- [ ] **Step 1: Add TypeScript interfaces**

Append to `types/autoResponder.ts` near other AutoResponder interfaces:

```ts
export type AutoResponderAiTrainingType = 'store_instruction' | 'faq' | 'category_guidance' | 'policy';

export interface AutoResponderAiTraining {
    id: number;
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: number;
    active: boolean | number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderAiTrainingInput {
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: number;
    active: boolean;
}

export type AutoResponderAiTrainingUpdate = Partial<AutoResponderAiTrainingInput>;

export interface AutoResponderAiTrainingFilters {
    type?: AutoResponderAiTrainingType | '';
    active?: boolean | number | '';
}
```

- [ ] **Step 2: Import the new types in `autoResponderService.ts`**

Add these to the existing type import list:

```ts
    AutoResponderAiTraining,
    AutoResponderAiTrainingFilters,
    AutoResponderAiTrainingInput,
    AutoResponderAiTrainingUpdate,
```

- [ ] **Step 3: Add service methods**

Add to `autoResponderService`:

```ts
    listAiTraining: (filters: AutoResponderAiTrainingFilters = {}): Promise<AutoResponderAiTraining[]> => {
        return vpsClient.get<AutoResponderAiTraining[]>(withQuery('/autoresponder/ai-training', filters));
    },

    createAiTraining: (input: AutoResponderAiTrainingInput): Promise<AutoResponderAiTraining> => {
        return vpsClient.post<AutoResponderAiTraining>('/autoresponder/ai-training', input);
    },

    updateAiTraining: (id: number, updates: AutoResponderAiTrainingUpdate): Promise<AutoResponderAiTraining | null> => {
        return vpsClient.patch<AutoResponderAiTraining | null>(`/autoresponder/ai-training/${id}`, updates);
    },

    deleteAiTraining: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/ai-training/${id}`);
    },
```

- [ ] **Step 4: Run static test**

Run:

```powershell
node tmp-tests\autoresponder-ai-training-static.test.mjs
```

Expected: still fails until the UI tab exists; type and service assertions should pass.

---

### Task 5: Admin UI Tab For Treinamento IA

**Files:**
- Modify: `pages/admin/AutoResponderPage.tsx`

- [ ] **Step 1: Import new types**

Add to the existing AutoResponder type import list:

```ts
    AutoResponderAiTraining,
    AutoResponderAiTrainingInput,
    AutoResponderAiTrainingType,
```

- [ ] **Step 2: Add tab entry**

Add a new tab after `testes` and before `configuracoes`:

```tsx
    { id: 'treinamento-ia', label: 'Treinamento IA', icon: <Bot size={16} /> },
```

- [ ] **Step 3: Add form types and defaults**

Add near other form state interfaces:

```ts
interface AiTrainingFormState {
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: string;
    active: boolean;
}
```

Add default:

```ts
const emptyAiTrainingForm: AiTrainingFormState = {
    title: '',
    training_type: 'store_instruction',
    content: '',
    priority: '0',
    active: true,
};
```

Add converter:

```ts
function aiTrainingFormToInput(form: AiTrainingFormState): AutoResponderAiTrainingInput {
    return {
        title: form.title.trim(),
        training_type: form.training_type,
        content: form.content.trim(),
        priority: Number(form.priority || 0),
        active: form.active,
    };
}
```

- [ ] **Step 4: Add state and loader**

Inside `AutoResponderPage` state block:

```tsx
    const [aiTrainingEntries, setAiTrainingEntries] = React.useState<AutoResponderAiTraining[]>([]);
    const [aiTrainingForm, setAiTrainingForm] = React.useState<AiTrainingFormState>(emptyAiTrainingForm);
    const [editingAiTraining, setEditingAiTraining] = React.useState<AutoResponderAiTraining | null>(null);
```

Inside the main `load` function, add `autoResponderService.listAiTraining()` to the parallel requests and set:

```tsx
        setAiTrainingEntries(aiTrainingData);
```

Use the local variable name `aiTrainingData`.

- [ ] **Step 5: Add save/delete handlers**

Add near other handlers:

```tsx
    const handleSaveAiTraining = async () => {
        const input = aiTrainingFormToInput(aiTrainingForm);
        if (!input.title || !input.content) {
            toast.error('Informe titulo e conteudo do treinamento.');
            return;
        }
        setSaving(true);
        try {
            if (editingAiTraining) {
                await autoResponderService.updateAiTraining(editingAiTraining.id, input);
                toast.success('Treinamento atualizado.');
            } else {
                await autoResponderService.createAiTraining(input);
                toast.success('Treinamento criado.');
            }
            setAiTrainingForm(emptyAiTrainingForm);
            setEditingAiTraining(null);
            setAiTrainingEntries(await autoResponderService.listAiTraining());
        } catch (err) {
            console.error('[AutoResponderPage] save ai training error:', err);
            toast.error('Nao foi possivel salvar o treinamento.');
        } finally {
            setSaving(false);
        }
    };

    const openEditAiTraining = (entry: AutoResponderAiTraining) => {
        setEditingAiTraining(entry);
        setAiTrainingForm({
            title: entry.title || '',
            training_type: entry.training_type || 'store_instruction',
            content: entry.content || '',
            priority: String(entry.priority || 0),
            active: isEnabled(entry.active),
        });
    };

    const handleDeleteAiTraining = async (entry: AutoResponderAiTraining) => {
        if (!window.confirm(`Excluir treinamento "${entry.title}"?`)) return;
        setSaving(true);
        try {
            await autoResponderService.deleteAiTraining(entry.id);
            setAiTrainingEntries(await autoResponderService.listAiTraining());
            if (editingAiTraining?.id === entry.id) {
                setEditingAiTraining(null);
                setAiTrainingForm(emptyAiTrainingForm);
            }
            toast.success('Treinamento excluido.');
        } catch (err) {
            console.error('[AutoResponderPage] delete ai training error:', err);
            toast.error('Nao foi possivel excluir o treinamento.');
        } finally {
            setSaving(false);
        }
    };
```

- [ ] **Step 6: Add the tab panel**

Add a `TabPanel` for `treinamento-ia` before the settings panel:

```tsx
                <TabPanel id="treinamento-ia" className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                            <h2 className="text-lg font-semibold text-slate-900">Treinamento IA</h2>
                            <div className="mt-4 space-y-4">
                                <label className="block">
                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Titulo</span>
                                    <input
                                        value={aiTrainingForm.title}
                                        onChange={(event) => setAiTrainingForm((current) => ({ ...current, title: event.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de treinamento</span>
                                    <select
                                        value={aiTrainingForm.training_type}
                                        onChange={(event) => setAiTrainingForm((current) => ({ ...current, training_type: event.target.value as AutoResponderAiTrainingType }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="store_instruction">Instrucoes da loja</option>
                                        <option value="faq">Perguntas e respostas</option>
                                        <option value="category_guidance">Categoria/produto</option>
                                        <option value="policy">Politicas</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Conteudo</span>
                                    <textarea
                                        rows={8}
                                        value={aiTrainingForm.content}
                                        onChange={(event) => setAiTrainingForm((current) => ({ ...current, content: event.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Prioridade</span>
                                        <input
                                            type="number"
                                            value={aiTrainingForm.priority}
                                            onChange={(event) => setAiTrainingForm((current) => ({ ...current, priority: event.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={aiTrainingForm.active}
                                            onChange={(event) => setAiTrainingForm((current) => ({ ...current, active: event.target.checked }))}
                                            className="h-4 w-4 rounded border-slate-300"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Ativo</span>
                                    </label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveAiTraining}
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        <Save size={16} />
                                        {editingAiTraining ? 'Atualizar treinamento' : 'Salvar treinamento'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingAiTraining(null);
                                            setAiTrainingForm(emptyAiTrainingForm);
                                        }}
                                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-900">Itens cadastrados</h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveAutoResponderTab('testes')}
                                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                    Testar resposta
                                </button>
                            </div>
                            <div className="mt-4 space-y-3">
                                {aiTrainingEntries.map((entry) => (
                                    <div key={entry.id} className="rounded-lg border border-slate-200 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <div className="font-semibold text-slate-900">{entry.title}</div>
                                                <div className="mt-1 text-xs font-semibold uppercase text-slate-500">{entry.training_type} | prioridade {entry.priority}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => openEditAiTraining(entry)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Editar</button>
                                                <button type="button" onClick={() => handleDeleteAiTraining(entry)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Excluir</button>
                                            </div>
                                        </div>
                                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{entry.content}</p>
                                    </div>
                                ))}
                                {aiTrainingEntries.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                        Nenhum treinamento cadastrado ainda.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabPanel>
```

- [ ] **Step 7: Run static test**

Run:

```powershell
node tmp-tests\autoresponder-ai-training-static.test.mjs
```

Expected: PASS after backend, types, service, and UI changes are complete.

---

### Task 6: Verification, Build, Deploy, And Docs

**Files:**
- Modify: `Bot_Whatsapp.md`

- [ ] **Step 1: Run full targeted verification**

Run:

```powershell
node tmp-tests\autoresponder-ai-training-static.test.mjs
node tmp-tests\autoresponder-openai-settings-static.test.mjs
node tmp-tests\autoresponder-catalog-request-static.test.mjs
node tmp-tests\autoresponder-test-flow-static.test.mjs
node --check vps_server.cjs
node --check vps_server.js
npm.cmd run build
```

Expected: all commands exit 0. Build may print chunk-size/dynamic-import warnings; warnings are acceptable if exit code is 0.

- [ ] **Step 2: Deploy frontend to VPS**

Run:

```powershell
npm.cmd run deploy:vps-site
```

Expected: command exits 0 and prints `Site release active: /var/www/mdv-site/releases/...`.

- [ ] **Step 3: Deploy backend to VPS**

Run:

```powershell
node deploy-vps-server-only.cjs
```

Expected: command exits 0 and PM2 shows `mdv-api` online.

- [ ] **Step 4: Validate API on VPS**

Run:

```powershell
node -e "require('dotenv').config({path:'.env.local'}); const key=process.env.VITE_VPS_SYNC_KEY||process.env.SYNC_SECRET; fetch('https://api.xiaomipetrolina.com.br/autoresponder/ai-training',{headers:{'x-sync-key':key||''}}).then(async r=>{const data=await r.json(); console.log(JSON.stringify({status:r.status, isArray:Array.isArray(data), count:Array.isArray(data)?data.length:null}, null, 2));}).catch(e=>{console.error(e.message); process.exit(1);});"
```

Expected:

```json
{
  "status": 200,
  "isArray": true,
  "count": 0
}
```

`count` may be greater than `0` if entries were already created during manual testing.

- [ ] **Step 5: Update checklist in `Bot_Whatsapp.md`**

Mark completed items in Fase 7:

```md
- [x] Criar aba **Treinamento IA** dentro de `/admin/atendimento-automatico`.
- [x] Salvar treinamento em tabela nova na VPS, por exemplo `autoresponder_ai_training`.
- [x] Separar treinamento por tipos:
  - [x] Instruções da loja: tom, regras, limites e estilo.
  - [x] Perguntas e respostas prontas.
  - [x] Conhecimento por categoria/produto, sempre vinculado a dados oficiais.
  - [x] Políticas: pagamento, garantia, entrega, troca, assistência e atendimento humano.
- [x] Permitir ativar/desativar cada item de treinamento.
- [x] Permitir prioridade/ordem de aplicação.
- [x] Criar botão **Testar com esta instrução** usando o mesmo motor de teste do AutoResponder.
- [x] Criar testes estáticos garantindo que a página usa VPS e não Supabase/Vercel.
```

Leave unchecked if not implemented in this plan:

```md
- [ ] Criar campo de busca/filtro por tipo e status.
- [ ] Criar preview do contexto que será enviado para o ChatGPT, sem expor a chave OpenAI.
- [ ] Impedir instruções perigosas, como "ignore o sistema", "invente preço" ou "responda qualquer coisa".
- [ ] Versionar alterações do treinamento com `updated_at` e, se possível, usuário responsável.
```

- [ ] **Step 6: Final report**

Report:

```text
Treinamento IA implantado na VPS. A página fica em AutoResponder > Treinamento IA. A API usa /autoresponder/ai-training e a OpenAI recebe apenas treinamentos ativos, depois do prompt de segurança fixo do servidor.

Verificações:
- node tmp-tests\autoresponder-ai-training-static.test.mjs
- node tmp-tests\autoresponder-openai-settings-static.test.mjs
- node tmp-tests\autoresponder-catalog-request-static.test.mjs
- node tmp-tests\autoresponder-test-flow-static.test.mjs
- node --check vps_server.cjs
- node --check vps_server.js
- npm.cmd run build

Deploy:
- npm.cmd run deploy:vps-site
- node deploy-vps-server-only.cjs
```

---

## Self-Review

- Spec coverage: This plan implements Fase 7 MVP and keeps the ChatGPT safety prompt server-controlled. It does not implement Central de Atendimento, manual sending, or human takeover automation; those belong in a separate plan.
- Placeholder scan: No placeholder tasks are left; remaining unchecked Fase 7 items are explicitly deferred in Task 6 because they are not part of the MVP.
- Type consistency: `training_type`, `AutoResponderAiTrainingType`, `aiTrainingEntries`, and `/autoresponder/ai-training` are used consistently across backend, types, service, and UI.
