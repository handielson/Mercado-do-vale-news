import fs from 'node:fs';

const source = fs.readFileSync('scripts/deploy-vps-site.cjs', 'utf8');

const requiredSnippets = [
  'OLD_TARGET=$(readlink -f',
  'if [ -n "$OLD_TARGET" ] && [ "$OLD_TARGET" !=',
  'previousLink',
];

const forbiddenSnippets = [
  'OLD_TARGET=$(readlink ${shellQuote(currentLink)})',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
const forbidden = forbiddenSnippets.filter((snippet) => source.includes(snippet));

if (missing.length > 0 || forbidden.length > 0) {
  throw new Error([
    missing.length ? `missing: ${missing.join(', ')}` : '',
    forbidden.length ? `forbidden: ${forbidden.join(', ')}` : '',
  ].filter(Boolean).join(' | '));
}

console.log('vps deploy previous symlink static check passed');
