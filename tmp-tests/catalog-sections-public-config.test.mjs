import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/catalogSectionsService.ts', 'utf8');
const activeMethod = service.split('async getActiveSections(userId?: string): Promise<CatalogSection[]> {')[1].split('\n    /**')[0].trim().replace(/}\s*$/, '').replace('get<any[]>', 'get');
const run = new Function('vpsClient', 'sortSections', 'normalizeSection', 'buildDefaultPublicSections', `return async function(userId) { ${activeMethod} }`);
const sort = rows => [...rows].sort((a, b) => a.display_order - b.display_order);
const normalize = row => ({ ...row, is_enabled: Boolean(row.is_enabled) });
const configured = [
    { id: 'recent', title: 'Mais Recentes', is_enabled: 1, display_order: 1 },
    { id: 'phone', title: 'Smartphones', is_enabled: 1, display_order: 0, filter_categories: ['smartphones'] },
    { id: 'disabled', is_enabled: 0, display_order: -1 },
];
let path;
const read = run({ get: async endpoint => { path = endpoint; return configured; } }, sort, normalize, () => ['fallback']);
assert.deepEqual((await read()).map(row => row.id), ['phone', 'recent']);
assert.equal(path, '/catalog/sections');
assert.deepEqual((await read())[0].filter_categories, ['smartphones']);
// Uma configuração vazia é válida: não ressuscitar as seções padrão.
const empty = run({ get: async () => [] }, sort, normalize, () => ['fallback']);
assert.deepEqual(await empty(), []);
const unavailable = run({ get: async () => { throw new Error('offline'); } }, sort, normalize, () => ['fallback']);
assert.deepEqual(await unavailable(), ['fallback']);
assert.deepEqual(await read.call({ getSections: async () => configured }, 'operator'), configured.filter(row => row.is_enabled));

for (const filename of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const source = readFileSync(filename, 'utf8');
    const route = source.split("fastify.get('/catalog/sections', async (req, reply) => {")[1].split('\n});')[0];
    assert.ok(route, `${filename}: rota pública deve existir`);
    let sql;
    let header;
    const handle = new Function('pool', `return async function(req, reply) { ${route} }`)({ query: async query => { sql = query; return [configured]; } });
    assert.deepEqual(await handle({}, { header: (...args) => { header = args; } }), configured);
    assert.match(sql, /FROM catalog_sections WHERE is_enabled = 1 ORDER BY display_order ASC/);
    assert.doesNotMatch(sql, /SELECT \*|user_id/);
    assert.deepEqual(header, ['Cache-Control', 'no-store']);
    assert.match(source, /pathname === '\/catalog\/sections' \|\|/);
}
const { isPublicVpsPath } = await import('../services/vpsTransport.js');
assert.equal(isPublicVpsPath('/catalog/sections', 'GET'), true);
assert.equal(isPublicVpsPath('/catalog/sections', 'POST'), false);
assert.equal(isPublicVpsPath('/table-data/catalog_sections', 'GET'), false);
console.log('Public storefront sections follow saved configuration and expose only display fields.');
const { patchCatalogSections } = await import('../scripts/deploy-catalog-sections.cjs');
const local = readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');
const routeBlock = local.slice(local.indexOf('// A vitrine lê'), local.indexOf("fastify.get('/catalog-settings'"));
const baseline = local.replace(routeBlock, '').replace("    pathname === '/catalog/sections' ||\n", '') + '\n// unrelated remote edit\n';
const patched = patchCatalogSections(baseline, local);
assert.equal(patched, local + '\n// unrelated remote edit\n');
assert.equal(patchCatalogSections(patched, local), patched);
const previousBlock = routeBlock.slice(0, routeBlock.indexOf('// Salva a ordem completa em uma transação;'));
const previousRelease = local.replace(routeBlock, previousBlock) + '\n// unrelated remote edit\n';
assert.equal(patchCatalogSections(previousRelease, local), local + '\n// unrelated remote edit\n');
assert.throws(() => patchCatalogSections(previousRelease.replace('FROM catalog_sections WHERE', 'FROM other_sections WHERE'), local), /Remote catalog route differs/);
assert.throws(() => patchCatalogSections(baseline.replace("fastify.get('/catalog-settings'", "fastify.get('/renamed'"), local), /Ambiguous/);
