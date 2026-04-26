# Plano De Implementacao: Dry-Run Da Migracao De Midia E Upload Na VPS

> **Para agentes/implementadores:** SUB-SKILL OBRIGATORIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checklist (`- [ ]`) para acompanhamento.

**Objetivo:** construir a proxima etapa segura da migracao de imagens: um planejador de migracao em dry-run, junto com a preparacao do endpoint de upload da VPS, otimizado para grande escala e para melhorar a performance do site sem aplicar alteracoes remotas ainda.

**Arquitetura:** manter a base read-only da auditoria ja criada, adicionar planejamento deterministico de migracao para midias inline e externas, e preparar o endpoint de upload da VPS para aceitar caminhos controlados alem de `products/`. Esta primeira implementacao nao deve atualizar Supabase, MySQL ou URLs de producao; ela apenas valida a seguranca dos caminhos de upload e produz um plano retomavel para ser aplicado depois em lotes.

**Stack tecnica:** ferramentas Node.js ESM, arquivos CommonJS do servidor VPS, `node:test`, `crypto`, `fetch`, `@supabase/supabase-js`, endpoint existente `/images/upload` da VPS e helpers existentes da auditoria de midia.

---

## Escopo Desta Proxima Etapa

Este plano para antes da migracao real. Ele deve produzir:

- Uma politica segura de caminhos para uploads de midia na VPS.
- Testes provando que caminhos de upload nao conseguem escapar de `uploads/`.
- Um planejador dry-run que le `reports/media-origin-audit.json`.
- Um relatorio de plano de migracao focado primeiro nos payloads mais pesados para performance:
  - `inline-data` em `model_color_images`
  - `inline-data` em `product`
  - `inline-data` em `company_settings`
- Planejamento opcional para candidatos externos, ainda somente em dry-run.

Esta etapa nao deve:

- Enviar arquivos para a VPS.
- Atualizar linhas no Supabase.
- Atualizar produtos no MySQL da VPS.
- Apagar midias antigas.
- Substituir URLs em producao.

## Mapa De Arquivos

- Criar: `services/vpsUploadPathPolicy.cjs`
  - Responsavel por normalizar caminhos e definir prefixos permitidos no upload `/images/upload` da VPS.
- Modificar: `vps_server.js`
  - Reutilizar `validateMediaUploadPath()` no endpoint `/images/upload`.
- Modificar: `vps_server.cjs`
  - Manter a copia de deploy sincronizada com `vps_server.js`.
- Criar: `tmp-tests/vps-upload-path-policy.test.mjs`
  - Testes unitarios para caminhos seguros e inseguros.
- Criar: `services/mediaMigrationPlanner.js`
  - Converter referencias da auditoria em acoes deterministicas de migracao dry-run.
- Criar: `tmp-tests/media-migration-planner.test.mjs`
  - Testes unitarios para parsing de inline data, deduplicacao por hash, geracao de caminhos e filtro por escopo.
- Criar: `tools/plan-media-migration.mjs`
  - CLI que le o JSON da auditoria e escreve relatorios dry-run.
- Criar: `reports/.gitkeep`, se ainda nao existir.
  - Manter o diretorio `reports` versionado, mas deixar relatorios gerados ignorados.
- Modificar: `.gitignore`
  - Ignorar saidas geradas `reports/media-migration-plan.*`.

## Decisoes De Design

- O primeiro alvo da migracao e `inline-data`, porque ele infla respostas JSON e custo de parsing mais do que URLs externas simples.
- O planejador usa `sha256` dos bytes da imagem quando disponivel. O mesmo payload de imagem deve apontar para o mesmo caminho-alvo canonico por hash, com duplicatas marcadas no plano.
- Caminhos sao deterministicos e agrupados por tipo de entidade:
  - `legacy/inline/<hash>.<ext>` para payloads inline deduplicados
  - `model-color/<row-id>/<hash>.<ext>` apenas para uploads novos de modelo/cor feitos pelo admin
  - `products/migrated/<product-id>/<hash>.<ext>` fica reservado para casos que precisem de separacao por produto
  - `company/<company-id>/<field>-<hash>.<ext>`
  - `legacy/external/<origin>/<hash>.<ext>` para planejamento externo posterior
