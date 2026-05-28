import fs from 'node:fs';

const source = fs.readFileSync('scripts/deploy-vps-site.cjs', 'utf8');

const requiredSnippets = [
  'function getEnvRoots()',
  "'.worktrees'",
  'parts.slice(0, worktreesIndex).join(path.sep)',
  "'.env.vps.local'",
  "'.env.local'",
  'for (const envRoot of getEnvRoots())',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missing.length > 0) {
  throw new Error(`deploy-vps-site env worktree fallback missing: ${missing.join(', ')}`);
}

console.log('vps deploy worktree env fallback static check passed');
