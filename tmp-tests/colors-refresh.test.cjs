const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(get) {
    const context = { exports: {}, Date, console, require: name => {
        if (name === './vpsClient') return { vpsClient: { get } };
        if (name === './companyContext') return { getCompanyId: async () => 'company' };
        if (name === '../utils/colorAppearance.mjs') return require(name);
        throw new Error(name);
    }};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/colors.ts','utf8'), {
        compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
    }).outputText,context);
    return context.exports.colorService;
}
const row = name => ({id:name,name,active:true,company_id:'company'});
test('atualização força nova consulta e inclui a cor cadastrada em outra aba', async () => {
    let calls = 0;
    let rows = [row('Branco')];
    const service = fixture(async () => { calls++; return rows; });
    await service.listActive();
    rows = [row('Branco'),row('Translúcido')];
    assert.equal((await service.listActive()).length,1);
    assert.equal(calls,1);
    assert.equal((await service.refreshActive()).length,2);
    assert.equal(calls,2);
    assert.ok((await service.listActive()).some(color=>color.name==='Translúcido'));
    assert.equal(calls,2);
});
test('consulta antiga em andamento não sobrescreve o cache da atualização', async () => {
    let resolveOld;
    let calls=0;
    const service=fixture(async () => {
        calls++;
        if(calls===1) return new Promise(resolve=>{resolveOld=resolve;});
        return [row('Branco'),row('Translúcido')];
    });
    const old = service.listActive();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await service.refreshActive()).length,2);
    resolveOld([row('Branco')]);
    await old;
    assert.equal((await service.listActive()).length,2);
    assert.equal(calls,2);
});
test('falha de atualização não vira lista vazia nem bloqueia nova tentativa',async()=>{
    let fails=true;
    const service=fixture(async()=>{if(fails)throw Error('offline');return [row('Translúcido')];});
    await assert.rejects(service.refreshActive(),/offline/);
    fails=false;
    assert.equal((await service.refreshActive())[0].name,'Translúcido');
    const ui=fs.readFileSync('components/products/selectors/ColorSelect.tsx','utf8');
    assert.match(ui,/onClick=\{\(\) => void loadColors\(true\)\}/);
    assert.match(ui,/forceRefresh \? colorService.refreshActive\(\)/);
    assert.match(ui,/role="alert"/);
});
