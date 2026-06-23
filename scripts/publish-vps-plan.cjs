#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const API_PATTERNS = [
  /^vps_server\.(?:js|cjs)$/,
  /^server\.js$/,
  /^deploy-vps-server-only\.cjs$/,
  /^api\//,
  /^routes\//,
  /^webhooks?\//,
  /^cron\//,
  /^pm2/i,
  /(?:^|\/)(?:webhook|cron|server|api)[^/]*\.(?:js|cjs|ts)$/,
  /^services\/autoresponder\/engine\//,
  /^tools\/install-autoresponder/,
];

const SITE_PATTERNS = [
  /^pages\//,
  /^components\//,
  /^contexts\//,
  /^hooks\//,
  /^services\//,
  /^utils\//,
  /^types\//,
  /^config\//,
  /^public\//,
  /^src\//,
  /^App\.(?:tsx|jsx|ts|js)$/,
  /^main\.(?:tsx|jsx|ts|js)$/,
  /^index\.html$/,
  /^vite\.config\./,
  /^tailwind\.config\./,
  /^postcss\.config\./,
  /^package(?:-lock)?\.json$/,
  /\.(?:tsx|jsx|css|scss|html)$/,
];

const VERSION_FILES = [
  'public/VERSION.json',
  'VERSAO_ATUAL.md',
  'docs/versoes/YYYY-MM-DD-vX.Y.Z-assunto.md',
];

const DOC_PATTERNS = [
  /^docs\//,
  /^README/i,
  /\.md$/,
  /^publicar\.md$/,
  /^tmp-tests\//,
];

