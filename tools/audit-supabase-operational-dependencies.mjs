import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['services', 'pages', 'components', 'hooks', 'contexts', 'utils'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs']);
const MAX_BASELINE_FROM_CALLS = 0;
const MAX_BASELINE_RPC_CALLS = 0;
const MAX_BASELINE_STORAGE_CALLS = 0;
const MAX_UNCLASSIFIED_OPERATIONAL_MATCHES = 0;

const ALLOWED_OPERATIONAL_DEPENDENCIES = [
];

function walk(dir, files = []) {
  const absoluteDir = path.join(ROOT, dir);
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path.relative(ROOT, absolutePath).replace(/\\/g, '/');
    if (relativePath.includes('/node_modules/') || relativePath.startsWith('dist/')) continue;

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walk(relativePath, files);
      continue;
    }

    if (stat.isFile() && EXTENSIONS.has(path.extname(entry))) {
      files.push(relativePath);
    }
  }
  return files;
}

function collectMatches(files, regex, kind) {
  const matches = [];
  for (const file of files) {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      matches.push({
        kind,
        file,
        line,
        target: match[1] || match[2] || match[3] || 'dynamic',
      });
    }
  }
  return matches;
}

function summarizeByTarget(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.target, (counts.get(match.target) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target));
}

function uniqueFiles(matches) {
  return new Set(matches.map((match) => match.file)).size;
}

function isAllowedOperationalMatch(match) {
  return ALLOWED_OPERATIONAL_DEPENDENCIES.some((entry) => {
    const targetAllowed = entry.targets.includes(match.target) || entry.targets.includes('*');
    const kindAllowed = !entry.kinds || entry.kinds.includes(match.kind);
    const fileAllowed = entry.files.some((prefix) => match.file.startsWith(prefix));
    return targetAllowed && kindAllowed && fileAllowed;
  });
}

function annotateAllowedMatches(matches) {
  return matches
    .map((match) => {
      const allowedBy = ALLOWED_OPERATIONAL_DEPENDENCIES.find((entry) => {
        const targetAllowed = entry.targets.includes(match.target) || entry.targets.includes('*');
        const kindAllowed = !entry.kinds || entry.kinds.includes(match.kind);
        const fileAllowed = entry.files.some((prefix) => match.file.startsWith(prefix));
        return targetAllowed && kindAllowed && fileAllowed;
      });
      return allowedBy ? { ...match, allowedBy: allowedBy.reason } : null;
    })
    .filter(Boolean);
}

function summarizeByReason(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.allowedBy, (counts.get(match.allowedBy) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

const files = SCAN_DIRS.flatMap((dir) => walk(dir));
const fromMatches = collectMatches(files, /supabase\.from\(\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))/g, 'from');
const rpcMatches = collectMatches(files, /supabase\.rpc\(\s*'([^']+)'|\.rpc\(\s*'([^']+)'|\.rpc\(\s*([A-Za-z_$][\w$]*)/g, 'rpc');
const storageMatches = collectMatches(files, /supabase\.storage|storage\.from\('([^']+)'\)/g, 'storage');
const authMatches = collectMatches(files, /supabase\.auth\.([A-Za-z_$][\w$]*)/g, 'auth');
const operationalMatches = [...fromMatches, ...rpcMatches, ...storageMatches];
const allowedOperationalMatches = annotateAllowedMatches(operationalMatches);
const unclassifiedOperationalMatches = operationalMatches.filter((match) => !isAllowedOperationalMatch(match));

const report = {
  scannedFiles: files.length,
  baselines: {
    from: MAX_BASELINE_FROM_CALLS,
    rpc: MAX_BASELINE_RPC_CALLS,
    storage: MAX_BASELINE_STORAGE_CALLS,
  },
  totals: {
    from: fromMatches.length,
    rpc: rpcMatches.length,
    storage: storageMatches.length,
  },
  files: {
    from: uniqueFiles(fromMatches),
    rpc: uniqueFiles(rpcMatches),
    storage: uniqueFiles(storageMatches),
    auth: uniqueFiles(authMatches),
  },
  auth: {
    total: authMatches.length,
    topMethods: summarizeByTarget(authMatches).slice(0, 20),
  },
  allowlist: {
    entries: ALLOWED_OPERATIONAL_DEPENDENCIES.map((entry) => ({
      reason: entry.reason,
      targets: entry.targets,
      kinds: entry.kinds || ['from', 'rpc', 'storage'],
      files: entry.files,
    })),
    allowedOperationalMatches: allowedOperationalMatches.length,
    unclassifiedOperationalMatches: unclassifiedOperationalMatches.length,
    byReason: summarizeByReason(allowedOperationalMatches),
    topUnclassifiedTargets: summarizeByTarget(unclassifiedOperationalMatches).slice(0, 20),
  },
  topFromTargets: summarizeByTarget(fromMatches).slice(0, 20),
  topRpcTargets: summarizeByTarget(rpcMatches).slice(0, 30),
  topStorageTargets: summarizeByTarget(storageMatches).slice(0, 20),
};

const violations = [];
if (report.totals.from > MAX_BASELINE_FROM_CALLS) {
  violations.push(`Legacy provider .from(...) calls increased: ${report.totals.from} > ${MAX_BASELINE_FROM_CALLS}`);
}
if (report.totals.rpc > MAX_BASELINE_RPC_CALLS) {
  violations.push(`Legacy provider rpc(...) calls increased: ${report.totals.rpc} > ${MAX_BASELINE_RPC_CALLS}`);
}
if (report.totals.storage > MAX_BASELINE_STORAGE_CALLS) {
  violations.push(`Legacy provider storage calls increased: ${report.totals.storage} > ${MAX_BASELINE_STORAGE_CALLS}`);
}
if (report.allowlist.unclassifiedOperationalMatches > MAX_UNCLASSIFIED_OPERATIONAL_MATCHES) {
  violations.push(
    `Unclassified legacy provider operational dependencies increased: ${report.allowlist.unclassifiedOperationalMatches} > ${MAX_UNCLASSIFIED_OPERATIONAL_MATCHES}`,
  );
}

console.log(JSON.stringify({ ...report, ok: violations.length === 0, violations }, null, 2));

if (violations.length > 0) {
  process.exitCode = 1;
}
