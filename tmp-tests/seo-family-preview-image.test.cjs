const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { seoVersions, patchSeoFamily } = require('../scripts/deploy-catalog-media.cjs');
test('selective SEO deployment preserves remote customizations and rejects drift', () => {
  const choices = seoVersions(process.cwd());
  for (const choice of choices) {
    const before = '// remote customization\n' + choice.before;
    const result = patchSeoFamily(before, choices);
    assert.equal(result, '// remote customization\n' + choice.after);
    assert.equal(patchSeoFamily(result, choices), result);
    assert.throws(() => patchSeoFamily(before.replace('let modelColorImages = [];', 'let modelColorImages = ["drift"];'), choices), /drift/);
  }
});

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  function extract(name) {
    const start = source.indexOf(name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
  }
  async function resolve({ parent = { id: 'family', images: [] }, product = {}, siblings = [], model = [], socialPreview = true } = {}) {
    const queries = [];
    const context = { URL, parsePublicJson: value => value || {}, pool: { query: async (sql, args) => {
      queries.push({ sql, args });
      if (sql.includes('INNER JOIN products parent')) return [[parent].filter(Boolean)];
      if (sql.includes('FROM model_color_images')) return [model];
      assert.match(sql, /WHERE parent_id = \?/);
      assert.equal(args[0], 'family');
      assert.match(sql, /hide_from_catalog = 0/);
      assert.match(sql, /ORDER BY id ASC/);
      return [siblings];
    } } };
    vm.runInNewContext([
      extract('function normalizeSeoImages('), extract('function isSeoPublicImageUrl('),
      extract('function normalizeSeoPublicImages('), extract('async function loadSeoProductImages('),
    ].join('\n'), context);
    const images = await context.loadSeoProductImages({ id: 'child', images: ['/child.jpg'], ...product }, 'https://mercadodovale.com.br', { socialPreview });
    return { images: Array.from(images), queries };
  }
  test(file + ': parent image wins over child and model color', async () => {
    const result = await resolve({ parent: { id: 'family', images: '["/parent.jpg"]' }, product: { model_id: 'model', specs: { color: 'Azul' } }, model: [{ images: ['/blue.jpg'] }] });
    assert.equal(result.images[0], 'https://mercadodovale.com.br/parent.jpg');
    assert.equal(result.queries.length, 1);
    assert.equal((await resolve({ parent: { id: 'family', image_url: '/parent-url.jpg' } })).images[0], 'https://mercadodovale.com.br/parent-url.jpg');
  });
  test(file + ': missing or unusable parent image uses a variation', async () => {
    assert.equal((await resolve()).images[0], 'https://mercadodovale.com.br/child.jpg');
    assert.equal((await resolve({ parent: { id: 'family', images: ['data:image/png;base64,a'] } })).images[0], 'https://mercadodovale.com.br/child.jpg');
    const result = await resolve({ product: { images: [] }, siblings: [{ images: [] }, { image_url: '/sibling.jpg' }] });
    assert.equal(result.images[0], 'https://mercadodovale.com.br/sibling.jpg');
  });
  test(file + ': independent product and empty family keep existing fallbacks', async () => {
    assert.equal((await resolve({ parent: null })).images[0], 'https://mercadodovale.com.br/child.jpg');
    assert.deepEqual((await resolve({ product: { images: [] } })).images, []);
    assert.equal((await resolve({ product: { images: [], model_id: 'model', specs: { color: 'Azul' } }, model: [{ image_url: '/blue.jpg' }] })).images[0], 'https://mercadodovale.com.br/blue.jpg');
  });
  test(file + ': structured product images preserve the selected variation', async () => {
    const result = await resolve({ socialPreview: false, parent: { id: 'family', images: ['/parent.jpg'] } });
    assert.equal(result.images[0], 'https://mercadodovale.com.br/child.jpg');
    assert.equal(result.queries.length, 0);
    const model = await resolve({ socialPreview: false, product: { model_id: 'model', specs: { color: 'Azul' } }, model: [{ images: ['/blue.jpg'] }] });
    assert.equal(model.images[0], 'https://mercadodovale.com.br/blue.jpg');
  });
}
