import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const packageBuilder = source.match(
    /function buildTikTokDraftPackageVps\(product\) \{[\s\S]*?\r?\n\}/,
  )?.[0];
  assert.ok(packageBuilder, `${file}: TikTok package builder not found`);
  const buildPackage = Function(
    `function parseTikTokDraftJsonVps(value, fallback) {
      if (value && typeof value === 'object') return value;
      try { return JSON.parse(String(value)); } catch { return fallback; }
    }
    ${packageBuilder};
    return buildTikTokDraftPackageVps;`,
  )();
  assert.deepEqual(
    buildPackage({
      weight_kg: null,
      dimensions: {},
      model_template_values: {
        weight_kg: 0.4,
        'dimensions.depth_cm': 12,
        'dimensions.width_cm': 19,
        'dimensions.height_cm': 6,
      },
    }),
    {
      package_weight: { value: '400', unit: 'GRAM' },
      package_dimensions: {
        length: '12',
        width: '19',
        height: '6',
        unit: 'CENTIMETER',
      },
    },
    `${file}: package must inherit logistics from the linked model`,
  );
  assert.match(
    source,
    /SELECT template_values FROM models WHERE id = \? LIMIT 1[\s\S]*product\.model_template_values/,
    `${file}: draft creation must load the linked model logistics`,
  );

  const functions = source.match(
    /function normalizeTikTokShopAttributeNameVps\(value\) \{[\s\S]*?\r?\n\}\r?\n\r?\nasync function applyTikTokShopAutomaticAttributesVps/,
  )?.[0].replace(/\r?\n\r?\nasync function applyTikTokShopAutomaticAttributesVps$/, '');
  assert.ok(functions, `${file}: required attribute helpers not found`);

  const { mergeProvided, assertRequired } = Function(
    `${functions}; return {
      mergeProvided: mergeTikTokShopProvidedAttributesVps,
      assertRequired: assertTikTokShopRequiredAttributesVps,
    };`,
  )();
  const definitions = [{
    id: '102427',
    name: 'Is Anatel Homologation Code Required',
    is_required: true,
    values: [
      { id: 'yes-id', name: 'Sim' },
      { id: 'no-id', name: 'Nao' },
    ],
  }];
  const payload = mergeProvided(
    { category_id: '913032', product_attributes: [] },
    definitions,
    [{ id: '102427', value_id: 'yes-id', value_name: 'nome adulterado' }],
  );
  assert.deepEqual(payload.product_attributes, [{
    id: '102427',
    name: 'Is Anatel Homologation Code Required',
    values: [{ id: 'yes-id', name: 'Sim' }],
  }], `${file}: selection must use the canonical catalog value`);
  assert.equal(assertRequired(payload, definitions), payload);
  assert.throws(
    () => assertRequired({ category_id: '913032', product_attributes: [] }, definitions),
    (error) => error?.statusCode === 422 && /102427/.test(error.message),
    `${file}: missing required attributes must be blocked before TikTok`,
  );
  assert.throws(
    () => mergeProvided(
      { category_id: '913032', product_attributes: [] },
      definitions,
      [{ id: '102427', value_id: 'forged-id', value_name: 'Sim' }],
    ),
    (error) => error?.statusCode === 422 && /opcao valida/.test(error.message),
    `${file}: forged catalog values must be rejected`,
  );
  assert.match(
    source,
    /applyTikTokShopAutomaticAttributesVps\([\s\S]*request\.body\?\.required_attributes/,
    `${file}: publish route must validate the seller-provided attributes`,
  );
}

const preparation = readFileSync(
  'pages/admin/settings/components/TikTokShopProductPreparation.tsx',
  'utf8',
);
assert.match(
  preparation,
  /readiness\.required_attributes\.map[\s\S]*attributeOptions\(attribute\)[\s\S]*Selecione uma opcao[\s\S]*Digite o valor exigido pelo TikTok/,
  'preparation UI must render selection or text controls for mandatory attributes',
);
assert.match(
  preparation,
  /publishDraft\(selectedProduct\.id,\s*requiredAttributes\)/,
  'publication must submit the filled mandatory attributes',
);
assert.match(
  preparation,
  /modelService\.getById\(product\.model_id\)[\s\S]*values\['dimensions\.depth_cm'\]/,
  'preparation diagnostics must inherit logistics from the linked model',
);
assert.match(
  preparation,
  /String\(attribute\?\.id[\s\S]*=== '102427'[\s\S]*Nao possui codigo Anatel/,
  'the ANATEL required attribute must expose an explicit no-code option',
);

const service = readFileSync('services/tiktokShopService.ts', 'utf8');
assert.match(
  service,
  /\{ required_attributes: requiredAttributes \}/,
  'frontend service must send mandatory attributes in the publication body',
);

console.log('TikTok Shop required attribute checks passed');
