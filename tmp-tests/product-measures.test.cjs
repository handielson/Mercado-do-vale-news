const assert = require('assert');
(async () => {
  const { resolveProductMeasures: r } = await import('../services/productMeasures.mjs');
  const old = { weight_kg: 0.2, dimensions: { height_cm: 20, width_cm: 14, depth_cm: 7 }, specs: { weight_kg: 0.036, 'dimensions.height_cm': 16, 'dimensions.width_cm': 8, 'dimensions.depth_cm': 2 } };
  // 1. nada mexido: especificação vence o 20x14x7
  let m = r({ inputSpecs: old.specs, inputDimensions: old.dimensions, inputWeight: old.weight_kg, old });
  assert.deepStrictEqual([m.weight_kg, m.dimensions.height_cm, m.dimensions.width_cm, m.dimensions.depth_cm], [0.036, 16, 8, 2]);
  // 2. mexeu na especificação
  m = r({ inputSpecs: { ...old.specs, 'dimensions.height_cm': '18,5' }, inputDimensions: old.dimensions, inputWeight: 0.2, old });
  assert.strictEqual(m.dimensions.height_cm, 18.5); assert.strictEqual(m.specsPatch['dimensions.height_cm'], 18.5);
  // 3. mexeu na seção de medidas (colunas)
  m = r({ inputSpecs: old.specs, inputDimensions: { height_cm: 30, width_cm: 14, depth_cm: 7 }, inputWeight: 0.5, old });
  assert.strictEqual(m.dimensions.height_cm, 30); assert.strictEqual(m.weight_kg, 0.5); assert.strictEqual(m.specsPatch.weight_kg, 0.5);
  assert.strictEqual(m.dimensions.width_cm, 8, 'largura não mexida segue a especificação');
  // 4. modelo só preenche o que falta, não sobrescreve
  m = r({ inputSpecs: {}, inputDimensions: null, inputWeight: null, old: { specs: {}, weight_kg: 0.3 }, templateValues: { weight_kg: 0.234, 'dimensions.height_cm': 6 } });
  assert.strictEqual(m.weight_kg, 0.3); assert.strictEqual(m.dimensions.height_cm, 6);
  // 5. criação
  m = r({ inputSpecs: { weight_kg: '0.1' }, templateValues: { weight_kg: 0.9, 'dimensions.width_cm': 5 } });
  assert.strictEqual(m.weight_kg, 0.1); assert.strictEqual(m.dimensions.width_cm, 5);
  console.log('product-measures: 5 ok');
})().catch(e => { console.error(e); process.exit(1); });
