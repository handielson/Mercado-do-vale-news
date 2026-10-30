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
  });
});

test('preço exige flag separado e nunca liga escrita de estoque junto', () => {
  const key = 'b'.repeat(48);
  assert.throws(() => mercadoLivreStockWriteDeployEnv(
    ['node', 'deploy-vps-server-only.cjs', '--enable-erp-price-write'],
    { MDV_ERP_WRITE_KEY: key }), /requires --mercado-livre-only/);
  assert.deepEqual(mercadoLivreStockWriteDeployEnv(
    [...READ_ONLY_ARGS, '--enable-erp-price-write'], { MDV_ERP_WRITE_KEY: key }), {
    MDV_ERP_WRITE_KEY: key,
    MDV_ERP_STOCK_WRITE_ENABLED: '0',
    MDV_ERP_PRICE_WRITE_ENABLED: '1',
  });
  assert.deepEqual(mercadoLivreStockWriteDeployEnv(
    [...READ_ONLY_ARGS, '--enable-erp-stock-write', '--enable-erp-price-write'], { MDV_ERP_WRITE_KEY: key }), {
    MDV_ERP_WRITE_KEY: key,
    MDV_ERP_STOCK_WRITE_ENABLED: '1',
    MDV_ERP_PRICE_WRITE_ENABLED: '1',
  });
});

test('deploy padrão não exige nem instala a chave de escrita', () => {
  const source = fs.readFileSync(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  const section = source.split("if (process.argv.includes('--mercado-livre-only')) {")[1]
    .split("if (process.argv.includes('--central-printing-only'))")[0];
  assert.match(section, /\.\.\.mercadoLivreStockWriteEnv/);
  assert.match(source, /mercadoLivreStockWriteDeployEnv\(process\.argv, process\.env\)/);
});
