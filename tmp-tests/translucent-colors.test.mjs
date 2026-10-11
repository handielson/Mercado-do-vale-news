import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as appearance from '../utils/colorAppearance.mjs';
import { filamentColorStyle, groupFilamentStock } from '../utils/print3dFilamentInventory.mjs';
import { createRequire } from 'node:module';
const { upsertFilament } = createRequire(import.meta.url)('../services/print3dFilaments.cjs');

test('paleta oferece nomes distintos e RGB compatível com o cadastro atual, com ou sem acento', () => {
  assert.equal(appearance.TRANSLUCENT_COLOR_PALETTE.length, 13);
  assert.equal(new Set(appearance.TRANSLUCENT_COLOR_PALETTE.map(c => c.name)).size, 13);
  for (const c of appearance.TRANSLUCENT_COLOR_PALETTE) {
    assert.match(c.hex, /^#[0-9A-F]{6}$/);
    assert(appearance.isTranslucentColor(c.name));
  }
  assert.equal(appearance.translucentPresetHex(' AZUL translucido '), '#3B82F6');
  assert.equal(appearance.translucentPresetHex('Azul'), undefined);
  assert.equal(appearance.translucentPresetHex('Azul Marinho Translúcido'), undefined);
  assert.equal(appearance.isTranslucentColor('Dourado Translucido'), true);
  assert.equal(appearance.isTranslucentColor('Azul translúcida'), true);
  assert.equal(appearance.isTranslucentColor('Azul'), false);
});

test('amostra translúcida usa RGB cadastrado com quadriculado, sem alterar cor opaca ou degradê', () => {
  assert.deepEqual(appearance.colorSampleStyle('Azul', '#123456'), {backgroundColor:'#123456'});
  const style = appearance.colorSampleStyle('Azul Translúcido', '#123456');
  assert.match(style.backgroundImage, /#1234568c/);
  assert.match(style.backgroundImage, /conic-gradient/);
  assert.equal(style.backgroundSize, '100% 100%, 8px 8px');
  assert.match(appearance.colorSampleStyle('Preto Translúcido', '#000').backgroundImage, /#0000008c/);
  const resolve = n => n === 'Azul Translúcido' ? '#123456' : '#ff0000';
  assert.deepEqual(filamentColorStyle('Azul Translúcido', undefined, resolve), style);
  assert.match(filamentColorStyle('Degradê', ['Azul Translúcido','Vermelho'],resolve).backgroundImage, /90deg, #1234568c, #ff0000/);
  assert.deepEqual(filamentColorStyle('Degradê', ['Azul','Vermelho'],resolve), {background:'linear-gradient(90deg, #ff0000, #ff0000)'});
  for (const hex of [undefined,'', 'url(bad)', '#GGGGGG', '#123456; color:red']) assert.equal(appearance.colorSampleStyle('Azul Translúcido', hex), undefined);
});

test('cadastro/API e estoque mantêm azul sólido e translúcido separados e recusam cor não cadastrada', () => {
  const refs = {brands:['Marca'], materials:['PETG'], colors:['Azul','Azul Translúcido']};
  const solid = {id:'solid', brand:'Marca',material:'PETG',color:'Azul',costPerKgCents:6000};
  let items = upsertFilament([], solid, refs);
  items = upsertFilament(items, {...solid,id:'translucent',color:'azul translúcido'}, refs);
  assert.equal(items[1].color,'Azul Translúcido');
  assert.throws(() => upsertFilament([], {...solid,color:'Verde Translúcido'}, refs), {statusCode:400});
  const groups = groupFilamentStock(items,{enabled:true,balances:[{filament_id:'solid',quantity_grams:1000},{filament_id:'translucent',quantity_grams:2000}]});
  assert.equal(groups.length,2);
  assert.equal(groups.find(g => g.color === 'Azul').quantity_grams,1000);
  assert.equal(groups.find(g => g.color === 'Azul Translúcido').quantity_grams,2000);
});

test('serviço persiste pela tabela compartilhada com RGB de 6 dígitos e preserva tom personalizado', async () => {
  const writes = [];
  const context = {exports:{}, Date, console, require: name => {
    if (name === '../utils/colorAppearance.mjs') return appearance;
    if (name === './companyContext') return {getCompanyId:async () => 'company'};
    if (name === './vpsClient') return {vpsClient:{post:async (path,body) => {writes.push({path,body});return {id:'new',...body};}}};
    throw Error(name);
  }};
  runInNewContext(ts.transpileModule(readFileSync('services/colors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const service = context.exports.colorService;
  const preset = await service.create({name:'Azul Translúcido'});
  assert.equal(preset.hex_code,'#3B82F6');
  assert.equal(preset.slug,'azul-translucido');
  const custom = await service.create({name:'Azul Translúcido', hex_code:'#123456'});
  assert.equal(custom.hex_code,'#123456');
  assert.equal(writes[0].path, '/table-data/colors');
  assert.equal(writes[0].body.company_id,'company');
  assert.deepEqual(Object.keys(writes[0].body).sort(),['active','company_id','hex_code','name','slug']);
});

test('sugestões não criam registros automaticamente nem substituem listas canônicas', () => {
  const modal = readFileSync('components/settings/ColorModal.tsx','utf8');
  assert.match(modal, /\.\.\.TRANSLUCENT_COLOR_PALETTE/);
  assert.match(modal, />Translúcidas<\/button>/);
  assert.match(modal, /selecione e cadastre para disponibilizar no sistema/);
  assert.match(modal, /colorSampleStyle\(c.name, c.hex\)/);
  const ui = readFileSync('components/print3d/FilamentCatalog.tsx','utf8');
  assert.match(ui, /catalog.references.colors/);
  assert.doesNotMatch(ui, /TRANSLUCENT_COLOR_PALETTE/);
  const selector = readFileSync('components/products/selectors/ColorSelect.tsx','utf8');
  assert.match(selector, /colors.find\(color => color.name === colorName\)\?\.hex_code/);
});