- O endpoint de upload deve aceitar apenas prefixos conhecidos e extensoes raster (`jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`). SVG fica fora desta fase.
- Relatorios dry-run devem conter dados suficientes para revisao antes de qualquer apply:
  - tipo de entidade
  - id da entidade
  - campo
  - origem
  - URL de origem redigida
  - caminho VPS planejado
  - URL VPS planejada
  - tamanho em bytes, quando conhecido
  - MIME, quando conhecido
  - hash, quando conhecido
  - status: `planned`, `skipped` ou `blocked`
  - motivo

---

### Tarefa 1: Adicionar Politica De Caminhos Para Upload Na VPS

**Arquivos:**
- Criar: `services/vpsUploadPathPolicy.cjs`
- Testar: `tmp-tests/vps-upload-path-policy.test.mjs`

- [ ] **Passo 1: escrever o teste falhando da politica de caminhos**

Criar `tmp-tests/vps-upload-path-policy.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  validateMediaUploadPath,
  ALLOWED_MEDIA_UPLOAD_PREFIXES,
} = require('../services/vpsUploadPathPolicy.cjs');

test('allows existing product upload paths', () => {
  assert.equal(
    validateMediaUploadPath('products/ABC-123/img-1.webp').safePath,
    'products/ABC-123/img-1.webp',
  );
});

test('allows migration media prefixes needed for large scale cleanup', () => {
  const paths = [
    'model-color/row-1/abc123.webp',
    'company/company-1/logo-abc123.png',
    'legacy/external/imgur/abc123.jpg',
    'banners/migrated/banner-abc123.webp',
  ];

  for (const input of paths) {
    assert.equal(validateMediaUploadPath(input).safePath, input);
  }

  assert.deepEqual(
    ALLOWED_MEDIA_UPLOAD_PREFIXES,
    ['products/', 'model-color/', 'company/', 'legacy/', 'banners/'],
  );
});

test('blocks traversal and absolute paths', () => {
  const invalid = [
    '../secret.webp',
    'products/../../secret.webp',
    '/etc/passwd',
    'C:\\temp\\file.webp',
    'products\\..\\secret.webp',
  ];

  for (const input of invalid) {
    assert.equal(validateMediaUploadPath(input).ok, false, input);
  }
});

test('blocks unknown prefixes and non-image extensions', () => {
  assert.equal(validateMediaUploadPath('avatars/a.webp').ok, false);
  assert.equal(validateMediaUploadPath('legacy/external/imgur/file.exe').ok, false);
  assert.equal(validateMediaUploadPath('legacy/external/imgur/file').ok, false);
});
```

- [ ] **Passo 2: rodar o teste para confirmar que ele falha**

Executar:

```bash
node tmp-tests/vps-upload-path-policy.test.mjs
```

Esperado: FAIL porque `services/vpsUploadPathPolicy.cjs` ainda nao existe.

- [ ] **Passo 3: implementar a politica de caminhos**

Criar `services/vpsUploadPathPolicy.cjs`:

```js
const path = require('path');

const ALLOWED_MEDIA_UPLOAD_PREFIXES = [
  'products/',
  'model-color/',
  'company/',
  'legacy/',
  'banners/',
];

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function validateMediaUploadPath(rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) return { ok: false, error: 'path required' };
  if (/^[a-zA-Z]:[\\/]/.test(value)) return { ok: false, error: 'absolute paths are not allowed' };
  if (value.includes('\\')) return { ok: false, error: 'backslashes are not allowed' };

  const safePath = path.posix.normalize(value).replace(/^\/+/, '');
  if (!safePath || safePath === '.' || safePath.startsWith('../') || safePath.includes('/../')) {
    return { ok: false, error: 'path traversal is not allowed' };
  }

  if (!ALLOWED_MEDIA_UPLOAD_PREFIXES.some((prefix) => safePath.startsWith(prefix))) {
    return { ok: false, error: 'unsupported media upload prefix' };
  }

  const ext = path.posix.extname(safePath).toLowerCase();
  if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
    return { ok: false, error: 'unsupported media extension' };
  }

  return { ok: true, safePath };
}

module.exports = {
  ALLOWED_MEDIA_UPLOAD_PREFIXES,
  ALLOWED_MEDIA_EXTENSIONS,
  validateMediaUploadPath,
};
```

