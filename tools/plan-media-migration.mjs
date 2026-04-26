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