function parseArgs(argv) {
  const options = {
    json: false,
    selfTest: false,
    slug: 'publish',
    summary: '',
    version: '',
    mockFiles: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--self-test') options.selfTest = true;
    else if (arg === '--slug') options.slug = argv[++index] || options.slug;
    else if (arg === '--summary') options.summary = argv[++index] || '';
    else if (arg === '--version') options.version = argv[++index] || '';
    else if (arg === '--mock-files') {
      options.mockFiles = (argv[++index] || '')
        .split(',')
        .map((file) => normalizeFile(file.trim()))
        .filter(Boolean);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.slug = sanitizeSlug(options.slug || options.version || 'publish');
  return options;
}

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function sanitizeSlug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'publish';
}

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    return fallback;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

function classifyFiles(files) {
  const normalized = unique(files.map(normalizeFile));
  const siteFiles = normalized.filter((file) => matchesAny(file, SITE_PATTERNS));
  const apiFiles = normalized.filter((file) => matchesAny(file, API_PATTERNS));
  const versionFiles = normalized.filter((file) => (
    file === 'public/VERSION.json' ||
    file === 'VERSAO_ATUAL.md' ||
    file.startsWith('docs/versoes/')
  ));
  const docsOnly = normalized.length > 0 && normalized.every((file) => matchesAny(file, DOC_PATTERNS));

  const needs = {
    site: siteFiles.length > 0 || versionFiles.includes('public/VERSION.json'),
    api: apiFiles.length > 0,
    version: !docsOnly || versionFiles.length > 0,
  };

  let target = 'none';
  if (needs.site && needs.api) target = 'both';
  else if (needs.site) target = 'site';
  else if (needs.api) target = 'api';
  else if (docsOnly) target = 'docs-only';

  return { normalized, siteFiles, apiFiles, versionFiles, docsOnly, needs, target };
}

function buildReleaseName(options, now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const label = sanitizeSlug(options.version || options.slug || 'publish');
  return `${stamp}-${label}`;
}

function existingChecks(files) {
  const checks = [];
  const changedTests = files.filter((file) => /^tmp-tests\/.*\.(?:mjs|cjs|js)$/.test(file));
  for (const testFile of changedTests) {
    checks.push(`node ${testFile}`);
  }

  for (const serverFile of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
    if (existsSync(path.join(process.cwd(), serverFile))) {
      checks.push(`node --check ${serverFile}`);
    }
  }

  return unique(checks);
}

function buildPlan(options) {
  const statusShort = options.mockFiles ? '' : git(['status', '--short']);
  const trackedFiles = options.mockFiles ? options.mockFiles : unique([
    ...git(['diff', '--name-only']).split(/\r?\n/).map(normalizeFile),
    ...git(['diff', '--cached', '--name-only']).split(/\r?\n/).map(normalizeFile),
  ]);
  const untrackedFiles = options.mockFiles ? [] : git(['ls-files', '--others', '--exclude-standard'])
    .split(/\r?\n/)
    .map(normalizeFile)
    .filter(Boolean);
  const allFiles = unique([...trackedFiles, ...untrackedFiles]);
  const classification = classifyFiles(allFiles);
  const releaseName = buildReleaseName(options);

  const validations = [
    ...existingChecks(allFiles),
  ];
  if (classification.needs.site) validations.push('npm.cmd run build');
  if (classification.target === 'docs-only') validations.push('Revisar docs alterados; deploy nao e necessario.');

  const deployCommands = [];
  if (classification.needs.site) {
    deployCommands.push(`$env:VPS_SITE_RELEASE_NAME='${releaseName}'; npm.cmd run deploy:vps-site`);
  }
  if (classification.needs.api) {
    deployCommands.push('node deploy-vps-server-only.cjs');
  }

  const publicValidations = [];
  if (classification.needs.api) {
    publicValidations.push('curl.exe -s -i https://api.xiaomipetrolina.com.br/status');
  }
  if (classification.needs.site) {
    publicValidations.push('curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\\n" https://www.mercadodovale.com.br/');
    publicValidations.push('curl.exe -s https://www.mercadodovale.com.br/VERSION.json');
  }

  return {
    commandFacts: [
      'git status --short',
      'git diff --name-only',
      'git ls-files --others --exclude-standard',
    ],
    branch: options.mockFiles ? '(mock)' : git(['branch', '--show-current'], '(unknown)'),
    statusShort,
    summary: options.summary,
    changedFiles: allFiles,
    target: classification.target,
    needs: classification.needs,
    siteFiles: classification.siteFiles,
    apiFiles: classification.apiFiles,
    versionFiles: VERSION_FILES,
    releaseName,
    tagSuggestion: options.version ? `v${options.version.replace(/^v/i, '')}` : `vNEXT-${options.slug}`,
    validations: unique(validations),
    deployCommands,
    publicValidations,
    cautions: [
      'Este plano nao faz stage, commit, push nem deploy.',
      'Use apenas stage com caminhos explicitos; evite stage amplo.',
      'Ignore arquivos sujos preexistentes que estejam fora do escopo da publicacao.',
    ],
  };
}

function renderPlan(plan) {
  const lines = [];
  lines.push('# Plano inteligente de publicacao VPS');
  lines.push('');
  lines.push(`Branch: ${plan.branch}`);
  lines.push(`Escopo detectado: ${plan.target}`);
  if (plan.summary) lines.push(`Resumo: ${plan.summary}`);
  lines.push(`Release sugerido: ${plan.releaseName}`);
  lines.push(`Tag sugerida: ${plan.tagSuggestion}`);
  lines.push('');
  lines.push('Arquivos detectados:');
  if (plan.changedFiles.length === 0) lines.push('- nenhum');
  else plan.changedFiles.forEach((file) => lines.push(`- ${file}`));
  lines.push('');
  lines.push('Versionamento obrigatorio:');
  plan.versionFiles.forEach((file) => lines.push(`- ${file}`));
  lines.push('');
  lines.push('Validacoes sugeridas:');
  if (plan.validations.length === 0) lines.push('- revisar diff e rodar teste focado da area alterada');
  else plan.validations.forEach((command) => lines.push(`- ${command}`));
  lines.push('');
  lines.push('Deploy sugerido:');
  if (plan.deployCommands.length === 0) lines.push('- nenhum deploy necessario pelo escopo detectado');
  else plan.deployCommands.forEach((command) => lines.push(`- ${command}`));
  lines.push('');
  lines.push('Validacao publica:');
  if (plan.publicValidations.length === 0) lines.push('- nao aplicavel');
  else plan.publicValidations.forEach((command) => lines.push(`- ${command}`));
  lines.push('');
  lines.push('Cuidados:');
  plan.cautions.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('Checklist final: versionar, validar, stage por caminho explicito, commit, tag, push, deploy, validar dominio, rechecagem do git status.');
  return lines.join('\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const site = classifyFiles(['pages/admin/settings/ShopeePage.tsx', 'public/VERSION.json']);
  assert(site.target === 'site', 'site classification failed');
  assert(site.needs.site === true, 'site deploy need failed');
  assert(site.needs.api === false, 'site api need failed');

  const api = classifyFiles(['vps_server.js']);
  assert(api.target === 'api', 'api classification failed');
  assert(api.needs.api === true, 'api deploy need failed');

  const both = classifyFiles(['pages/Home.tsx', 'vps_server.cjs']);
  assert(both.target === 'both', 'both classification failed');

  const docs = classifyFiles(['docs/versoes/2026-06-23-v1.2.3-note.md']);
  assert(docs.target === 'docs-only', 'docs-only classification failed');

  const releaseName = buildReleaseName({ slug: 'Sincronizacao Shopee' }, new Date('2026-06-23T12:34:56Z'));
  assert(releaseName === '20260623-123456-sincronizacao-shopee', 'release name failed');

  console.log('publish-vps-plan self-test passed');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const plan = buildPlan(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderPlan(plan)}\n`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
