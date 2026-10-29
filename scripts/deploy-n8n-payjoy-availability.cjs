'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const { deploy, callRemote, assertAligned, fingerprint } = require('./deploy-n8n-meta-attendance.cjs');
const { patchWorkflow } = require('../tmp-tests/n8n-payjoy-availability-patch.cjs');
const { runGate } = require('./n8n-sales-regression-gate.cjs');

const SOURCE = 'f5c086068f27e2a0b08f2d87094b1948b36d6d917eb6caf811e7ff53503304a2';
const TARGET = 'bb5d08653181bf7b6f6219108199b46c7cc80afe75313e3b4fce9f102195cf45';
const SNAPSHOT = path.resolve(__dirname, '../.local/5190-publish-candidate.private.json');

function buildPlan(snapshot) {
  assertAligned(snapshot);
  const before = fingerprint(snapshot.workflow);
  assert.ok([SOURCE, TARGET].includes(before), 'Workflow drift; preserve concurrent edits');
  const candidate = patchWorkflow(snapshot.workflow);
  assert.equal(fingerprint(candidate), TARGET, 'Candidate fingerprint drift');
  return { candidate, alreadyApplied: before === TARGET, credential: { name: 'Existing production credentials preserved' }, beforeSha256: before, afterSha256: TARGET };
}

function validate(_snapshot, plan) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(plan.candidate), { mode: 0o600 });
  runGate(SNAPSHOT, { stdio: 'inherit' });
  return { validated: true };
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every(arg => arg === '--apply'), 'Only --apply is supported');
  const client = new Client();
  await new Promise((resolve, reject) => client.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const result = await deploy({ apply: args.includes('--apply'), remote: request => callRemote(client, request), buildPlan, validate });
    console.log(JSON.stringify(result));
  } finally { client.end(); }
}

if (require.main === module) main().catch(error => { console.error(JSON.stringify({ message: error.message, ...error.report })); process.exitCode = 1; });
module.exports = { buildPlan, validate, SOURCE, TARGET };
