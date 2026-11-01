const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mercadoLivreStockWriteDeployEnv } = require('../scripts/mercado-livre-stock-write-deploy.cjs');

const READ_ONLY_ARGS = ['node', 'deploy-vps-server-only.cjs', '--mercado-livre-only'];

test('deploy do Mercado Livre mantém escrita de estoque desligada por padrão', () => {
  assert.deepEqual(mercadoLivreStockWriteDeployEnv(READ_ONLY_ARGS, {}), {
    MDV_ERP_STOCK_WRITE_ENABLED: '0',
    MDV_ERP_PRICE_WRITE_ENABLED: '0',
    MDV_ERP_PUBLISH_ENABLED: '0',
  });
});

test('escrita só pode ser habilitada no deploy seletivo Mercado Livre', () => {
  assert.throws(() => mercadoLivreStockWriteDeployEnv(
    ['node', 'deploy-vps-server-only.cjs', '--enable-erp-stock-write'],
    { MDV_ERP_WRITE_KEY: 'x'.repeat(48) }), /requires --mercado-livre-only/);
});

test('escrita explícita exige chave dedicada válida sem expor seu conteúdo no erro', () => {
  for (const key of ['', 'x'.repeat(31), 'x'.repeat(257)]) {
    assert.throws(() => mercadoLivreStockWriteDeployEnv(
      [...READ_ONLY_ARGS, '--enable-erp-stock-write'], { MDV_ERP_WRITE_KEY: key }),
    error => error.message.includes('MDV_ERP_WRITE_KEY') && (!key || !error.message.includes(key)));
  }
});

test('habilitação explícita escreve somente a chave dedicada e o flag de estoque', () => {
  const key = 'a'.repeat(48);
  assert.deepEqual(mercadoLivreStockWriteDeployEnv(
    [...READ_ONLY_ARGS, '--enable-erp-stock-write'], { MDV_ERP_WRITE_KEY: key }), {
    MDV_ERP_WRITE_KEY: key,
    MDV_ERP_STOCK_WRITE_ENABLED: '1',
    MDV_ERP_PRICE_WRITE_ENABLED: '0',
    MDV_ERP_PUBLISH_ENABLED: '0',
  });
});

test('deploy mantém o gate de preço desligado nesta release', () => {
  const key = 'b'.repeat(48);
  assert.throws(() => mercadoLivreStockWriteDeployEnv(
    ['node', 'deploy-vps-server-only.cjs', '--enable-erp-price-write'],
    { MDV_ERP_WRITE_KEY: key }), /requires --mercado-livre-only/);
  assert.throws(() => mercadoLivreStockWriteDeployEnv(
    [...READ_ONLY_ARGS, '--enable-erp-price-write'], { MDV_ERP_WRITE_KEY: key }), /separately reviewed gate activation/);
  assert.throws(() => mercadoLivreStockWriteDeployEnv(
    [...READ_ONLY_ARGS, '--enable-erp-stock-write', '--enable-erp-price-write'], { MDV_ERP_WRITE_KEY: key }), /separately reviewed gate activation/);
});

test('deploy padrão não exige nem instala a chave de escrita', () => {
  const source = fs.readFileSync(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  const section = source.split("if (process.argv.includes('--mercado-livre-only')) {")[1]
    .split("if (process.argv.includes('--central-printing-only'))")[0];
  assert.match(section, /\.\.\.mercadoLivreStockWriteEnv/);
  assert.match(source, /mercadoLivreStockWriteDeployEnv\(process\.argv, process\.env\)/);
});

test('deploy seletivo mantém publicação do ERP desligada mesmo com chave de publicação presente', () => {
  const key = 'c'.repeat(48);
  const result = mercadoLivreStockWriteDeployEnv(READ_ONLY_ARGS, { MDV_ERP_PUBLISH_KEY: key });
  assert.equal(result.MDV_ERP_PUBLISH_ENABLED, '0');
  assert.equal(result.MDV_ERP_PUBLISH_KEY, undefined);
});
