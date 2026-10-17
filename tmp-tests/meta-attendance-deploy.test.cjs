'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { patchRegistration, patchEnv } = require('../scripts/deploy-meta-attendance.cjs');
const anchor = 'function registerMarketingCampaignRoutes(fastify, dependencies) {';
test('registration preserves remote-only code and CRLF and is idempotent', () => {
  const source = `// remote production configuration\r\n${anchor}\r\n  existing();\r\n}\r\n`;
  const next = patchRegistration(source);
  assert.equal(next.split("require('./metaAttendanceServer.cjs')").length, 2);
  assert.ok(next.endsWith('  existing();\r\n}\r\n'));
  assert.equal(next.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(patchRegistration(next), next);
});
test('registration fails closed on moved or duplicate anchors', () => {
  assert.throws(() => patchRegistration('changed registration'));
  assert.throws(() => patchRegistration(`${anchor}\n${anchor}`));
  assert.throws(() => patchRegistration(`${anchor}\n other();\n  require('./metaAttendanceServer.cjs').registerMetaAttendanceRoutes(fastify, dependencies);\n`));
});
test('environment updates only pilot keys and rejects ambiguity', () => {
  const token = 'a'.repeat(64);
  const source = 'OTHER_SETTING=preserved\nMETA_ATTENDANCE_ENABLED=false\n';
  const next = patchEnv(source, token);
  assert.ok(next.startsWith('OTHER_SETTING=preserved\nMETA_ATTENDANCE_ENABLED=true\n'));
  assert.equal(patchEnv(next, token), next);
  assert.throws(() => patchEnv(source, 'short'));
  assert.throws(() => patchEnv('META_ATTENDANCE_ENABLED=false\nMETA_ATTENDANCE_ENABLED=true\n', token));
});
test('publication planner deploys pilot API selectively before frontend', () => {
  const output = execFileSync(process.execPath, ['scripts/publish-vps-plan.cjs', '--mock-files', 'scripts/deploy-meta-attendance.cjs,services/metaAttendanceCore.cjs,services/metaAttendanceServer.cjs,pages/admin/settings/marketing/MetaAttendancePanel.tsx', '--json'], { encoding: 'utf8' });
  const plan = JSON.parse(output);
  assert.equal(plan.deployCommands[0], 'node scripts/deploy-meta-attendance.cjs --apply');
  assert.ok(plan.deployCommands[1].includes('deploy:vps-site'));
  assert.equal(plan.deployCommands.includes('node deploy-vps-server-only.cjs'), false);
});
