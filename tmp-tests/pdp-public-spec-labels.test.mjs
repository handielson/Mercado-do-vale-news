// public-spec-labels-v1: a ficha do cliente usa os mesmos nomes de campo que o admin.
// Caso real (06/11): admin via "Resistência" e o cliente via "resistencia", porque os nomes
// (/table-data/custom_fields) só carregavam para admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

function routeSource(file) {
  const s = read(file);
  const start = s.indexOf("const PUBLIC_SPEC_LABEL_CATEGORIES");
  const end = s.indexOf('\n});\n', s.indexOf("fastify.get('/public/spec-labels'", start)) + 5;
  assert.ok(start > 0 && end > start, `${file} deve ter a rota /public/spec-labels`);
  return s.slice(start, end);
}

/** Executa o handler da rota com linhas falsas de custom_fields. */
async function runRoute(file, rows) {
  let handler;
  const headers = {};
  const fastify = { get: (p, _opts, fn) => { if (p === '/public/spec-labels') handler = fn; } };
  const pool = { query: async sql => { assert.match(sql, /FROM custom_fields/); return [rows]; } };
  vm.runInNewContext(routeSource(file), { fastify, pool, Set, String });
  assert.ok(handler, 'rota registrada');
  return handler({}, { header: (k, v) => { headers[k] = v; } }).then(body => ({ body, headers }));
}

const rows = [
  { key: 'resistencia', label: 'Resistência', category: 'spec' },
  { key: 'celular_biometria', label: 'Biometria', category: 'spec' },
  { key: 'peso_g', label: 'Peso (g)', category: 'logistics' },
  // basic = campos do cadastro de cliente (CustomerFormPage filtra category === 'basic'): nunca públicos.
  { key: 'limite_credito', label: 'Limite de Crédito', category: 'basic' },
  { key: 'dia_vencimento', label: 'Dia de Vencimento', category: 'basic' },
  { key: 'preferencia_contato', label: 'Preferência de Contato', category: 'basic' },
  { key: 'sem_categoria', label: 'Sem categoria', category: null },
  // Logística da entrega/cliente, não do produto (v1.2.813).
  { key: 'observacoes_entrega', label: 'Observações de Entrega', category: 'logistics' },
  { key: 'ncm', label: 'NCM', category: 'fiscal' },
  { key: 'custo_medio', label: 'Custo médio', category: 'price' },
  { key: '_price_group_network', label: 'Rede do grupo', category: 'spec' },
  { key: 'sem_nome', label: '', category: 'spec' },
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: devolve só chave -> nome dos campos de ficha (spec/logistics), com acento`, async () => {
    const { body, headers } = await runRoute(file, rows);
    assert.deepEqual(JSON.parse(JSON.stringify(body)), { resistencia: 'Resistência', celular_biometria: 'Biometria', peso_g: 'Peso (g)' });
    assert.match(headers['Cache-Control'], /public/);
  });

  test(`${file}: rota liberada sem login (leitura pública)`, () => {
    assert.match(read(file), /pathname === '\/public\/company-settings' \|\|\n\s+pathname === '\/public\/spec-labels' \|\|/);
  });
}

test('as duas cópias da API têm a mesma rota', () => {
  assert.equal(routeSource('vps_server.js'), routeSource('vps_server.cjs'));
});

test('o site lê a rota direto da API e a página usa para todo mundo (não só admin)', () => {
  assert.match(read('services/vpsTransport.js'), /'\/public\/spec-labels',/);
  const page = read('pages/store/PublicProductPage.tsx');
  assert.match(page, /vpsClient\.get<Record<string, string>>\('\/public\/spec-labels'\)/);
  assert.doesNotMatch(page, /customFieldsService\.list\(\)/, 'os nomes não podem voltar a depender do acesso de admin');
});
