import test from 'node:test';
import assert from 'node:assert/strict';
import { getShopeeAnatelAttributeState } from '../pages/admin/settings/shopeeAttributeResolver.js';

const attributes = [
    {
        attribute_id: 801,
        label: 'Contém Bluetooth, Wi-Fi ou tecnologia de radiofrequência (RF)?',
        attribute_value_list: [
            { value_id: 11, label: 'Sim', original_value_name: 'Yes' },
            { value_id: 12, label: 'Não', original_value_name: 'No' },
        ],
    },
    { attribute_id: 802, label: 'Número de licença Anatel', attribute_value_list: [] },
];

test('exige decisão explícita e licença para produto com RF', () => {
    assert.match(getShopeeAnatelAttributeState(attributes, {}).errors[0], /Selecione Sim ou Não/);
    assert.match(getShopeeAnatelAttributeState(attributes, { 801: 'Yes' }).errors[0], /Número de licença Anatel/);
    assert.deepEqual(getShopeeAnatelAttributeState(attributes, { 801: '11', 802: '123456789' }).errors, []);
});

test('não envia licença antiga quando o operador declara ausência de RF', () => {
    const state = getShopeeAnatelAttributeState(attributes, { 801: 'No', 802: 'licença antiga' });
    assert.deepEqual(state.errors, []);
    assert.equal(state.licenseAttributeId, 802);
    assert.equal(state.omitLicense, true);
});

test('bloqueia Sim se a categoria não trouxe o campo filho e ignora categorias sem o atributo', () => {
    assert.match(getShopeeAnatelAttributeState(attributes.slice(0, 1), { 801: 'Yes' }).errors[0], /não retornou/);
    assert.deepEqual(getShopeeAnatelAttributeState([{ attribute_id: 900, label: 'Cor' }], {}).errors, []);
});

test('reconhece a resposta bruta multilíngue usada na edição de anúncios', () => {
    const raw = [
        { attribute_id: 801, name: 'Contains Bluetooth, Wi-Fi or radio frequency (RF) technology?',
            multi_lang: [{ language: 'pt-BR', value: 'Contém Bluetooth, Wi-Fi ou tecnologia de radiofrequência (RF)?' }],
            attribute_value_list: [{ value_id: 11, name: 'Yes' }, { value_id: 12, name: 'No' }] },
        { attribute_id: 802, name: 'Anatel License Number',
            multi_lang: [{ language: 'pt-BR', value: 'Número de licença Anatel' }] },
    ];
    assert.match(getShopeeAnatelAttributeState(raw, { 801: 'Yes' }).errors[0], /Número de licença Anatel/);
    assert.deepEqual(getShopeeAnatelAttributeState(raw, { 801: 'No' }).errors, []);
});
