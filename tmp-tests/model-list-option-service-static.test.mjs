import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/table-data.ts', 'utf8');

assert.match(
    source,
    /async createRow\(\s*tableName: string,\s*values: TableRow\s*\): Promise<TableRow>/,
    'tableDataService must expose a typed async createRow method'
);
assert.match(
    source,
    /vpsClient\.post<TableRow>\(\s*`\/table-data\/\$\{encodeURIComponent\(tableName\)\}`,\s*values\s*\)/,
    'createRow must POST values to the encoded VPS table-data route'
);
assert.match(
    source,
    /async updateRow\(\s*tableName: string,\s*primaryKey: string,\s*primaryValue: string \| number,\s*values: TableRow\s*\): Promise<TableRow>/,
    'tableDataService must expose a typed async updateRow method'
);
assert.match(
    source,
    /vpsClient\.patch<TableRow>\(\s*`\/table-data\/\$\{encodeURIComponent\(tableName\)\}\/\$\{encodeURIComponent\(String\(primaryValue\)\)\}\?pk=\$\{encodeURIComponent\(primaryKey\)\}`,\s*values\s*\)/,
    'updateRow must PATCH values using encoded table, primary value, and primary key'
);

const optionService = readFileSync('services/modelListOptions.ts', 'utf8');

assert.match(optionService, /customFieldsService\.update/);
assert.match(optionService, /colorService\.(create|update)/);
assert.match(optionService, /ramService\.(create|update)/);
assert.match(optionService, /storageService\.(create|update)/);
assert.match(optionService, /versionService\.(create|update)/);
assert.match(optionService, /tableDataService\.(createRow|updateRow)/);
assert.match(optionService, /findEquivalentOption/);

console.log('model list option table-data mutation static checks passed');
