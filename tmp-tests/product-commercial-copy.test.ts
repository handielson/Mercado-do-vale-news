import assert from 'node:assert/strict';
import type { CatalogProduct } from '../types/catalog';
import {
  buildProductCommercialCopy,
  buildProductCommercialEvidenceText,
  COMMERCIAL_COPY_LIMITS,
  limitCommercialText,
  validateProductCommercialArtwork,
  formatProductMarketingPrice,
} from '../pages/admin/settings/marketing/productCommercialCopy.ts';

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: 'produto-1',
  model_id: 'modelo-1',
  model: 'ROC191U',
  name: 'Guia Organizador de Cabos Rack 19" Horizontal ROC191U',
  sku: 'ROC191U',
  brand: 'Furukawa',
  price_cost: 5000,
  price_retail: 123456,
  price_reseller: 0,
  price_wholesale: 0,
  images: ['https://cdn.example/produto.png'],
  eans: [],
  specs: { aplicacao: 'Rack 19 polegadas', instalacao: 'Horizontal' },
  status: 'active',
  track_inventory: true,
  stock_quantity: 1,
  warranty_type: 'brand',
  ...overrides,
} as CatalogProduct);

// 1. Produto completo: hierarquia comercial esperada e três argumentos sustentados pelo tipo de produto.
const completeCopy = buildProductCommercialCopy(product(), 'Organização de rede');
assert.equal(completeCopy.title, 'ADEUS, CABOS BAGUNÇADOS');
assert.equal(completeCopy.subtitle, 'Organização profissional para seu rack');
assert.equal(completeCopy.badge, 'PARA RACK 19″');
assert.deepEqual(completeCopy.benefits, ['Visual mais limpo', 'Cabos bem direcionados', 'Instalação profissional']);
assert.deepEqual(completeCopy.triggers, []);
assert.equal(completeCopy.technicalName, product().name);

// 2. Sem preço: a validação permite gerar e avisa que o layout será reorganizado.
const noPrice = validateProductCommercialArtwork({
  copy: completeCopy,
  imageUrl: product().images[0],
  logoUrl: '/brand/mercado-do-vale-logo.png',
  showPrice: true,
  price: 0,
  supportedBenefits: completeCopy.benefits,
});
assert.equal(noPrice.valid, true);
assert.match(noPrice.warnings.join(' '), /reorganizada sem preço/i);

// 3. Apenas um benefício comprovável.
const oneBenefit = buildProductCommercialCopy(product({
  name: 'Conector RJ45',
  model: 'RJ45',
  brand: '',
  specs: {},
}), '');
assert.deepEqual(oneBenefit.benefits, ['Conexão RJ45']);

// 4 e 12. Nome longo não vira título e todos os textos limitados terminam em palavras inteiras.
const longName = 'Produto profissional extremamente longo para instalações comerciais e residenciais com identificação técnica completa';
const longCopy = buildProductCommercialCopy(product({ name: longName, model: 'XYZ', specs: {} }), 'Categoria igualmente muito extensa para ser exibida inteira');
assert.ok(longCopy.title.length <= COMMERCIAL_COPY_LIMITS.title);
assert.ok(longCopy.subtitle.length <= COMMERCIAL_COPY_LIMITS.subtitle);
assert.ok(longCopy.badge.length <= COMMERCIAL_COPY_LIMITS.badge);
assert.ok(longCopy.cta.length <= COMMERCIAL_COPY_LIMITS.cta);
assert.ok(longCopy.benefits.every((benefit) => benefit.length <= COMMERCIAL_COPY_LIMITS.benefit));
assert.equal(limitCommercialText('um texto comercial que não deve cortar a última palavra', 20), 'um texto comercial');

// 5 e 6. Imagem ausente ou endereço inválido bloqueiam a geração.
const missingImage = validateProductCommercialArtwork({ copy: completeCopy, imageUrl: '', logoUrl: '/logo.png', showPrice: false });
assert.equal(missingImage.valid, false);
assert.match(missingImage.errors.join(' '), /imagem oficial/i);
const invalidImage = validateProductCommercialArtwork({ copy: completeCopy, imageUrl: 'arquivo-sem-url', logoUrl: '/logo.png', showPrice: false });
assert.equal(invalidImage.valid, false);
assert.match(invalidImage.errors.join(' '), /endereço inválido/i);

// 7. Sem compatibilidade, nenhum padrão de compatibilidade é inventado.
const noCompatibility = buildProductCommercialCopy(product({
  name: 'Patch panel com 24 portas',
  model: 'PP24',
  specs: {},
  description: '',
}), 'Rede');
assert.ok(noCompatibility.benefits.includes('24 portas identificadas'));
assert.ok(noCompatibility.benefits.every((benefit) => !/T568|CAT\d/i.test(benefit)));

// Benefício digitado sem correspondência no cadastro é rejeitado.
const inventedBenefit = validateProductCommercialArtwork({
  copy: { ...oneBenefit, benefits: ['Garantia vitalícia'] },
  imageUrl: '/produto.png',
  logoUrl: '/logo.png',
  showPrice: false,
  supportedBenefits: oneBenefit.benefits,
  evidenceText: buildProductCommercialEvidenceText(product({ name: 'Conector RJ45', specs: {} })),
});
assert.equal(inventedBenefit.valid, false);
assert.match(inventedBenefit.errors.join(' '), /sem apoio nos dados oficiais/i);

const manuallyEditedBenefit = validateProductCommercialArtwork({
  copy: { ...oneBenefit, benefits: ['Conexão organizada'] },
  imageUrl: '/produto.png',
  logoUrl: '/logo.png',
  showPrice: false,
  supportedBenefits: oneBenefit.benefits,
  evidenceText: buildProductCommercialEvidenceText(product({ name: 'Conector RJ45', specs: {} })),
});
assert.equal(manuallyEditedBenefit.valid, true);
assert.match(manuallyEditedBenefit.warnings.join(' '), /editados manualmente/i);

// Gatilhos são opcionais, limitados e avisam para conferência da condição comercial.
const commercialTriggers = validateProductCommercialArtwork({
  copy: { ...oneBenefit, triggers: ['Entrega grátis', 'Estoque limitado'] },
  imageUrl: '/produto.png',
  logoUrl: '/logo.png',
  showPrice: false,
});
assert.equal(commercialTriggers.valid, true);
assert.match(commercialTriggers.warnings.join(' '), /gatilhos comerciais/i);

// 8. O modo padronizado não depende de IA/API; indisponibilidade de fetch não impede a geração local.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => { throw new Error('API indisponível'); }) as typeof fetch;
assert.doesNotThrow(() => buildProductCommercialCopy(product(), 'Organização de rede'));
globalThis.fetch = originalFetch;

// 9. Regenerar com os mesmos dados é determinístico e não cria estado inconsistente.
assert.deepEqual(
  buildProductCommercialCopy(product(), 'Organização de rede'),
  buildProductCommercialCopy(product(), 'Organização de rede'),
);

// 11. Preço oficial em centavos é exibido em Real brasileiro.
assert.equal(formatProductMarketingPrice(123456).replace(/\s/g, ' '), 'R$ 1.234,56');

console.log('product-commercial-copy.test.ts: ok');
