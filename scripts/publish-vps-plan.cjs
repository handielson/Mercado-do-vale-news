#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const API_PATTERNS = [
  /^scripts\/deploy-meta-attendance\.cjs$/,
  /^scripts\/deploy-meta-attendance-replies\.cjs$/,
  /^services\/metaAttendance(?:Core|Replies|Transport|Media)\.cjs$/,
  /^vps_server\.(?:js|cjs)$/,
  /^server\.js$/,
  /^deploy-vps-server-only\.cjs$/,
  /^infra\/nginx\/mdv-api(?:-|\.)/,
  /^scripts\/install-vps-api-nginx\.cjs$/,
  /^api\//,
  /^routes\//,
  /^webhooks?\//,
  /^cron\//,
  /^pm2/i,
  /(?:^|\/)(?:webhook|cron|server|api)[^/]*\.(?:js|cjs|ts)$/,
  /^services\/autoresponder\/engine\//,
  /^services\/marketingCampaignApi\.cjs$/,
  /^services\/mercadoLivrePublication\.cjs$/,
  /^services\/mercadoLivreListingPrice\.cjs$/,
  /^services\/mobileSalesPushService\.cjs$/,
  /^services\/(?:priorityStockDecrement|saleStockReconciliation)\.cjs$/,
  /^services\/.*Vault\.cjs$/,
  /^services\/.*Server\.(?:js|cjs|ts)$/i,
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

const N8N_WORKFLOW_PATTERNS = [
  /^scripts\/(?:build|deploy)-n8n-meta-attendance\.cjs$/,
  /^scripts\/(?:deploy-n8n-meta-payjoy|n8n-meta-payjoy-images)\.cjs$/,
  /^tmp-tests\/n8n-(?!.*(?:readonly|native.*smoke|\.test\.cjs$)).*\.cjs$/,
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
  const localOnly = file => file === 'services/localCatalogPreviewServer.cjs';
  const siteFiles = normalized.filter((file) => matchesAny(file, SITE_PATTERNS)
    && !localOnly(file)
    && !/^services\/(?:priorityStockDecrement|saleStockReconciliation)\.cjs$/.test(file));
  const apiFiles = normalized.filter((file) => matchesAny(file, API_PATTERNS) && !localOnly(file));
  const n8nFiles = normalized.filter((file) => matchesAny(file, N8N_WORKFLOW_PATTERNS));
  const versionFiles = normalized.filter((file) => (
    file === 'public/VERSION.json' ||
    file === 'VERSAO_ATUAL.md' ||
    file.startsWith('docs/versoes/')
  ));
  const docsOnly = normalized.length > 0
    && n8nFiles.length === 0
    && normalized.every((file) => matchesAny(file, DOC_PATTERNS));

  const needs = {
    site: siteFiles.length > 0 || versionFiles.includes('public/VERSION.json'),
    api: apiFiles.length > 0,
    n8n: n8nFiles.length > 0,
    version: !docsOnly || versionFiles.length > 0,
  };

  let target = 'none';
  if ([needs.site, needs.api, needs.n8n].filter(Boolean).length > 1) target = 'multiple';
  else if (needs.site) target = 'site';
  else if (needs.api) target = 'api';
  else if (needs.n8n) target = 'n8n';
  else if (docsOnly) target = 'docs-only';

  return { normalized, siteFiles, apiFiles, n8nFiles, versionFiles, docsOnly, needs, target };
}

