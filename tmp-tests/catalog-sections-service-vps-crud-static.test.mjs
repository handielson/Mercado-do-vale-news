import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/catalogSectionsService.ts', 'utf8');

assert.match(source, /vpsClient/, 'catalog sections CRUD must use the VPS client');
assert.match(source, /\/table-data\/catalog_sections\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'catalog sections list must page through the VPS table-data endpoint');
assert.match(source, /\/table-data\/catalog_sections['"]/, 'catalog sections create must post through VPS table-data');
assert.match(source, /\/table-data\/catalog_sections\/\$\{encodeURIComponent\(id\)\}\?pk=id/, 'catalog sections update/delete must use the explicit id primary key through VPS');
assert.doesNotMatch(source, /\.from\('catalog_sections'\)|supabase\.from\('catalog_sections'\)/, 'catalog sections service must not read or mutate catalog_sections through Supabase');
assert.doesNotMatch(source, /supabase\.auth\.getUser/, 'catalog sections service must not depend on Supabase auth for createSection user_id');

console.log('catalog sections VPS CRUD static checks passed');

// Exercita o corpo real da criacao, isolando transporte e sessao. Se a assinatura
// TypeScript mudar, atualizar esta extracao junto com a refatoracao.
const createBody = source.split('async createSection(sectionData: CreateSectionData): Promise<CatalogSection> {')[1]?.split('\n    /**')[0];
assert.ok(createBody, 'metodo de criacao deve existir');
const body = createBody.trim().replace(/}\s*,?$/, '').replace('vpsClient.post<any>', 'vpsClient.post');
const runCreate = new Function('getCurrentAuthUserId', 'vpsClient', 'stripUndefined', 'normalizeSection',
    `return async function(sectionData) { ${body} }`);
let sent;
let cacheCleared = false;
const create = runCreate(async () => 'operator-id', { post: async (path, payload) => { sent = { path, payload }; return { id: 'section', ...payload }; } },
    payload => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)), value => value);
const result = await create.call({ clearCache() { cacheCleared = true; } }, { title: 'Categoria teste', section_type: 'custom', user_id: 'outro', filter_categories: ['categoria'], subtitle: undefined });
assert.equal(sent.payload.user_id, 'operator-id', 'responsavel vem da sessao atual, nunca do formulario');
assert.deepEqual(sent.payload.filter_categories, ['categoria']);
assert.equal(sent.payload.subtitle, undefined);
assert.equal(result.id, 'section');
assert.equal(cacheCleared, true);
let postedWithoutSession = false;
const expired = runCreate(async () => null, { post: async () => { postedWithoutSession = true; } }, value => value, value => value);
await assert.rejects(expired.call({ clearCache() {} }, {}), /sessão expirou/);
assert.equal(postedWithoutSession, false, 'sem sessao nao envia insert incompleto');
console.log('catalog section creation uses current operator and blocks missing sessions');
