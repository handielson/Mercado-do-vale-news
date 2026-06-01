import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/feedbackService.ts', 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'feedbackService must not import Supabase',
);

assert.doesNotMatch(
  source,
  /\.from\(/,
  'feedbackService must not use Supabase table queries',
);

assert.match(
  source,
  /companySettingsService/,
  'feedbackService must resolve the company id from VPS company settings',
);

assert.match(
  source,
  /vpsClient\.get[\s\S]*`\/table-data\/\$\{TABLE_NAME\}/,
  'feedbackService must list feedbacks through VPS table-data',
);

assert.match(
  source,
  /vpsClient\.post<[^>]+>\(`\/table-data\/\$\{TABLE_NAME\}`/,
  'feedbackService must create feedbacks through VPS table-data',
);

assert.match(
  source,
  /vpsClient\.patch<[^>]+>\(\s*`\/table-data\/\$\{TABLE_NAME\}\/\$\{encodeURIComponent\(id\)\}`/,
  'feedbackService must update feedbacks through VPS table-data',
);

assert.match(
  source,
  /vpsClient\.delete\(`\/table-data\/\$\{TABLE_NAME\}\/\$\{encodeURIComponent\(id\)\}`/,
  'feedbackService must delete feedbacks through VPS table-data',
);

console.log('feedbackService VPS static checks ok');
