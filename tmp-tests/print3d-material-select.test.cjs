const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ value = '', loadFails = false, saveFails = false, duplicate = false } = {}) {
    const states = [], effects = [], dependencies = [], changes = [], calls = [];
    let cursor = 0;
    const jsx = (type, props) => ({ type, props });
    const react = {
        useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial;
            return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
        useId() { cursor++; return 'material-test'; },
        useRef(initial) { const index = cursor++; states[index] ??= { current: initial }; return states[index]; },
        useEffect(callback, deps) { const index = cursor++;
            if (!dependencies[index] || deps.some((dep, i) => dep !== dependencies[index][i])) {
                dependencies[index] = deps; effects.push(callback);
            }
        },
    };
    const service = {
        async list() { calls.push('list'); if (loadFails) throw new Error('offline'); return ['PLA', 'PETG']; },
        async create(name) { calls.push(['create', name]); if (saveFails) throw new Error('offline');
            return { name: duplicate ? 'PLA' : name.trim(), created: !duplicate, materials: ['PLA', 'PETG', ...(duplicate ? [] : [name.trim()])] }; },
    };
    const context = { exports: {}, require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'lucide-react') return { Plus: 'plus', X: 'x', RefreshCw: 'refresh' };
        if (name.endsWith('/print3dMaterials')) return { print3dMaterialsService: service };
        throw new Error(name);
    } };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/products/selectors/MaterialSelect.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
    }).outputText, context);
    const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    const render = () => { cursor = 0; return nodes(context.exports.MaterialSelect({ value, onChange: next => { changes.push(next); value = next; } })); };
    const flush = async () => { while (effects.length) effects.shift()(); await new Promise(resolve => setImmediate(resolve)); };
    const find = predicate => render().find(predicate);
    const button = label => find(n => n.type === 'button' && (n.props['aria-label'] === label || n.props.children === label));
    const input = () => find(n => n.type === 'input');
    const enterName = name => input().props.onChange({ target: { value: name } });
    return { render, flush, find, button, input, enterName, changes, calls };
}

test('known materials are selectable, existing free text remains unchanged and no nested form exists', async () => {
    const f = fixture({ value: 'Material antigo' }); f.render(); await f.flush();
    const tree = f.render();
    assert.equal(tree.find(n => n.type === 'select').props.value, 'Material antigo');
    assert.ok(tree.some(n => n.type === 'option' && n.props.value === 'Material antigo'));
    assert.ok(tree.some(n => n.type === 'option' && n.props.value === 'PLA'));
    assert.ok(!tree.some(n => n.type === 'form'));
    assert.equal(f.changes.length, 0);
    tree.find(n => n.type === 'select').props.onChange({ target: { value: 'PETG' } });
    assert.deepEqual(f.changes, ['PETG']);
    assert.deepEqual(f.calls, ['list']);
});

test('inline creation selects persisted canonical name and duplicate reports reuse', async () => {
    for (const duplicate of [false, true]) {
        const f = fixture({ duplicate }); f.render(); await f.flush();
        f.button('Novo material').props.onClick(); f.enterName(duplicate ? 'pla' : 'Novo material');
        f.button('Cadastrar e selecionar').props.onClick(); await f.flush();
        assert.deepEqual(f.changes, [duplicate ? 'PLA' : 'Novo material']);
        assert.ok(f.find(n => n.props?.role === 'status'));
    }
});

test('load failure exposes retry and does not enable adding blind; save failure preserves product value', async () => {
    const failedLoad = fixture({ loadFails: true }); failedLoad.render(); await failedLoad.flush();
    assert.ok(failedLoad.find(n => n.props?.role === 'alert'));
    assert.equal(failedLoad.button('Novo material').props.disabled, true);
    assert.equal(failedLoad.button('Atualizar materiais').props.disabled, false);
    const failedSave = fixture({ value: 'PETG', saveFails: true }); failedSave.render(); await failedSave.flush();
    failedSave.button('Novo material').props.onClick(); failedSave.enterName('Material novo');
    failedSave.button('Cadastrar e selecionar').props.onClick(); await failedSave.flush();
    assert.equal(failedSave.find(n => n.type === 'select').props.value, 'PETG');
    assert.deepEqual(failedSave.changes, []);
    assert.ok(failedSave.find(n => n.props?.role === 'alert'));
});

test('Enter creates only the material and prevents submitting the surrounding product form', async () => {
    const f = fixture(); f.render(); await f.flush();
    f.button('Novo material').props.onClick(); f.enterName('Teste');
    let prevented = false;
    f.input().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } });
    await f.flush();
    assert.equal(prevented, true);
    assert.deepEqual(f.changes, ['Teste']);
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'create').length, 1);
});
