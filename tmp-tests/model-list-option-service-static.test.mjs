import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/table-data.ts', 'utf8');

assert.match(
    source,
    /meta\?:\s*\{\s*primaryKey:\s*string;\s*primaryValue:\s*string \| number;\s*row:\s*TableRow;\s*\}/,
    'TableOption must expose optional row identity metadata without breaking existing consumers'
);
assert.match(
    source,
    /const primaryKey = row\.id != null \? 'id' : valueColumn/,
    'table options must prefer id as primary key and fall back to the configured value column'
);
assert.match(
    source,
    /meta:\s*\{\s*primaryKey,\s*primaryValue:\s*row\[primaryKey\] as string \| number,\s*row,?\s*\}/,
    'loaded table options must retain primary key, primary value, and source row metadata'
);
assert.match(
    source,
    /\.map\(row => createTableOption\(row, valueColumn, labelColumn\)\)/,
    'loadOptions must attach metadata through the shared table option mapper'
);
assert.match(
    source,
    /return createTableOption\(data, valueColumn, labelColumn\)/,
    'loadOption must attach the same metadata as loadOptions'
);

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
assert.match(
    optionService,
    /current\?\.meta\?\.primaryKey \?\? \(valueColumn === 'id' \? 'id' : valueColumn\)/,
    'generic edits must use metadata primary key with a configured-column fallback'
);
assert.match(
    optionService,
    /current\?\.meta\?\.primaryValue \?\? current\?\.value/,
    'generic edits must use metadata primary value with the current option value fallback'
);
assert.match(
    optionService,
    /if \(row\[valueColumn\] == null \|\| row\[labelColumn\] == null\) \{\s*throw new Error\(/,
    'generic persistence must reject responses missing configured option columns'
);

const genericBlock = optionService.slice(
    optionService.indexOf('const { value_column: valueColumn'),
);
assert.doesNotMatch(
    genericBlock,
    /\bactive\s*:/,
    'generic table relations must not assume an active column'
);

console.log('model list option table-data mutation static checks passed');
