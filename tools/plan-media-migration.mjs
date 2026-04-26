#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import {
  applyMediaMigrationPlan,
  createEmptyMediaMigrationCheckpoint,
  stripUploadPayloadsFromPlan,
} from '../services/mediaMigrationApply.js';
import { buildMediaMigrationPlan } from '../services/mediaMigrationPlanner.js';
import { buildMediaReferenceReplacementPlan } from '../services/mediaReferenceReplace.js';

for (const envPath of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: envPath, quiet: true });
}

const REPORT_DIR = 'reports';
const DEFAULT_AUDIT_PATH = path.join(REPORT_DIR, 'media-origin-audit.json');
const JSON_PLAN_PATH = path.join(REPORT_DIR, 'media-migration-plan.json');
const MD_PLAN_PATH = path.join(REPORT_DIR, 'media-migration-plan.md');
const APPLY_REPORT_PATH = path.join(REPORT_DIR, 'media-migration-apply.json');
const APPLY_MD_REPORT_PATH = path.join(REPORT_DIR, 'media-migration-apply.md');
const CHECKPOINT_PATH = path.join(REPORT_DIR, 'media-migration-checkpoint.json');
const REPLACE_REPORT_PATH = path.join(REPORT_DIR, 'media-reference-replace.json');
const REPLACE_MD_REPORT_PATH = path.join(REPORT_DIR, 'media-reference-replace.md');

function parseArgs(argv) {
  const args = {
    scope: 'inline-data',
    auditPath: DEFAULT_AUDIT_PATH,
    apply: false,
    checkpointPath: CHECKPOINT_PATH,
    limit: 0,
    replaceReferences: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scope') args.scope = argv[++i] || args.scope;
    else if (arg === '--audit') args.auditPath = argv[++i] || args.auditPath;
    else if (arg === '--limit') args.limit = Number(argv[++i] || '0');
    else if (arg === '--checkpoint') args.checkpointPath = argv[++i] || args.checkpointPath;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--replace-references') args.replaceReferences = true;
  }

  return args;
}

function buildReferenceReplaceMarkdown(report) {
  const rows = report.results.slice(0, 200).map((result) => [
    result.status,
    result.entityType,
    result.entityId,
    result.field,
    result.uploadedUrl || '-',
    result.reason || '-',
  ]);

  return `# Media Reference Replacement Report

Generated at: ${report.generatedAt}

Mode: controlled reference replacement pilot

Only product images with a matching current inline payload hash were eligible.

## Summary

- Total actions considered: ${report.summary.total}
- Ready replacements: ${report.summary.ready}
- Skipped: ${report.summary.skipped}
- Entity mutations: ${report.summary.mutations}
- Applied mutations: ${report.applySummary?.applied ?? 0}
- Failed mutations: ${report.applySummary?.failed ?? 0}

## Results

Showing first 200 results.

| Status | Entity | ID | Field | Uploaded URL | Reason |
|---|---|---|---|---|---|
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n') || '| none | - | - | - | - | - |'}
`;
}