- [ ] **Passo 4: rodar o teste para confirmar que passa**

Executar:

```bash
node tmp-tests/vps-upload-path-policy.test.mjs
```

Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add services/vpsUploadPathPolicy.cjs tmp-tests/vps-upload-path-policy.test.mjs
git commit -m "test(media): add vps upload path policy"
```

---

### Tarefa 2: Conectar A Politica Ao Endpoint De Upload Da VPS

**Arquivos:**
- Modificar: `vps_server.js`
- Modificar: `vps_server.cjs`
- Testar: `tmp-tests/vps-upload-path-policy.test.mjs`

- [ ] **Passo 1: atualizar a secao de `require` em `vps_server.js`**

Perto dos `require` existentes, adicionar:

```js
const { validateMediaUploadPath } = require('./services/vpsUploadPathPolicy.cjs');
```

- [ ] **Passo 2: atualizar a validacao de `/images/upload` em `vps_server.js`**

Substituir:

```js
const safe = path.normalize(filePath).replace(/^\/+/, '');
if (safe.startsWith('..') || !safe.startsWith('products/')) {
  return reply.code(400).send({ error: 'Invalid path' });
}
```

por:

```js
const validation = validateMediaUploadPath(filePath);
if (!validation.ok) {
  return reply.code(400).send({ error: validation.error || 'Invalid path' });
}
const safe = validation.safePath;
```

- [ ] **Passo 3: aplicar a mesma alteracao em `vps_server.cjs`**

Adicionar:

```js
const { validateMediaUploadPath } = require('./services/vpsUploadPathPolicy.cjs');
```

Substituir o mesmo bloco de validacao de `/images/upload` por:

```js
const validation = validateMediaUploadPath(filePath);
if (!validation.ok) {
  return reply.code(400).send({ error: validation.error || 'Invalid path' });
}
const safe = validation.safePath;
```

- [ ] **Passo 4: rodar os testes da politica**

Executar:

```bash
node tmp-tests/vps-upload-path-policy.test.mjs
```

Esperado: PASS.

- [ ] **Passo 5: checar sintaxe dos servidores**

Executar:

```bash
node --check vps_server.js
node --check vps_server.cjs
```

Esperado: os dois passam na checagem de sintaxe.

- [ ] **Passo 6: commit**

```bash
git add vps_server.js vps_server.cjs services/vpsUploadPathPolicy.cjs tmp-tests/vps-upload-path-policy.test.mjs
git commit -m "fix(media): allow safe migrated image upload paths"
```

---

### Tarefa 3: Adicionar O Nucleo Do Planejador De Migracao Dry-Run

**Arquivos:**
- Criar: `services/mediaMigrationPlanner.js`
- Testar: `tmp-tests/media-migration-planner.test.mjs`

- [ ] **Passo 1: escrever testes falhando do planejador**

Criar `tmp-tests/media-migration-planner.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMediaMigrationPlan,
  decodeInlineDataImage,
  plannedPathForRef,
} from '../services/mediaMigrationPlanner.js';

const tinyPng = 'data:image/png;base64,aGVsbG8=';

test('decodes inline data images with mime, bytes, hash, and extension', () => {
  const decoded = decodeInlineDataImage(tinyPng);

  assert.equal(decoded.ok, true);
  assert.equal(decoded.mimeType, 'image/png');
  assert.equal(decoded.extension, 'png');
  assert.equal(decoded.byteLength, 5);
  assert.equal(decoded.sha256.length, 64);
});

