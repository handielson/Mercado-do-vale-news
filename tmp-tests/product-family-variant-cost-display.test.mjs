import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// "Variações cadastradas": custo vem em centavos, às vezes como texto ("170000.00") — deve aparecer R$ 1.700,00.
const source = fs.readFileSync(new URL('../components/products/ProductFamilyInheritance.tsx', import.meta.url), 'utf8');
const fn = source.match(/function display\(value: unknown, field\?: string\) \{[\s\S]*?\n\}/)[0];
const display = new Function(`${ts.transpile(fn)}; return display;`)();
const nbsp = text => text.replace(/ /g, ' ');
assert.equal(nbsp(display('170000.00', 'price_cost')), 'R$ 1.700,00');
assert.equal(nbsp(display(170000, 'price_cost')), 'R$ 1.700,00');
assert.equal(nbsp(display('0.00', 'price_cost')), 'R$ 0,00');
assert.match(source, /Number\(child\.price_cost\) > 0 \? display\(child\.price_cost, 'price_cost'\) : <span className="font-semibold text-amber-700">Sem custo<\/span>/);
console.log('product family variant cost display test passed');
