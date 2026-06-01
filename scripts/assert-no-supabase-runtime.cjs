const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = ['services', 'contexts', 'components', 'pages', 'hooks', 'routes'];
const BLOCKED_PATTERNS = [
  'services/supabase',
  './supabase',
  '../services/supabase',
  '@/services/supabase',
  '@supabase/supabase-js',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', '.worktrees'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function findSupabaseRuntimeReferences() {
  return SCAN_ROOTS
    .map((dir) => path.join(ROOT, dir))
    .flatMap((dir) => walkFiles(dir))
    .filter((file) => /\.(ts|tsx|js|cjs|mjs)$/.test(file))
    .flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return BLOCKED_PATTERNS
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => ({ file, pattern }));
    });
}

function assertNoSupabaseRuntime() {
  const references = findSupabaseRuntimeReferences();
  if (!references.length) return;

  const shown = references
    .slice(0, 12)
    .map(({ file, pattern }) => `- ${path.relative(ROOT, file).replace(/\\/g, '/')}: ${pattern}`);
  const remaining = references.length - shown.length;
  if (remaining > 0) shown.push(`- ... e mais ${remaining} referencias`);

  throw new Error(
    [
      'Build/deploy bloqueado: ainda existe codigo runtime Supabase no frontend.',
      'Pela regra de migracao, Supabase e apenas legado/consulta historica e nao pode voltar ao bundle publicado.',
      'Migre os fluxos restantes para VPS/MySQL antes de gerar/publicar o site.',
      ...shown,
    ].join('\n')
  );
}

if (require.main === module) {
  try {
    assertNoSupabaseRuntime();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  assertNoSupabaseRuntime,
  findSupabaseRuntimeReferences,
};
