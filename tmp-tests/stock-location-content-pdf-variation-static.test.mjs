import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

assertIncludes(page, 'getSpecValue', 'location PDF variation should read multiple spec key aliases');
assertIncludes(page, "['color', 'cor', 'Cor']", 'location PDF variation should accept Portuguese color keys');
assertIncludes(page, 'inferColorVariationFromName', 'location PDF variation should infer color-like words from product name');
assertIncludes(page, "'transparente'", 'location PDF variation should handle transparent cases as a variation');
assertIncludes(page, 'nameWithoutColor', 'location PDF should remove inferred color from the base product name');

console.log('stock location content PDF variation static checks passed');
