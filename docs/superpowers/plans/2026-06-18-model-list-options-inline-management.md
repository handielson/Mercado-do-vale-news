# Model List Options Inline Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add aligned create/edit controls to every list field in the model editor and automatically persist and select missing list values returned by AI.

**Architecture:** Extract option normalization and persistence into a focused service that understands manual custom-field options, known domain tables, and generic table relations. Render list fields through a reusable controlled component and compact editor modal. Resolve AI `missingChoices` asynchronously before applying model values, preserving successful fields when one option creation fails.

**Tech Stack:** React 18, TypeScript, Vite, Lucide icons, Sonner toasts, Node static regression tests, VPS REST APIs.

---

## File Structure

- Create `components/settings/modelListOptionCore.js`: pure normalization, duplicate matching, generic-value rejection, and AI resolution helpers.
- Create `services/modelListOptions.ts`: persistence adapter for manual lists, colors, RAM, storage, versions, and generic table relations.
- Create `components/settings/ModelListFieldInput.tsx`: stable list row with select, add button, edit button, and per-field loading state.
- Create `components/settings/ModelListOptionModal.tsx`: compact create/edit form, including optional color hex input.
- Modify `components/settings/ModelModal.tsx`: own option state, open editor modal, refresh fields, resolve AI missing choices, and use the extracted list input.
- Modify `services/table-data.ts`: expose explicit row creation and update methods for configured generic relations.
- Modify `components/settings/modelJsonImport.js`: keep missing choice values available for asynchronous resolution without applying invalid values early.
- Create `tmp-tests/model-list-option-core.test.mjs`: behavior tests for matching, rejection, and partial AI resolution.
- Create `tmp-tests/model-list-option-ui-static.test.mjs`: static checks for aligned controls and modal integration.
- Create `tmp-tests/model-list-option-service-static.test.mjs`: static checks for persistence routing.
- Modify `tmp-tests/model-json-import.test.mjs`: verify missing choices remain resolvable.
- Modify `tmp-tests/model-modal-brand-source.test.mjs`: preserve fresh option reload behavior.

### Task 1: Pure Option Rules

**Files:**
- Create: `components/settings/modelListOptionCore.js`
- Create: `tmp-tests/model-list-option-core.test.mjs`

- [ ] **Step 1: Write failing tests for normalization and duplicate matching**

```js
import assert from 'node:assert/strict';
import {
  findEquivalentOption,
  isCreatableAiOption,
  normalizeOptionText,
} from '../components/settings/modelListOptionCore.js';

assert.equal(normalizeOptionText('  Gorilla   Glass 5 '), 'gorilla glass 5');
assert.deepEqual(
  findEquivalentOption('GORILLA glass 5', [
    { value: 'glass-3', label: 'Gorilla Glass 3' },
    { value: 'glass-5', label: 'Gorilla Glass 5' },
  ]),
  { value: 'glass-5', label: 'Gorilla Glass 5' }
);
assert.equal(isCreatableAiOption('Nao informado'), false);
assert.equal(isCreatableAiOption('Consulte'), false);
assert.equal(isCreatableAiOption('Gorilla Glass Victus 3'), true);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tmp-tests/model-list-option-core.test.mjs`

Expected: FAIL with module-not-found for `modelListOptionCore.js`.

- [ ] **Step 3: Implement the pure helpers**

```js
const BLOCKED_AI_VALUES = new Set([
  '',
  'nao informado',
  'desconhecido',
  'consulte',
  'n/a',
  'null',
  'undefined',
]);

export function normalizeOptionText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function findEquivalentOption(value, options = []) {
  const normalized = normalizeOptionText(value);
  return options.find((option) => normalizeOptionText(option.label ?? option.value) === normalized) || null;
}

export function isCreatableAiOption(value) {
  return !BLOCKED_AI_VALUES.has(normalizeOptionText(value));
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node tmp-tests/model-list-option-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- components/settings/modelListOptionCore.js tmp-tests/model-list-option-core.test.mjs
git commit -m "test(model): define list option matching rules"
```

