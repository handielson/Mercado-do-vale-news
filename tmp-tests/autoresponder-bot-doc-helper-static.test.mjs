import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const helperPath = path.join(root, 'tools', 'autoresponder-bot-doc.cjs');
const readinessPath = path.join(root, 'tools', 'check-autoresponder-synology-readiness.cjs');
const currentTestPath = path.join(root, 'tmp-tests', 'autoresponder-bot-doc-helper-static.test.mjs');

const helper = readFileSync(helperPath, 'utf8');
assert.ok(helper.includes("docs', 'autoresponder', 'archive', 'Bot_Whatsapp.md'"), 'helper must support future archived bot doc path');
assert.ok(helper.includes("return path.join(root, 'Bot_Whatsapp.md');"), 'helper must fall back to current root bot doc path');
assert.ok(helper.includes('function readBotWhatsappDoc'), 'helper must expose a document reader');

const readiness = readFileSync(readinessPath, 'utf8');
assert.ok(readiness.includes("require('./autoresponder-bot-doc.cjs')"), 'Synology readiness tool must use the shared bot doc resolver');
assert.ok(readiness.includes('resolveBotWhatsappDocPath(ROOT)'), 'Synology readiness tool must resolve Bot_Whatsapp.md through the helper');

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) return listFiles(filePath);
    return stats.isFile() ? [filePath] : [];
  });
}

const scannedFiles = [
  ...listFiles(path.join(root, 'tmp-tests')).filter((filePath) => filePath.endsWith('.mjs') || filePath.endsWith('.cjs')),
  ...listFiles(path.join(root, 'tools')).filter((filePath) => filePath.endsWith('.mjs') || filePath.endsWith('.cjs')),
].filter((filePath) => path.normalize(filePath) !== path.normalize(helperPath));

const normalizedCurrentTestPath = path.normalize(currentTestPath);
const filesToScan = scannedFiles.filter((filePath) => path.normalize(filePath) !== normalizedCurrentTestPath);

const forbiddenPatterns = [
  /path\.join\([^)]*['"]Bot_Whatsapp\.md['"]/,
  /readFileSync\(\s*['"]Bot_Whatsapp\.md['"]/,
  /fs\.readFileSync\(\s*['"]Bot_Whatsapp\.md['"]/,
];

for (const filePath of filesToScan) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${path.relative(root, filePath)} must use tools/autoresponder-bot-doc.cjs instead of reading Bot_Whatsapp.md directly`,
    );
  }
}

console.log('autoresponder bot doc helper static checks passed');