test('blocks non-image inline data', () => {
  const decoded = decodeInlineDataImage('data:text/plain;base64,aGVsbG8=');

  assert.equal(decoded.ok, false);
  assert.match(decoded.reason, /not a supported raster image/);
});

test('creates deterministic paths by entity type', () => {
  const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  assert.equal(
    plannedPathForRef({ entityType: 'model_color_images', entityId: 'row-1', field: 'images[0]' }, { sha256: hash, extension: 'png' }),
    'model-color/row-1/0123456789abcdef.png',
  );
  assert.equal(
    plannedPathForRef({ entityType: 'product', entityId: 'prod-1', field: 'images[2]' }, { sha256: hash, extension: 'webp' }),
    'products/migrated/prod-1/0123456789abcdef.webp',
  );
  assert.equal(
    plannedPathForRef({ entityType: 'company_settings', entityId: 'company-1', field: 'logo' }, { sha256: hash, extension: 'jpg' }),
    'company/company-1/logo-0123456789abcdef.jpg',
  );
});

test('builds inline-data dry-run actions and dedupes repeated payloads', () => {
  const report = {
    refs: [
      { entityType: 'model_color_images', entityId: 'row-1', field: 'images[0]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'model_color_images', entityId: 'row-1', field: 'images[1]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'product', entityId: 'prod-1', field: 'images[0]', origin: 'imgur', shouldMigrate: true, url: 'https://i.imgur.com/a.png', redactedUrl: 'https://i.imgur.com/a.png' },
    ],
  };

  const plan = buildMediaMigrationPlan(report, { scope: 'inline-data' });

  assert.equal(plan.summary.totalCandidates, 2);
  assert.equal(plan.summary.planned, 2);
  assert.equal(plan.summary.uniquePayloads, 1);
  assert.equal(plan.actions[0].status, 'planned');
  assert.equal(plan.actions[0].mode, 'dry-run');
  assert.match(plan.actions[0].plannedUrl, /^https:\/\/api\.xiaomipetrolina\.com\.br\/images\/model-color\/row-1\//);
});
```

- [ ] **Passo 2: rodar o teste para confirmar que falha**

Executar:

```bash
node tmp-tests/media-migration-planner.test.mjs
```

Esperado: FAIL porque o planejador ainda nao existe.

- [ ] **Passo 3: implementar o nucleo do planejador**

Criar `services/mediaMigrationPlanner.js`:

```js
import crypto from 'node:crypto';

const DEFAULT_VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const HASH_PREFIX_LENGTH = 16;

const MIME_EXTENSIONS = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function safeSegment(value, fallback = 'unknown') {
  const text = String(value || '').trim();
  const safe = text.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || fallback;
}

function fieldSegment(field) {
  return safeSegment(String(field || 'image').replace(/\[[0-9]+\]/g, ''));
}

export function decodeInlineDataImage(dataUrl) {
  const match = /^data:([^;,]+);base64,(.*)$/u.exec(String(dataUrl || ''));
  if (!match) return { ok: false, reason: 'inline data URL is not base64' };

  const mimeType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS.get(mimeType);
  if (!extension) return { ok: false, reason: `inline data MIME is not a supported raster image: ${mimeType}` };

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return { ok: false, reason: 'inline data base64 could not be decoded' };
  }

  if (buffer.length === 0) return { ok: false, reason: 'inline data image is empty' };

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    ok: true,
    buffer,
    mimeType,
    extension,
    byteLength: buffer.length,
    sha256,
  };
}

export function plannedPathForRef(ref, imageInfo) {
  const hash = imageInfo.sha256.slice(0, HASH_PREFIX_LENGTH);
  const ext = imageInfo.extension;
  const entityId = safeSegment(ref.entityId);

  if (ref.entityType === 'model_color_images') {
    return `model-color/${entityId}/${hash}.${ext}`;
  }

  if (ref.entityType === 'company_settings') {
    return `company/${entityId}/${fieldSegment(ref.field)}-${hash}.${ext}`;
  }

  if (ref.entityType === 'catalog_banner') {
    return `banners/migrated/${entityId}/${fieldSegment(ref.field)}-${hash}.${ext}`;
  }

  return `products/migrated/${entityId}/${hash}.${ext}`;
}