function n8nDeployCommands(files) {
  if(files.includes('scripts/deploy-n8n-meta-payjoy.cjs')||files.includes('scripts/n8n-meta-payjoy-images.cjs'))return ['node scripts/deploy-n8n-meta-payjoy.cjs --apply'];
  if(files.includes('scripts/deploy-n8n-meta-attendance.cjs')) return ['node scripts/deploy-n8n-meta-attendance.cjs --apply'];
  if(files.includes('tmp-tests/n8n-attendance-flow-contract.cjs')) return ['node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --attendance-fixes --apply --model-test-evidence .local/n8n-attendance-composed-native-evidence.private.json'];
  if(files.includes('tmp-tests/n8n-sales-model-configuration.cjs')){
    return ['node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --model-configuration --apply --model-test-evidence .local/n8n-sales-model-configuration-native-evidence.json'];
  }
  if (files.some(file => /^tmp-tests\/n8n-gpt6-luna-/.test(file))) {
    return ['node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --gpt6-luna --apply --model-test-evidence .local/n8n-gpt6-native-evidence.json'];
  }
  const sales = files.some(file => /^tmp-tests\/n8n-sales-/.test(file));
  return [
    ...(sales ? ['node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --sales-contract --apply'] : []),
    ...files.filter(file => !sales || (!/^tmp-tests\/n8n-sales-/.test(file) && file !== 'tmp-tests/n8n-fix-payjoy-link-confirmation.cjs')).flatMap((file) => {
    const absolute = path.join(process.cwd(), file);
    if (!existsSync(absolute)) return [];
    const source = require('node:fs').readFileSync(absolute, 'utf8');
    if (source.includes('--apply-production')) return [`node ${file} --apply-production`];
    if (source.includes('--apply')) return [`node ${file} --apply`];
    return [`Revisar e aplicar manualmente o mutador n8n: ${file}`];
    }),
  ];
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
  const attendance=files.includes('tmp-tests/n8n-attendance-flow-contract.cjs');
  const configuration=!attendance && files.includes('tmp-tests/n8n-sales-model-configuration.cjs');
  const models = !attendance && !configuration && files.some(file => /^tmp-tests\/n8n-gpt6-luna-/.test(file));
  const sales = !attendance && !configuration && files.some(file => /^tmp-tests\/n8n-sales-/.test(file));
  const changedTests = files.filter((file) => /^tmp-tests\/.*\.test\.(?:mjs|cjs|js)$/.test(file)
    && !(attendance && /^tmp-tests\/n8n-attendance-/.test(file))
    && !(configuration && /^tmp-tests\/n8n-(?:sales-|gpt6-luna-)/.test(file))
    && !(sales && /^tmp-tests\/n8n-sales-/.test(file))
    && !(models && /^tmp-tests\/n8n-gpt6-luna-/.test(file)));
  for (const testFile of changedTests) {
    checks.push(`node ${testFile}`);
  }
  if (sales) checks.push('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --sales-contract');
  if (attendance) checks.push('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --attendance-fixes');
  if (configuration) checks.push('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --model-configuration');
  if(files.includes('scripts/deploy-catalog-media.cjs'))checks.push('node scripts/assert-catalog-media-contract.cjs','node deploy-vps-server-only.cjs --catalog-media-check');
  if (files.includes('scripts/deploy-shopee-filelink.cjs')) checks.push('node deploy-vps-server-only.cjs --shopee-filelink-check');
  if (models) checks.push('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --gpt6-luna');

  const serverFilesChanged = files.some((file) => ['server.js', 'vps_server.js', 'vps_server.cjs'].includes(file));
  if (serverFilesChanged && existsSync(path.join(process.cwd(), 'tmp-tests/pdv-stock-location-decrement-static.test.mjs'))) {
    checks.push('node tmp-tests/pdv-stock-location-decrement-static.test.mjs');
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
  const metaReplies = allFiles.includes('scripts/deploy-meta-attendance-replies.cjs');
  const metaAttendance = metaReplies || allFiles.includes('scripts/deploy-meta-attendance.cjs');
  if (classification.needs.api && metaAttendance) deployCommands.push(`node scripts/deploy-meta-attendance${metaReplies?'-replies':''}.cjs --apply`);
  const catalogMedia = allFiles.includes('scripts/deploy-catalog-media.cjs');
  const salesDelivery = allFiles.includes('scripts/deploy-sales-delivery.cjs');
  const shopeeFilelink = allFiles.includes('scripts/deploy-shopee-filelink.cjs');
  const mercadoLivrePriceOnly = classification.apiFiles.length > 0
    && classification.apiFiles.every(file => file === 'services/mercadoLivreListingPrice.cjs');
  if (classification.needs.api && mercadoLivrePriceOnly) deployCommands.push('node deploy-vps-server-only.cjs --mercado-livre-only');
  if (classification.needs.api && shopeeFilelink) deployCommands.push('node deploy-vps-server-only.cjs --shopee-filelink-only');
  if (classification.needs.api && catalogMedia && !shopeeFilelink) deployCommands.push('node deploy-vps-server-only.cjs --catalog-media-only');
  if (classification.needs.api && salesDelivery && !catalogMedia && !shopeeFilelink) deployCommands.push('node deploy-vps-server-only.cjs --sales-delivery-only');
  if (classification.needs.site) {
    deployCommands.push(`$env:VPS_SITE_RELEASE_NAME='${releaseName}'; npm.cmd run deploy:vps-site`);
  }
  if (classification.needs.api && !metaAttendance && !salesDelivery && !catalogMedia && !shopeeFilelink && !mercadoLivrePriceOnly) {
    deployCommands.push('node deploy-vps-server-only.cjs');
  }
  deployCommands.push(...n8nDeployCommands(classification.n8nFiles));

  const publicValidations = [];
  if (classification.needs.api) {
    publicValidations.push('curl.exe -s -i https://api.xiaomipetrolina.com.br/status');
  }
  if (classification.needs.site) {
    publicValidations.push('curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\\n" https://www.mercadodovale.com.br/');
    publicValidations.push('curl.exe -s https://www.mercadodovale.com.br/VERSION.json');
  }
  if (classification.needs.n8n) {
    publicValidations.push('curl.exe -s -i https://n8n.mercadodovale.com.br/healthz');
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
    n8nFiles: classification.n8nFiles,
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

  const apiNginx = classifyFiles(['infra/nginx/mdv-api-ssl.conf', 'scripts/install-vps-api-nginx.cjs']);
  assert(apiNginx.target === 'api', 'API Nginx classification failed');
  assert(apiNginx.needs.api === true, 'API Nginx deploy need failed');

  const both = classifyFiles(['pages/Home.tsx', 'vps_server.cjs']);
  assert(both.target === 'multiple', 'multiple classification failed');

  const marketingApi = classifyFiles(['pages/admin/settings/marketing/MarketingCampaignMetricsPanel.tsx', 'services/marketingCampaignApi.cjs']);
  assert(marketingApi.target === 'multiple', 'marketing campaign API module must deploy site and API');

  const saleAlerts = classifyFiles(['components/admin/SaleAlerts.tsx', 'services/mobileSalesPushService.cjs']);
  assert(saleAlerts.target === 'multiple', 'sale alerts must deploy site and API');

  const serviceServer = classifyFiles(['pages/admin/products/SmartphonePhotoIntakePage.tsx', 'services/smartphonePhotoIntakeServer.cjs']);
  assert(serviceServer.target === 'multiple', 'server modules inside services must deploy site and API');
  const localPreview = classifyFiles(['components/products/ProductCard.tsx', 'services/localCatalogPreviewServer.cjs']);
  assert(localPreview.target === 'site', 'local preview server must not trigger an API deploy');
  const previewOnly = classifyFiles(['services/localCatalogPreviewServer.cjs']);
  assert(!previewOnly.needs.api && !previewOnly.needs.site, 'local preview is development-only');
  const fiscalVault = classifyFiles(['services/fiscalCscVault.cjs']);
  assert(fiscalVault.target === 'multiple', 'server-side vault modules must deploy site and API');
  const listingPrice = classifyFiles(['services/mercadoLivreListingPrice.cjs']);
  assert(listingPrice.target === 'multiple', 'Mercado Livre listing price handler must deploy site and API');
  const listingPricePlan = buildPlan({
    mockFiles: ['services/mercadoLivreListingPrice.cjs', 'tmp-tests/mercado-livre-product-links.test.cjs', 'public/VERSION.json'],
    slug: 'ml-quantity-price',
  });
  assert(listingPricePlan.deployCommands[0] === 'node deploy-vps-server-only.cjs --mercado-livre-only', 'listing price change must use the selective Mercado Livre API deploy first');
  assert(listingPricePlan.deployCommands[1].includes('npm.cmd run deploy:vps-site'), 'listing price release manifest must publish the site after API');

  const n8n = classifyFiles(['tmp-tests/n8n-ai-natural-sales-responses.cjs']);
  assert(n8n.target === 'n8n', 'n8n workflow mutator classification failed');
  assert(n8n.needs.n8n === true, 'n8n workflow publication need failed');
  const n8nTest = classifyFiles(['tmp-tests/n8n-phone-price-list-cards.test.cjs']);
  assert(n8nTest.target === 'docs-only', 'n8n regression test must not be treated as a workflow deploy');
  const attendanceFiles=['tmp-tests/n8n-fix-payjoy-link-confirmation.cjs','tmp-tests/n8n-attendance-flow-contract.cjs','tmp-tests/n8n-attendance-native-recovery-smoke.cjs','tmp-tests/n8n-attendance-flow-contract.test.cjs'];
  assert(n8nDeployCommands(attendanceFiles).length===1 && n8nDeployCommands(attendanceFiles)[0].includes('--attendance-fixes --apply --model-test-evidence'),'attendance composition must have one canonical deploy command');
  assert(existingChecks(attendanceFiles).includes('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --attendance-fixes'),'attendance preflight must validate the exact candidate');
  assert(!classifyFiles(['tmp-tests/n8n-attendance-native-recovery-smoke.cjs']).needs.n8n,'native smoke is validation, not a workflow mutation');
  const salesFiles=['tmp-tests/n8n-fix-payjoy-link-confirmation.cjs','tmp-tests/n8n-sales-flow-contract.cjs','tmp-tests/n8n-sales-end-to-end.test.cjs'];
  assert(JSON.stringify(n8nDeployCommands(salesFiles)) === JSON.stringify(['node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --sales-contract --apply']), 'sales composition must have one canonical deploy command with its explicit mode');
  assert(existingChecks(salesFiles).includes('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --sales-contract'), 'sales preflight must validate the exact generated candidate');
  assert(!existingChecks(salesFiles).some(command=>/node tmp-tests\/n8n-sales-/.test(command)), 'sales tests need the gate-provided snapshot and helper modules are not executable checks');

  const modelFiles=['tmp-tests/n8n-fix-payjoy-link-confirmation.cjs','tmp-tests/n8n-gpt6-luna-migration.cjs','tmp-tests/n8n-gpt6-luna-native-smoke.cjs','tmp-tests/n8n-gpt6-luna-migration.test.cjs'];
  const configurationFiles=['tmp-tests/n8n-sales-model-configuration.cjs','tmp-tests/n8n-sales-model-configuration.test.cjs','tmp-tests/n8n-fix-payjoy-link-confirmation.cjs','tmp-tests/n8n-gpt6-luna-native-smoke.cjs'];
  assert(n8nDeployCommands(configurationFiles).length===1 && n8nDeployCommands(configurationFiles)[0].includes('--model-configuration --apply --model-test-evidence .local/n8n-sales-model-configuration-native-evidence.json'),'configuration publication must not run a model migration because the shared smoke changed');
  assert(existingChecks(configurationFiles).includes('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --model-configuration'),'configuration preflight needs the exact candidate');
  assert(!existingChecks(configurationFiles).some(command=>command.includes('--gpt6-luna')||command.includes('--sales-contract')||command.includes('model-configuration.test.cjs')),'configuration dry-run owns dependent tests and must keep its explicit mode');
  assert(n8nDeployCommands(modelFiles).length===1 && n8nDeployCommands(modelFiles)[0].includes('--gpt6-luna --apply --model-test-evidence'), 'model migration requires explicit mode and native evidence');
  assert(existingChecks(modelFiles).includes('node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --gpt6-luna'), 'model migration tests require the exact candidate');
  assert(!existingChecks(modelFiles).some(command=>command.includes('migration.test.cjs')), 'model tests receive their snapshot from canonical dry-run');
  const serverChecks = existingChecks(['vps_server.js']);
  assert(
    serverChecks.includes('node tmp-tests/pdv-stock-location-decrement-static.test.mjs'),
    'server publication must protect PDV stock-location names across server copies'
  );

  const docs = classifyFiles(['docs/versoes/2026-06-23-v1.2.3-note.md']);
  const mediaPlan=buildPlan({mockFiles:['scripts/deploy-catalog-media.cjs','vps_server.js','public/VERSION.json'],slug:'media'});
  assert(mediaPlan.deployCommands[0]==='node deploy-vps-server-only.cjs --catalog-media-only','media API must publish selectively before the site');
  assert(existingChecks(['scripts/deploy-catalog-media.cjs']).includes('node deploy-vps-server-only.cjs --catalog-media-check'),'media release needs a readonly remote preflight');
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
