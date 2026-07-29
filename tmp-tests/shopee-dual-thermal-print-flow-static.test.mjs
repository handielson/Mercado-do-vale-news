import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const script = readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
const panel = readFileSync('pages/admin/settings/components/ShopeePrintersTab.tsx', 'utf8');

assert.match(script, /shippingLabelsDir\s*=\s*path\.join\(__dirname, 'Etiquetas de envio'\)/,
  'etiquetas precisam ficar em uma pasta local dedicada');
assert.match(script, /printedMarkersDir\s*=\s*path\.join\(__dirname, 'shopee_printed'\)/,
  'marcadores de pedidos impressos precisam ficar fora da pasta apagável');
assert.match(script, /clearShippingLabels\(\)[\s\S]*?\.pdf/,
  'a limpeza deve atingir somente PDFs de etiquetas e resumos');
assert.match(script, /shipping_document_type:\s*["']NORMAL_AIR_WAYBILL["']/,
  'a etiqueta normal da Shopee precisa ser usada para permitir o recorte 10x15');
assert.match(script, /expandShopeeLabelForThermalPaper/,
  'a etiqueta da Shopee precisa ser ampliada antes da impressão térmica');

const thermalPrints = script.match(/paperSize:\s*'4x6'[\s\S]{0,80}?scale:\s*'fit'/g) || [];
assert.ok(thermalPrints.length >= 4,
  'etiqueta e resumo precisam usar papel 4x6 e escala fit nos fluxos manual e automático');
assert.match(script, /runPrintFlowTest[\s\S]*?labelPrinter[\s\S]*?summaryPrinter/,
  'o teste precisa enviar conteúdo para as duas térmicas');
assert.match(script, /req\.url === '\/test-flow' && req\.method === 'POST'/,
  'o serviço local precisa expor o fluxo de teste');

for (const text of [
  'duas térmicas 10x15',
  'Executar fluxo de teste',
  'Limpar arquivos',
  'Etiquetas de envio',
]) {
  assert.match(panel, new RegExp(text), `painel deve manter o texto: ${text}`);
}

console.log('Shopee dual thermal print flow regression checks passed.');