function plannedUrlForPath(path, vpsBaseUrl) {
  return `${String(vpsBaseUrl).replace(/\/+$/u, '')}/images/${path}`;
}

function scopeMatches(ref, scope) {
  if (scope === 'all-candidates') return Boolean(ref.shouldMigrate);
  if (scope === 'inline-data') return ref.origin === 'inline-data' && ref.shouldMigrate;
  if (scope === 'external') return ref.origin !== 'inline-data' && ref.shouldMigrate;
  return false;
}

export function buildMediaMigrationPlan(report, options = {}) {
  const scope = options.scope || 'inline-data';
  const vpsBaseUrl = options.vpsBaseUrl || DEFAULT_VPS_BASE_URL;
  const refs = Array.isArray(report?.refs) ? report.refs : [];
  const actions = [];
  const uniquePayloadHashes = new Set();

  for (const ref of refs) {
    if (!scopeMatches(ref, scope)) continue;

    if (ref.origin !== 'inline-data') {
      actions.push({
        mode: 'dry-run',
        status: 'blocked',
        reason: 'external download planning is reserved for the next batch',
        entityType: ref.entityType,
        entityId: ref.entityId,
        field: ref.field,
        origin: ref.origin,
        redactedUrl: ref.redactedUrl,
      });
      continue;
    }

    const decoded = decodeInlineDataImage(ref.url || ref.normalizedUrl || ref.sourceUrl);
    if (!decoded.ok) {
      actions.push({
        mode: 'dry-run',
        status: 'blocked',
        reason: decoded.reason,
        entityType: ref.entityType,
        entityId: ref.entityId,
        field: ref.field,
        origin: ref.origin,
        redactedUrl: ref.redactedUrl,
      });
      continue;
    }

    uniquePayloadHashes.add(decoded.sha256);
    const plannedPath = plannedPathForRef(ref, decoded);
    actions.push({
      mode: 'dry-run',
      status: 'planned',
      reason: 'inline data image can be uploaded to VPS before URL replacement',
      entityType: ref.entityType,
      entityId: ref.entityId,
      field: ref.field,
      origin: ref.origin,
      redactedUrl: ref.redactedUrl || 'data:REDACTED',
      mimeType: decoded.mimeType,
      byteLength: decoded.byteLength,
      sha256: decoded.sha256,
      plannedPath,
      plannedUrl: plannedUrlForPath(plannedPath, vpsBaseUrl),
    });
  }

  const planned = actions.filter((action) => action.status === 'planned').length;
  const blocked = actions.filter((action) => action.status === 'blocked').length;

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scope,
    summary: {
      totalCandidates: actions.length,
      planned,
      blocked,
      uniquePayloads: uniquePayloadHashes.size,
      plannedBytes: actions.reduce((sum, action) => sum + (action.byteLength || 0), 0),
    },
    actions,
  };
}
```

- [ ] **Passo 4: rodar os testes do planejador**

Executar:

```bash
node tmp-tests/media-migration-planner.test.mjs
```

Esperado: PASS.

- [ ] **Passo 5: rodar os testes existentes da auditoria para evitar regressao**

Executar:

```bash
node tmp-tests/media-origin-classifier.test.mjs
node tmp-tests/media-audit-extractors.test.mjs
```

Esperado: ambos passam.

- [ ] **Passo 6: commit**

```bash
git add services/mediaMigrationPlanner.js tmp-tests/media-migration-planner.test.mjs
git commit -m "feat(media): plan inline image migration dry run"
```

---

### Tarefa 4: Adicionar CLI Dry-Run E Relatorios

**Arquivos:**
- Criar: `tools/plan-media-migration.mjs`
- Modificar: `.gitignore`
- Testar: `tmp-tests/media-migration-planner.test.mjs`

- [ ] **Passo 1: atualizar `.gitignore` para os relatorios gerados**

Adicionar estas linhas perto dos ignores de relatorios existentes:

```gitignore
reports/media-migration-plan.json
reports/media-migration-plan.md
```

- [ ] **Passo 2: criar a CLI**

Criar `tools/plan-media-migration.mjs`:

```js
#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { buildMediaMigrationPlan } from '../services/mediaMigrationPlanner.js';

