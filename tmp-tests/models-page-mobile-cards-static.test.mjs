import assert from 'node:assert/strict';
import fs from 'node:fs';

// Modelos (parte 2): celular em cartões, filtros num botão, "Salvar" só quando o preço muda.
const s = fs.readFileSync(new URL('../pages/admin/settings/ModelsPage.tsx', import.meta.url), 'utf8');
assert.match(s, /variant\?: 'row' \| 'card'/);
assert.match(s, /if \(variant === 'card'\) \{/);
assert.match(s, /data-model-card[\s\S]*data-model-card-save/);
assert.match(s, /phoneModel === false && \(dirty \|\| saving \|\| saved\)/, 'Salvar só quando mudou');
assert.match(s, /const dirty = Boolean\(savedPrices\) && PRICE_KEYS\.some/);
assert.match(s, /isMobile \? \(\s*<div className="space-y-3" data-models-cards>/, 'só uma das duas visões é montada');
assert.match(s, /data-models-filters-toggle/);
assert.equal((s.match(/mobileFiltersOpen \? 'block w-full' : 'hidden'/g) || []).length, 4, 'os 4 filtros recolhem no celular');
const layout = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
assert.match(layout, /\/admin\/navigation-log\?limit=400/, '"Mais usados" lê menos histórico');
assert.match(layout, /sessionStorage\.setItem\(NAVIGATION_LOG_CACHE_KEY/);
console.log('models page mobile cards static test passed');

// Parte 3 (computador): tabela sem caixa de rolagem própria; "Salvar" só quando mudou (ou atalho do celular).
assert.match(s, /overflow-x-auto" data-models-table>\s*<table className="w-full min-w-\[1100px\] table-fixed relative">/);
assert.doesNotMatch(s, /max-h-\[65vh\]/);
assert.match(s, /\{\(phoneModel !== false \|\| dirty \|\| saving \|\| saved\) && <button\s+data-model-row-save/);
console.log('models page desktop table static test passed');
