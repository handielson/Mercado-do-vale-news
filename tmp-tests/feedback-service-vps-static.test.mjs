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
  /vpsClient\.get[\s\S]*`\/table-data\/\$\{TABLE_NAME\}/,
  'feedbackService must list feedbacks through VPS table-data',
);

assert.match(
  source,
  /vpsClient\.post<[^>]+>\('\/public\/feedback'/,
  'public feedback creation must use the validated public endpoint',
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
