const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'utils/categorySelectTree.ts'), 'utf8');
const context = { exports: {}, Map, Set };
vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, context);
const { buildCategorySelectGroups } = context.exports;
const cat = (id, name, parent_id = null, sort_order = 0) => ({ id, name, parent_id, sort_order });
const plain = value => JSON.parse(JSON.stringify(value));

test('groups children under their real parent even when API returns children first', () => {
    const groups = plain(buildCategorySelectGroups([
        cat('child', 'Suportes', '3d'), cat('phone', 'Celulares'), cat('3d', '3D'),
        cat('grandchild', 'Antenas', 'child')
    ]));
    assert.deepEqual(groups.map(g => g.name), ['3D', 'Celulares']);
    assert.deepEqual(groups[0].options.map(o => [o.id, o.depth, o.path]), [
        ['3d', 0, '3D'], ['child', 1, '3D › Suportes'], ['grandchild', 2, '3D › Suportes › Antenas']
    ]);
});

test('preserves configured sibling order and uses Portuguese names as tie breaker', () => {
    const groups = buildCategorySelectGroups([
        cat('b', 'Zebra', null, 1), cat('a', 'Áudio', null, 1), cat('c', 'Primeiro', null, -1),
        cat('x', 'Zulu', 'a', 0), cat('y', 'Alfa', 'a', 2)
    ]);
    assert.deepEqual(plain(groups.map(g => g.id)), ['c', 'a', 'b']);
    assert.deepEqual(plain(groups[1].options.map(o => o.id)), ['a', 'x', 'y']);
});

test('missing parent, self-reference and cycles never hide categories or loop', () => {
    const input = [cat('orphan', 'Órfã', 'missing'), cat('self', 'Própria', 'self'),
        cat('a', 'A', 'b'), cat('b', 'B', 'a'), cat('kid', 'Filha', 'a')];
    const ids = plain(buildCategorySelectGroups(input).flatMap(g => g.options.map(o => o.id)));
    assert.equal(ids.length, input.length);
    assert.equal(new Set(ids).size, input.length);
    assert.deepEqual(ids.sort(), input.map(c => c.id).sort());
});

test('duplicate names remain separate selectable IDs and source records are not changed', () => {
    const input = [cat('a', 'Casa'), cat('b', '3D'), cat('x', 'Suportes', 'a'), cat('y', 'Suportes', 'b')];
    const before = JSON.stringify(input);
    const options = buildCategorySelectGroups(input).flatMap(g => g.options);
    assert.equal(options.find(o => o.id === 'x').path, 'Casa › Suportes');
    assert.equal(options.find(o => o.id === 'y').path, '3D › Suportes');
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(plain(buildCategorySelectGroups([])), []);
});

test('product selector renders grouped options without replacing category IDs', () => {
    const component = fs.readFileSync(path.join(root, 'components/products/CategorySelect.tsx'), 'utf8');
    assert.match(component, /buildCategorySelectGroups\(categories\)/);
    assert.match(component, /<optgroup[^>]*label=\{group\.name\}/);
    assert.match(component, /value=\{option\.id\}/);
    assert.match(component, /onChange\(e\.target\.value\)/);
    assert.match(component, /aria-label="Categoria do produto"/);
});