### Task 2: Table Row Persistence

**Files:**
- Modify: `services/table-data.ts`
- Create: `tmp-tests/model-list-option-service-static.test.mjs`

- [ ] **Step 1: Write a failing static test for create and update methods**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/table-data.ts', 'utf8');
assert.match(source, /async createRow\(/);
assert.match(source, /vpsClient\.post<TableRow>\(`\/table-data\/\$\{encodeURIComponent\(tableName\)\}`/);
assert.match(source, /async updateRow\(/);
assert.match(source, /vpsClient\.patch<TableRow>\([\s\S]*\?pk=/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tmp-tests/model-list-option-service-static.test.mjs`

Expected: FAIL because `createRow` and `updateRow` do not exist.

- [ ] **Step 3: Add explicit row mutation methods**

Add to `tableDataService`:

```ts
async createRow(tableName: string, values: TableRow): Promise<TableRow> {
    return vpsClient.post<TableRow>(
        `/table-data/${encodeURIComponent(tableName)}`,
        values
    );
},

async updateRow(
    tableName: string,
    primaryKey: string,
    primaryValue: string | number,
    values: TableRow
): Promise<TableRow> {
    return vpsClient.patch<TableRow>(
        `/table-data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryValue))}?pk=${encodeURIComponent(primaryKey)}`,
        values
    );
},
```

Export `TableRow` so the persistence adapter can type generic values.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node tmp-tests/model-list-option-service-static.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- services/table-data.ts tmp-tests/model-list-option-service-static.test.mjs
git commit -m "feat(model): add table relation row mutations"
```

### Task 3: Unified Option Persistence Adapter

**Files:**
- Create: `services/modelListOptions.ts`
- Modify: `tmp-tests/model-list-option-service-static.test.mjs`

- [ ] **Step 1: Extend the failing test with persistence routing requirements**

```js
const optionService = readFileSync('services/modelListOptions.ts', 'utf8');
assert.match(optionService, /customFieldsService\.update/);
assert.match(optionService, /colorService\.(create|update)/);
assert.match(optionService, /ramService\.(create|update)/);
assert.match(optionService, /storageService\.(create|update)/);
assert.match(optionService, /versionService\.(create|update)/);
assert.match(optionService, /tableDataService\.(createRow|updateRow)/);
assert.match(optionService, /findEquivalentOption/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tmp-tests/model-list-option-service-static.test.mjs`

Expected: FAIL because `services/modelListOptions.ts` does not exist.

- [ ] **Step 3: Implement typed create/edit contracts**

Define:

```ts
export interface ModelListOptionDraft {
    label: string;
    hexCode?: string;
}

export interface PersistedModelListOption {
    field: CustomField;
    option: TableOption;
}

export async function saveModelListOption(params: {
    field: CustomField;
    options: TableOption[];
    draft: ModelListOptionDraft;
    current?: TableOption | null;
}): Promise<PersistedModelListOption>
```

Implementation rules:

- Normalize and reject empty labels.
- Return an existing equivalent option without writing.
- For `select`, replace or append within `field.options`, call `customFieldsService.update`, and return the updated field.
- For `colors`, call `colorService.create/update` with `name`, `hex_code`, and `active: true`.
- For `rams`, parse the first numeric capacity from labels such as `12GB`, then call `ramService.create/update` with `{ value, label, active: true }`.
- For `storages`, use the same numeric parsing and `storageService`.
- For `versions`, call `versionService.create/update`.
- For any other `table_relation`, create or update through `tableDataService` using configured columns and `id` as the primary key.
- Return the persisted option using the configured value and label columns.

- [ ] **Step 4: Add duplicate and invalid-input assertions**

Extend `tmp-tests/model-list-option-core.test.mjs` to assert numeric extraction:

```js
assert.equal(parseCapacityValue('12 GB'), 12);
assert.equal(parseCapacityValue('1 TB'), 1024);
assert.throws(() => parseCapacityValue('Grande'), /capacidade numerica/i);
```

Implement `parseCapacityValue` in `modelListOptionCore.js`, converting TB to GB.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node tmp-tests/model-list-option-core.test.mjs
node tmp-tests/model-list-option-service-static.test.mjs
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- components/settings/modelListOptionCore.js services/modelListOptions.ts tmp-tests/model-list-option-core.test.mjs tmp-tests/model-list-option-service-static.test.mjs
git commit -m "feat(model): persist dynamic list options"
```

### Task 4: Reusable List Field and Editor Modal

**Files:**
- Create: `components/settings/ModelListFieldInput.tsx`
- Create: `components/settings/ModelListOptionModal.tsx`
- Create: `tmp-tests/model-list-option-ui-static.test.mjs`

- [ ] **Step 1: Write failing UI structure checks**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fieldSource = readFileSync('components/settings/ModelListFieldInput.tsx', 'utf8');
const modalSource = readFileSync('components/settings/ModelListOptionModal.tsx', 'utf8');

assert.match(fieldSource, /grid-cols-\[minmax\(0,1fr\)_2\.5rem_2\.5rem\]/);
assert.match(fieldSource, /<Plus/);
assert.match(fieldSource, /<Pencil/);
assert.match(fieldSource, /title="Adicionar opcao"/);
assert.match(fieldSource, /title="Editar opcao selecionada"/);
assert.match(fieldSource, /disabled=\{!selectedOption/);
assert.match(modalSource, /field\.table_config\?\.table_name === 'colors'/);
assert.match(modalSource, /type="color"/);
assert.match(modalSource, /onSave\(\{ label: label\.trim\(\), hexCode/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tmp-tests/model-list-option-ui-static.test.mjs`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement `ModelListFieldInput`**

Props:

```ts
interface ModelListFieldInputProps {
    field: CustomField;
    value: string;
    options: TableOption[];
    loading?: boolean;
    saving?: boolean;
    onChange: (value: string) => void;
    onAdd: () => void;
    onEdit: (option: TableOption) => void;
}
```

Render the label and a stable grid:

```tsx
<div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-2">
    <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || saving}
        className="min-w-0 w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    >
        <option value="">Selecione...</option>
        {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
                {option.label}
            </option>
        ))}
    </select>
    <button
        type="button"
        title="Adicionar opcao"
        onClick={onAdd}
        disabled={loading || saving}
        className="h-10 w-10 inline-flex items-center justify-center border border-slate-200 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50"
    >
        <Plus size={17} />
    </button>
    <button
        type="button"
        title="Editar opcao selecionada"
        onClick={() => selectedOption && onEdit(selectedOption)}
        disabled={!selectedOption || saving}
        className="h-10 w-10 inline-flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
    >
        <Pencil size={16} />
    </button>
</div>
```

- [ ] **Step 4: Implement `ModelListOptionModal`**

The modal must:

- initialize label and hex from the selected option;
- show a color input only for `colors`;
- disable save for blank labels;
- show saving state with `Loader2`;
- submit `ModelListOptionDraft`;
- keep `z-[60]` so it sits over `ModelModal`;
- use compact width `max-w-md`.

- [ ] **Step 5: Run the UI static test**

Run: `node tmp-tests/model-list-option-ui-static.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- components/settings/ModelListFieldInput.tsx components/settings/ModelListOptionModal.tsx tmp-tests/model-list-option-ui-static.test.mjs
git commit -m "feat(model): add inline list option controls"
```

### Task 5: Integrate List Controls Into ModelModal

**Files:**
- Modify: `components/settings/ModelModal.tsx`
- Modify: `tmp-tests/model-list-option-ui-static.test.mjs`
- Modify: `tmp-tests/model-modal-brand-source.test.mjs`

- [ ] **Step 1: Add failing integration checks**

```js
const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
assert.match(modal, /<ModelListFieldInput/);
assert.match(modal, /<ModelListOptionModal/);
assert.match(modal, /saveModelListOption/);
assert.match(modal, /setFieldChoiceOptions/);
assert.match(modal, /handleOpenListOptionEditor/);
assert.match(modal, /handleSaveListOption/);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node tmp-tests/model-list-option-ui-static.test.mjs
node tmp-tests/model-modal-brand-source.test.mjs
```

Expected: UI integration assertions FAIL; existing modal regression remains PASS.

- [ ] **Step 3: Replace the local list rendering**

Remove list rendering and table-loading responsibility from `TemplateFieldInput`. Keep it for non-list inputs only.

Add modal-level state:

```ts
const [listEditor, setListEditor] = useState<{
    field: CustomField;
    current: TableOption | null;
} | null>(null);
const [savingListOption, setSavingListOption] = useState(false);
```

For `select` and `table_relation`, render `ModelListFieldInput` with `fieldChoiceOptions[field.key]`.

- [ ] **Step 4: Implement manual create/edit flow**

`handleSaveListOption` must:

1. call `saveModelListOption`;
2. replace the matching field in `customFields` when a manual list changes;
3. reload relation options when a table-backed item changes;
4. update `fieldChoiceOptions[field.key]`;
5. call `handleTemplateValueChange(field.key, persisted.option.value)`;
6. close the option modal;
7. show create/edit success toast.

When editing a manual option selected in the current model, replace the old selected value with the new label.

- [ ] **Step 5: Keep options fresh on every modal opening**

Preserve:

```ts
useEffect(() => {
    if (isOpen) {
        loadData();
    }
}, [isOpen]);
```

Ensure `loadFieldChoiceOptions` rebuilds manual and table-backed options after `customFields` changes.

- [ ] **Step 6: Run focused integration tests**

Run:

```powershell
node tmp-tests/model-list-option-ui-static.test.mjs
node tmp-tests/model-modal-brand-source.test.mjs
node tmp-tests/custom-fields-option-list-normalization-static.test.mjs
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- components/settings/ModelModal.tsx tmp-tests/model-list-option-ui-static.test.mjs tmp-tests/model-modal-brand-source.test.mjs
git commit -m "feat(model): manage list options inside editor"
```

### Task 6: Automatically Create Missing AI Choices

**Files:**
- Modify: `components/settings/modelListOptionCore.js`
- Modify: `components/settings/ModelModal.tsx`
- Modify: `components/settings/modelJsonImport.js`
- Modify: `tmp-tests/model-list-option-core.test.mjs`
- Modify: `tmp-tests/model-json-import.test.mjs`

- [ ] **Step 1: Write failing tests for partial AI resolution**

Add to `tmp-tests/model-list-option-core.test.mjs`:

```js
const result = await resolveMissingListChoices({
  missingChoices: [
    { fieldKey: 'screen', fieldLabel: 'Tela', value: 'Victus 3' },
    { fieldKey: 'network', fieldLabel: 'Rede', value: 'Nao informado' },
    { fieldKey: 'version', fieldLabel: 'Versao', value: 'Global Plus' },
  ],
  fieldByKey: new Map([
    ['screen', { key: 'screen' }],
    ['network', { key: 'network' }],
    ['version', { key: 'version' }],
  ]),
  optionsByKey: {
    screen: [],
    network: [],
    version: [],
  },
  createOption: async ({ field, value }) => {
    if (field.key === 'version') throw new Error('falha de teste');
    return { value, label: value };
  },
});

assert.deepEqual(result.resolvedValues, { screen: 'Victus 3' });
assert.equal(result.created.length, 1);
assert.equal(result.rejected.length, 1);
assert.equal(result.failed.length, 1);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tmp-tests/model-list-option-core.test.mjs`

Expected: FAIL because `resolveMissingListChoices` is missing.

- [ ] **Step 3: Implement asynchronous resolution**

Add:

```js
export async function resolveMissingListChoices({
  missingChoices,
  fieldByKey,
  optionsByKey,
  createOption,
}) {
  const resolvedValues = {};
  const created = [];
  const rejected = [];
  const failed = [];

  for (const missing of missingChoices || []) {
    const field = fieldByKey.get(missing.fieldKey);
    if (!field || !isCreatableAiOption(missing.value)) {
      rejected.push(missing);
      continue;
    }

    const existing = findEquivalentOption(missing.value, optionsByKey[missing.fieldKey] || []);
    if (existing) {
      resolvedValues[missing.fieldKey] = existing.value;
      continue;
    }

    try {
      const option = await createOption({ field, value: String(missing.value).trim() });
      resolvedValues[missing.fieldKey] = option.value;
      created.push({ ...missing, option });
    } catch (error) {
      failed.push({ ...missing, error });
    }
  }

  return { resolvedValues, created, rejected, failed };
}
```

- [ ] **Step 4: Verify the import payload retains missing metadata**

Extend `tmp-tests/model-json-import.test.mjs`:

```js
assert.equal(normalized.missingChoices[0].fieldKey, 'water_resistance');
assert.equal(normalized.missingChoices[0].value, 'IP70');
```

No list value should enter `templateValues` until resolved.

- [ ] **Step 5: Integrate resolution before applying normalized values**

Convert `applyNormalizedModelPayload` to `async`.

Before merging `translatedTemplateValues`:

1. build `fieldByKey` from `visibleSpecFields`;
2. call `resolveMissingListChoices`;
3. create each missing item through `saveModelListOption`;
4. merge `resolvedValues` into translated template values;
5. update local option maps with newly created options;
6. show one success toast summarizing created items;
7. provide Sonner action `Editar` for a single created item, or open the first item when several were created;
8. show a warning summarizing rejected and failed items.

Update `handleApplyModelJson`, `handleGenerateModelJson`, and `handleApplyJson` to await the asynchronous apply function.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
node tmp-tests/model-list-option-core.test.mjs
node tmp-tests/model-json-import.test.mjs
node tmp-tests/model-json-import-empty-fields.test.mjs
node tmp-tests/model-list-option-ui-static.test.mjs
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- components/settings/modelListOptionCore.js components/settings/modelJsonImport.js components/settings/ModelModal.tsx tmp-tests/model-list-option-core.test.mjs tmp-tests/model-json-import.test.mjs
git commit -m "feat(model): create missing AI list choices"
```

### Task 7: Full Verification and UX Check

**Files:**
- Modify only if verification reveals defects.

- [ ] **Step 1: Run all focused regressions**

```powershell
node tmp-tests/model-list-option-core.test.mjs
node tmp-tests/model-list-option-service-static.test.mjs
node tmp-tests/model-list-option-ui-static.test.mjs
node tmp-tests/model-json-import.test.mjs
node tmp-tests/model-json-import-empty-fields.test.mjs
node tmp-tests/model-modal-brand-source.test.mjs
node tmp-tests/custom-fields-option-list-normalization-static.test.mjs
```

Expected: all commands exit 0.

- [ ] **Step 2: Run repository hygiene checks**

```powershell
git diff --check
node scripts/assert-no-supabase-runtime.cjs
```

Expected: both exit 0.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: Vite build exits 0.

- [ ] **Step 4: Start the development server**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5181 --strictPort`

Expected: local URL `http://127.0.0.1:5181`.

- [ ] **Step 5: Verify the browser flow**

Using the browser automation skill:

1. Open `/admin/settings/models`.
2. Open a model and switch to `JSON / IA`.
3. Confirm each list row has aligned select, plus, and pencil controls without overlap at desktop width.
4. Add a manual option and confirm it becomes selected.
5. Edit it and confirm the selected text updates.
6. Apply JSON containing an unknown list value and confirm it is created and selected.
7. Resize to a narrow viewport and confirm controls remain inside their grid cells.
8. Check browser console for errors.

- [ ] **Step 6: Review final diff and status**

```powershell
git diff --stat
git status --short
```

Expected: only planned implementation files plus pre-existing unrelated untracked files.

- [ ] **Step 7: Commit verification fixes, if any**

Stage only the concrete files changed while correcting verification defects, then run:

```powershell
git commit -m "fix(model): polish inline list option flow"
```
