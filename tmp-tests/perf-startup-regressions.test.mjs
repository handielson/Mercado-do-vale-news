import fs from 'node:fs';
import assert from 'node:assert/strict';

const shareButton = fs.readFileSync('components/catalog/ShareCatalogButton.tsx', 'utf8');
const useCatalog = fs.readFileSync('hooks/useCatalog.ts', 'utf8');

assert(
  !/import\s*\{[^}]*generate(?:FullCatalog|Category)PDF[^}]*\}\s*from\s*['"]@\/utils\/catalogPDFGenerator['"]/.test(shareButton),
  'ShareCatalogButton must not statically import catalogPDFGenerator/jsPDF into the public catalog startup bundle',
);

assert(
  /if\s*\(\s*settingsLoading\s*\)\s*\{\s*return;\s*\}/s.test(useCatalog),
  'useCatalog must wait for catalog settings before the first product request to avoid duplicate startup payloads',
);

console.log('perf startup regressions passed');
