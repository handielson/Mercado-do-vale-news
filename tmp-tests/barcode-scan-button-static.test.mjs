import assert from 'node:assert/strict';
import fs from 'node:fs';

// Botão 📷 de leitura pela câmera nos campos de IMEI, serial e EAN.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const button = read('components/ui/BarcodeScanButton.tsx');
const scanner = read('services/barcodeScanner.ts');
const imei = read('components/ui/IMEIInput.tsx');
const ean = read('components/ui/EANInput.tsx');
const specs = read('components/products/sections/ProductSpecifications.tsx');
const review = read('components/products/photo-intake/PhotoIntakeReviewCard.tsx');

assert.match(scanner, /import\('zxing-wasm\/reader\/zxing_reader\.wasm\?url'\)/, 'leitor (iPhone) usa o .wasm publicado com o site, sem CDN');
assert.match(scanner, /locateFile: \(\) => wasmUrl/);
assert.match(scanner, /BarcodeDetector/, 'Android usa o leitor nativo quando existe');
assert.match(scanner, /import\('zxing-wasm\/reader'\)/, 'zxing só carrega quando o leitor abre');
assert.match(button, /facingMode: \{ ideal: 'environment' \}/, 'abre a câmera traseira');
assert.match(button, /getTracks\(\)\.forEach\(track => track\.stop\(\)\)/, 'desliga a câmera ao fechar');
assert.match(button, /pickScannedValues\(kind, /, 'filtra o que foi lido pelo tipo do campo');
assert.match(button, /capture="environment"/, 'plano B: tirar foto quando a câmera ao vivo não abre');
assert.match(button, /Usar os dois \(IMEI 1 e IMEI 2\)/);
assert.match(imei, /<BarcodeScanButton\s+kind="imei"/, 'campo de IMEI tem o botão da câmera');
assert.match(ean, /<BarcodeScanButton\s+kind="ean"/, 'campo de EAN tem o botão da câmera');
assert.match(specs, /kind="serial"/, 'serial do produto tem o botão da câmera');
assert.match(specs, /onScanPair=\{\(imeis\) => \{[\s\S]*setValue\('specs\.imei2', imeis\[1\]/, 'IMEI 1 pode preencher o IMEI 2 junto');
assert.match(review, /<BarcodeScanButton\s+kind=\{field\.kind\}/, 'conferência do cadastro por foto tem o botão da câmera');
assert.match(specs, /flex flex-wrap items-center justify-between gap-2 mb-4" data-specs-header/, 'cabeçalho das especificações quebra linha no celular');

console.log('barcode scan button static test passed');