for (const envPath of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: envPath, quiet: true });
}

const REPORT_DIR = 'reports';
const DEFAULT_AUDIT_PATH = path.join(REPORT_DIR, 'media-origin-audit.json');
const JSON_PLAN_PATH = path.join(REPORT_DIR, 'media-migration-plan.json');
const MD_PLAN_PATH = path.join(REPORT_DIR, 'media-migration-plan.md');

function parseArgs(argv) {
  const args = {
    scope: 'inline-data',
    auditPath: DEFAULT_AUDIT_PATH,
    limit: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scope') args.scope = argv[++i] || args.scope;
    else if (arg === '--audit') args.auditPath = argv[++i] || args.auditPath;
    else if (arg === '--limit') args.limit = Number(argv[++i] || '0');
    else if (arg === '--apply') {
      throw new Error('This CLI is dry-run only. Apply mode must be built in a later plan.');
    }
  }

  return args;
}

function limitPlan(plan, limit) {
  if (!limit || limit <= 0 || plan.actions.length <= limit) return plan;
  const actions = plan.actions.slice(0, limit);
  const planned = actions.filter((action) => action.status === 'planned').length;
  const blocked = actions.filter((action) => action.status === 'blocked').length;
  return {
    ...plan,
    limited: true,
    limit,
    summary: {
      ...plan.summary,
      totalCandidates: actions.length,
      planned,
      blocked,
      plannedBytes: actions.reduce((sum, action) => sum + (action.byteLength || 0), 0),
    },
    actions,
  };
}