function limitPlan(plan, limit) {
  if (!limit || limit <= 0 || plan.actions.length <= limit) return plan;
  const actions = plan.actions.slice(0, limit);
  const planned = actions.filter((action) => action.status === 'planned').length;
  const blocked = actions.filter((action) => action.status === 'blocked').length;
  const uniquePayloads = new Set(actions.map((action) => action.sha256).filter(Boolean)).size;
  return {
    ...plan,
    limited: true,
    limit,
    summary: {
      ...plan.summary,
      totalCandidates: actions.length,
      planned,
      blocked,
      uniquePayloads,
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

${plan.limited ? `Limited to: ${plan.limit} actions\n` : ''}## Summary

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

function buildApplyMarkdown(report) {
  const rows = report.results.slice(0, 200).map((result) => [
    result.status,
    result.entityType,
    result.entityId,
    result.field,
    result.plannedPath || '-',
    result.uploadedUrl || '-',
    result.reason || '-',
  ]);

  return `# Media Migration Apply Report

Generated at: ${report.generatedAt}

Mode: upload-only pilot

No database references were updated by this command.

## Summary

- Total actions: ${report.summary.total}
- Uploaded: ${report.summary.uploaded}
- Already uploaded from checkpoint: ${report.summary.alreadyUploaded}
- Deduped in this run: ${report.summary.deduped}
- Skipped: ${report.summary.skipped}
- Failed: ${report.summary.failed}

## Results

Showing first 200 results.

| Status | Entity | ID | Field | Path | Uploaded URL | Reason |
|---|---|---|---|---|---|---|
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n') || '| none | - | - | - | - | - | - |'}
`;
}

async function readCheckpoint(checkpointPath) {
  try {
    return JSON.parse(await fs.readFile(checkpointPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return createEmptyMediaMigrationCheckpoint();
    throw error;
  }
}

function requireApplySafety(args) {
  if (!args.limit || args.limit <= 0) {
    throw new Error('Apply mode requires --limit for a controlled pilot batch.');
  }
  if (args.limit > 50) {
    throw new Error('Apply mode limit is capped at 50 per run.');
  }
  if (args.scope !== 'inline-data') {
    throw new Error('Apply mode currently supports --scope inline-data only.');
  }
}

function requireReferenceReplacementSafety(args) {
  if (!args.limit || args.limit <= 0) {
    throw new Error('Reference replacement requires --limit for a controlled pilot batch.');
  }
  if (args.limit > 25) {
    throw new Error('Reference replacement limit is capped at 25 per run.');
  }
  if (args.scope !== 'inline-data') {
    throw new Error('Reference replacement currently supports --scope inline-data only.');
  }
}

function getVpsBaseUrl() {
  return process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
}

function getSyncKey() {
  return process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY;
}

async function vpsJson(pathname, options = {}) {
  const syncKey = getSyncKey();
  if (!syncKey) throw new Error('VITE_VPS_SYNC_KEY or VPS_SYNC_KEY is required for reference replacement.');
  const response = await fetch(`${String(getVpsBaseUrl()).replace(/\/+$/u, '')}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`VPS request failed ${response.status}: ${await response.text()}`);
  return response.json();
}

async function fetchRowsForReplacement(actions) {
  const rowsByEntity = {};
  const productIds = [...new Set(actions
    .filter((action) => action.status === 'planned' && action.entityType === 'product')
    .map((action) => action.entityId)
    .filter(Boolean))];

  for (const productId of productIds) {
    try {
      rowsByEntity[`product:${productId}`] = await vpsJson(`/products/${encodeURIComponent(productId)}`);
    } catch (error) {
      rowsByEntity[`product:${productId}`] = { loadError: error?.message || String(error) };
    }
  }

  return rowsByEntity;
}

async function applyReferenceMutations(mutations) {
  const results = [];
  for (const mutation of mutations) {
    const safeMutation = {
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      sku: mutation.sku,
      field: mutation.field,
      replacementCount: mutation.replacements.length,
      replacements: mutation.replacements,
    };

    if (mutation.entityType !== 'product') {
      results.push({ ...safeMutation, status: 'skipped', reason: 'unsupported entity type' });
      continue;
    }
    if (!mutation.sku) {
      results.push({ ...safeMutation, status: 'failed', reason: 'product SKU is required for /products/images' });
      continue;
    }
    try {
      const response = await vpsJson('/products/images', {
        method: 'PATCH',
        body: JSON.stringify({ sku: mutation.sku, images: mutation.nextValue }),
      });
      results.push({ ...safeMutation, status: 'applied', response });
    } catch (error) {
      results.push({ ...safeMutation, status: 'failed', reason: error?.message || String(error) });
    }
  }
  return {
    applied: results.filter((result) => result.status === 'applied').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}

async function uploadActionToVps(action) {
  const vpsBaseUrl = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY;
  if (!syncKey) throw new Error('VITE_VPS_SYNC_KEY or VPS_SYNC_KEY is required for apply mode.');
  if (!action.uploadPayloadBase64) throw new Error('planned action is missing upload payload');

  const fileName = path.basename(action.plannedPath);
  const payload = Buffer.from(action.uploadPayloadBase64, 'base64');
  const formData = new FormData();
  formData.append('file', new Blob([payload], { type: action.uploadContentType }), fileName);
  formData.append('path', action.plannedPath);

  const response = await fetch(`${String(vpsBaseUrl).replace(/\/+$/u, '')}/images/upload`, {
    method: 'POST',
    headers: {
      'X-Sync-Key': syncKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`VPS upload failed ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const audit = JSON.parse(await fs.readFile(args.auditPath, 'utf8'));
  if (args.apply) requireApplySafety(args);
  if (args.replaceReferences) requireReferenceReplacementSafety(args);
  if (args.apply && args.replaceReferences) {
    throw new Error('Use --apply and --replace-references in separate commands.');
  }

  const plan = limitPlan(buildMediaMigrationPlan(audit, {
    scope: args.scope,
    includeUploadPayloads: args.apply,
  }), args.limit);

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(JSON_PLAN_PATH, `${JSON.stringify(stripUploadPayloadsFromPlan(plan), null, 2)}\n`);
  await fs.writeFile(MD_PLAN_PATH, buildMarkdown(stripUploadPayloadsFromPlan(plan)));

  if (args.replaceReferences) {
    const checkpoint = await readCheckpoint(args.checkpointPath);
    const rowsByEntity = await fetchRowsForReplacement(plan.actions);
    const replacementReport = buildMediaReferenceReplacementPlan(plan, {
      checkpoint,
      rowsByEntity,
    });
    const applySummary = await applyReferenceMutations(replacementReport.mutations);
    const report = {
      ...replacementReport,
      applySummary,
    };
    await fs.writeFile(REPLACE_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(REPLACE_MD_REPORT_PATH, buildReferenceReplaceMarkdown(report));
    console.log(`Reference replacement report written to ${REPLACE_REPORT_PATH} and ${REPLACE_MD_REPORT_PATH}`);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(JSON.stringify(report.applySummary, null, 2));
    if (report.applySummary.failed > 0) process.exitCode = 1;
    return;
  }

  if (!args.apply) {
    console.log(`Read-only migration plan written to ${JSON_PLAN_PATH} and ${MD_PLAN_PATH}`);
    console.log(JSON.stringify(plan.summary, null, 2));
    return;
  }

  const checkpoint = await readCheckpoint(args.checkpointPath);
  const applyReport = await applyMediaMigrationPlan(plan, {
    checkpoint,
    uploader: uploadActionToVps,
  });
  await fs.writeFile(args.checkpointPath, `${JSON.stringify(applyReport.checkpoint, null, 2)}\n`);
  await fs.writeFile(APPLY_REPORT_PATH, `${JSON.stringify(applyReport, null, 2)}\n`);
  await fs.writeFile(APPLY_MD_REPORT_PATH, buildApplyMarkdown(applyReport));

  console.log(`Upload-only apply report written to ${APPLY_REPORT_PATH} and ${APPLY_MD_REPORT_PATH}`);
  console.log(`Checkpoint written to ${args.checkpointPath}`);
  console.log(JSON.stringify(plan.summary, null, 2));
  console.log(JSON.stringify(applyReport.summary, null, 2));
  if (applyReport.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
