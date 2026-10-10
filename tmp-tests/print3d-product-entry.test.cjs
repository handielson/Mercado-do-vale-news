const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the rendered entry's handlers with a read-only API fixture.
function fixture(matches = []) {
    const values = [], navigations = [], queries = [];
    let cursor = 0;
    const jsx = (type, props) => ({ type, props });
    const hooks = {
        useRef: () => ({ current: null }), useEffect: () => {},
        useState: initial => {
            const index = cursor++;
            if (!(index in values)) values[index] = initial;
            return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
        },
    };
    const imports = {
        react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
        'react-router-dom': { useNavigate: () => target => navigations.push(target) },
        'lucide-react': { Plus: 'plus', Printer: 'printer', X: 'x' },
        '../../services/vpsApiService': { vpsApiService: {
            getProducts: async query => { queries.push(query); if (matches instanceof Error) throw matches; return matches; },
        } },
    };
    const context = { exports: {}, URLSearchParams, require: name => {
        assert.ok(name in imports, `Unexpected dependency: ${name}`);
        return imports[name];
    } };
    const source = fs.readFileSync('components/products/Print3dProductEntry.tsx', 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, context);
    return { navigations, queries, render: () => { cursor = 0; return context.exports.Print3dProductEntry(); } };
}
function nodes(tree) {
    if (!tree || typeof tree !== 'object') return [];
    const children = tree.props?.children;
    return [tree, ...(Array.isArray(children) ? children : [children]).flatMap(nodes)];
}
function text(tree) {
    if (typeof tree === 'string') return tree;
    if (!tree) return '';
    const children = tree.props?.children;
    return (Array.isArray(children) ? children : [children]).map(text).join('');
}
async function search(f, sku) {
    nodes(f.render()).find(node => node.type === 'input').props.onChange({ target: { value: sku } });
    nodes(f.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
}
test('new 3D product uses the central new-product route without API writes', () => {
    const f = fixture();
    const button = nodes(f.render()).find(node => node.type === 'button' && text(node).includes('Cadastrar novo produto 3D'));
    button.props.onClick();
    assert.deepEqual(f.navigations, ['/admin/products/new?print3d=1']);
    assert.equal(f.queries.length, 0);
});
test('existing SKU selects only the exact product, including inactive products', async () => {
    const f = fixture([{ id: 'wrong', sku: 'SFKU3XMVB-2' }, { id: 'existing-id', sku: 'SFKU3XMVB' }]);
    await search(f, '  sfku3xmvb  ');
    assert.equal(f.queries[0].sku, 'sfku3xmvb');
    assert.equal(f.queries[0].status, 'all');
    assert.deepEqual(f.navigations, ['/admin/products/existing-id?print3d=1']);
});
test('partial SKU cannot open the wrong product', async () => {
    const f = fixture([{ id: 'wrong', sku: 'SFKU3XMVB-2' }]);
    await search(f, 'SFKU3XMVB');
    assert.equal(f.navigations.length, 0);
    assert.match(text(nodes(f.render()).find(node => node.props?.role === 'alert')), /SKU não encontrado/);
});
test('API failure stays in the chooser and shows an error', async () => {
    const f = fixture(new Error('API indisponível'));
    await search(f, 'SFKU3XMVB');
    assert.equal(f.navigations.length, 0);
    assert.ok(nodes(f.render()).find(node => node.props?.role === 'alert'));
});
test('empty SKU never queries the API', async () => {
    const f = fixture();
    await search(f, '   ');
    assert.equal(f.queries.length, 0);
});
test('entry links reach pages that prefill 3D without replacing the SKU', () => {
    // Wiring guard: update these consumers if the canonical routes move.
    const routes = fs.readFileSync('routes/index.tsx', 'utf8');
    const detail = fs.readFileSync('pages/admin/products/ProductDetailPage.tsx', 'utf8');
    const create = fs.readFileSync('pages/admin/products/ProductFormPage.tsx', 'utf8');
    const form = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');
    const list = fs.readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
    assert.match(routes, /path: "\/admin\/products\/:id\/:slug\?"/);
    assert.match(list, /<Print3dProductEntry\s*\/>/);
    assert.match(detail, /get\('print3d'\) === '1'/);
    assert.match(detail, /\{ \.\.\.product, is_print3d: true \}/);
    assert.match(detail, /print3dEntry && savedProduct.is_print3d && !Number\(savedProduct.is_parent\)/);
    assert.match(create, /defaultIsPrint3d=\{print3dEntry\}/);
    assert.match(form, /is_print3d: defaultIsPrint3d/);
});