function buildMarkdown(plan) {
  const rows = plan.actions.slice(0, 200).map((action) => [
    action.status,
    action.entityType,
    action.entityId,
    action.field,
    action.origin,
    action.mimeType || '-',
    action.byteLength || 0,
    action.plannedPath || '-',
    action.reason,
  ]);

  return `# Media Migration Plan

Generated at: ${plan.generatedAt}

Read-only: yes

Scope: ${plan.scope}

${plan.limited ? `Limited to: ${plan.limit} actions\n` : ''}
## Summary

- Total candidates in plan: ${plan.summary.totalCandidates}
- Planned uploads: ${plan.summary.planned}
- Blocked/skipped: ${plan.summary.blocked}
- Unique inline payloads: ${plan.summary.uniquePayloads}
- Planned inline bytes: ${plan.summary.plannedBytes}

## Actions

Showing first 200 actions.

| Status | Entity | ID | Field | Origin | MIME | Bytes | Planned Path | Reason |
|---|---|---|---|---|---|---:|---|---|
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n') || '| none | - | - | - | - | - | 0 | - | - |'}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const audit = JSON.parse(await fs.readFile(args.auditPath, 'utf8'));
  const plan = limitPlan(buildMediaMigrationPlan(audit, { scope: args.scope }), args.limit);

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(JSON_PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);
  await fs.writeFile(MD_PLAN_PATH, buildMarkdown(plan));

  console.log(`Read-only migration plan written to ${JSON_PLAN_PATH} and ${MD_PLAN_PATH}`);
  console.log(JSON.stringify(plan.summary, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
```

- [ ] **Passo 3: rodar a CLI com o relatorio de auditoria existente**

Executar:

```bash
node tools/plan-media-migration.mjs --scope inline-data --audit reports/media-origin-audit.json --limit 25
```

Esperado:

```text
Read-only migration plan written to reports/media-migration-plan.json and reports/media-migration-plan.md
```

O resumo deve mostrar acoes inline planejadas e zero escritas remotas.

- [ ] **Passo 4: inspecionar o Markdown gerado**

Executar:

```bash
Get-Content reports/media-migration-plan.md -TotalCount 80
```

Esperado:

- `Read-only: yes`
- `Scope: inline-data`
- caminhos planejados em `model-color/`, `products/migrated/` ou `company/`

- [ ] **Passo 5: confirmar que os relatorios gerados estao ignorados**

Executar:

```bash
git status --short
```

Esperado: arquivos gerados `reports/media-migration-plan.*` nao aparecem como untracked.

- [ ] **Passo 6: commit**

```bash
git add .gitignore tools/plan-media-migration.mjs
git commit -m "feat(media): add read-only migration plan cli"
```

---

### Tarefa 5: Impedir Que Novas Imagens Modelo/Cor Sejam Salvas Como Base64

**Arquivos:**
- Modificar: `components/settings/ColorImageManager.tsx`
- Modificar: `components/products/sections/ImageGalleryShared.tsx`
- Modificar: `services/vpsClient.ts` ou helper de upload existente, se necessario
- Testar: `npm run build`

Esta tarefa so deve ser implementada depois que as Tarefas 1-4 passarem. Ela muda o comportamento futuro do admin para impedir que o problema de performance volte.

- [ ] **Passo 1: localizar os caminhos atuais que gravam base64**

Executar:

```bash
rg "readAsDataURL|base64String|compressImage" components/settings components/products/sections services -n
```

Esperado: encontrar criacao atual de base64 em:

- `components/settings/ColorImageManager.tsx`
- `components/products/sections/ImageGalleryShared.tsx`

- [ ] **Passo 2: adicionar um helper de upload se nenhum existente encaixar**

Se `vpsClient.upload()` ja suportar multipart, adicionar um helper pequeno no componente relevante ou em um service compartilhado:

```ts
async function uploadModelColorImageToVps(file: File, modelId: string, colorId: string): Promise<string> {
  const formData = new FormData();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image.webp';
  formData.append('file', file);
  formData.append('path', `model-color/${modelId}/${colorId}-${crypto.randomUUID()}-${safeName}`);
  const result = await vpsClient.upload<{ url: string }>('/images/upload', formData);
  return result.url;
}
```

Usar o estilo de import existente no arquivo. Se `vpsClient` ainda nao estiver importado:

```ts
import { vpsClient } from '../../services/vpsClient';
```

Ajustar o caminho relativo conforme a localizacao do arquivo.

- [ ] **Passo 3: substituir o append de base64 por URLs da VPS no admin de modelo/cor**

Substituir o trecho que faz:

```ts
const reader = new FileReader();
const base64Promise = new Promise<string>((resolve, reject) => {
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(compressed);
});

const base64String = await base64Promise;
uploadedImages.push(base64String);
```

por:

```ts
const uploadedUrl = await uploadModelColorImageToVps(
  compressed,
  modelId,
  colorId,
);
uploadedImages.push(uploadedUrl);
```

- [ ] **Passo 4: aplicar a mesma regra anti-base64 na galeria compartilhada de produto**

Onde `ImageGalleryShared.tsx` cria strings base64, usar o mesmo padrao de helper de upload e armazenar URLs da VPS em `model_color_images.images`.

- [ ] **Passo 5: build do frontend**

Executar:

```bash
npm run build
```

Esperado: build passa.

- [ ] **Passo 6: commit**

```bash
git add components/settings/ColorImageManager.tsx components/products/sections/ImageGalleryShared.tsx services/vpsClient.ts
git commit -m "fix(media): store new model color images on vps"
```

---

### Tarefa 6: Verificacao Antes Do PR

**Arquivos:**
- Nenhum arquivo novo, a menos que correcoes sejam necessarias.

- [ ] **Passo 1: rodar todos os testes focados de midia**

Executar:

```bash
node tmp-tests/vps-upload-path-policy.test.mjs
node tmp-tests/media-migration-planner.test.mjs
node tmp-tests/media-origin-classifier.test.mjs
node tmp-tests/media-audit-extractors.test.mjs
```

Esperado: todos passam.

- [ ] **Passo 2: rodar checagens de sintaxe**

Executar:

```bash
node --check vps_server.js
node --check vps_server.cjs
node --check tools/plan-media-migration.mjs
```

Esperado: todos passam.

- [ ] **Passo 3: rodar build**

Executar:

```bash
npm run build
```

Esperado: build passa.

- [ ] **Passo 4: gerar relatorio dry-run limitado**

Executar:

```bash
node tools/audit-media-origins.mjs
node tools/plan-media-migration.mjs --scope inline-data --limit 50
```

Esperado:

- auditoria continua read-only
- plano de migracao continua read-only
- relatorios gerados mostram migracoes inline planejadas
- nenhum comando de update/delete/upload remoto e executado

- [ ] **Passo 5: revisar o diff do Git**

Executar:

```bash
git status --short
git diff --stat
git diff -- .gitignore services tmp-tests tools vps_server.js vps_server.cjs components/settings/ColorImageManager.tsx components/products/sections/ImageGalleryShared.tsx
```

Esperado:

- somente arquivos deste plano foram modificados
- relatorios gerados estao ignorados
- nenhum segredo ou `data:image` bruto foi commitado

- [ ] **Passo 6: commitar correcoes finais, se houver**

Se a verificacao exigiu correcoes:

```bash
git add <fixed-files>
git commit -m "fix(media): stabilize migration dry run"
```

---

## Template Do Corpo Do PR

Usar este corpo de PR:

```markdown
## Resumo
- Prepara uploads de imagem na VPS para caminhos seguros de midia migrada.
- Adiciona um planejador read-only de migracao de midia inline com caminhos deterministicos e metadados de deduplicacao.
- Impede que novos uploads de modelo/cor salvem payloads base64 no Supabase.

## Impacto De Performance
- Ataca primeiro a classe de payload mais pesada: `data:image` armazenado em linhas de dados.
- Mantem a migracao em dry-run antes de qualquer substituicao de URL em producao.
- Usa caminhos e hashes deterministicos para que o futuro modo apply rode em lotes pequenos e retomaveis.

## Validacao
- node tmp-tests/vps-upload-path-policy.test.mjs
- node tmp-tests/media-migration-planner.test.mjs
- node tmp-tests/media-origin-classifier.test.mjs
- node tmp-tests/media-audit-extractors.test.mjs
- node --check vps_server.js
- node --check vps_server.cjs
- node --check tools/plan-media-migration.mjs
- npm run build
- node tools/plan-media-migration.mjs --scope inline-data --limit 50

## Notas De Seguranca
- Nenhum modo apply de migracao esta incluido.
- Nenhuma substituicao remota de URL e executada.
- Relatorios gerados sao locais e ignorados pelo Git.
```

## Criterios De Aceite

- Uploads existentes de imagens de produto continuam funcionando com caminhos `products/...`.
- VPS `/images/upload` rejeita path traversal, caminhos absolutos Windows, prefixos desconhecidos e extensoes que nao sejam imagem.
- Planejador dry-run consegue processar o JSON de auditoria existente e produzir plano JSON/Markdown.
- Entradas inline `data:image` produzem URLs-alvo deterministicos na VPS.
- Payloads inline repetidos sao identificados como duplicados via `sha256`.
- Novos uploads de imagens modelo/cor armazenam URLs da VPS em vez de strings base64.
- Todos os testes focados e `npm run build` passam.

## Plano De Seguimento Depois Deste PR

Somente depois que este PR for mergeado e deployado:

1. Rodar o planejador dry-run sem `--limit`.
2. Revisar contagens de `planned`, `blocked`, bytes totais e principais tipos de entidade.
3. Construir `--apply --scope inline-data --limit 25` em um PR separado com:
   - upload para VPS
   - update linha a linha no Supabase
   - manifesto retomavel
   - relatorio de falha por item
4. Aplicar a migracao inline em lotes durante janela de baixo trafego.
5. Rodar novamente `tools/audit-media-origins.mjs` e comparar as contagens de candidatos.
6. Planejar a migracao de URLs externas somente depois que os payloads inline estiverem sob controle.
