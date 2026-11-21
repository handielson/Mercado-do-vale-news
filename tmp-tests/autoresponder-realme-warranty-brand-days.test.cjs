'use strict';
// Garantia do Realme é do fabricante: o prazo vem da marca (365 dias = 1 ano), não da categoria (Smartphones = 90 dias).
// Caso real: Realme 14 5G (21/11/2026) — o bot diria "3 meses pelo fabricante". Roda a função de verdade dos dois servidores.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar(arquivo) {
  const src = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');
  const fn = nome => { const m = src.match(new RegExp(`function ${nome}\\([\\s\\S]*?\\n}\\n`)); assert.ok(m, `${arquivo}: ${nome}`); return m[0]; };
  const corpo = ['normalizeAutoresponderText', 'formatAutoresponderWarrantyPeriod', 'isAutoresponderXiaomiBrand', 'isAutoresponderRealmeBrand', 'formatAutoresponderProductWarrantyLine'].map(fn).join('\n');
  return new Function(`${corpo}; return formatAutoresponderProductWarrantyLine;`)();
}

for (const arquivo of ['vps_server.js', 'vps_server.cjs']) {
  test(`${arquivo}: Realme usa o prazo da marca; sem prazo na marca, o da categoria`, () => {
    const linha = carregar(arquivo);
    assert.equal(linha({ warranty_type: 'brand', brand: 'Realme', brand_warranty_days: 365, category_warranty_days: 90 }), 'Garantia: 1 ano pelo fabricante');
    assert.equal(linha({ warranty_type: 'brand', brand: 'Realme', brand_warranty_days: null, category_warranty_days: 90 }), 'Garantia: 3 meses pelo fabricante');
    assert.equal(linha({ warranty_type: 'brand', brand: 'Xiaomi', brand_warranty_days: 90, category_warranty_days: 90 }), 'Garantia: 3 meses pela loja');
  });
}
