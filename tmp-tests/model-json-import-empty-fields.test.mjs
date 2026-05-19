import assert from 'node:assert/strict';
import { normalizeModelImportPayload, parseModelImportJson } from '../components/settings/modelJsonImport.js';

const rawJson = `{
  "name": "Realme C85",
  "brand": "Realme",
  "category": "Smartphones",
  "template_values": {
    "battery_health": "100%",
    "celular_slot_para_cartao": null
  }
}`;

const normalized = normalizeModelImportPayload(parseModelImportJson(rawJson), {
  brands: [{ id: 'brand-realme', name: 'Realme' }],
  categories: [{ id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones' }],
  customFields: [
    { key: 'battery_health', label: 'Saude Bateria', field_type: 'select' },
    { key: 'celular_slot_para_cartao', label: 'Slot para cartao', field_type: 'select' },
  ],
  choiceOptions: {
    battery_health: [{ value: '100%', label: '100%' }],
    celular_slot_para_cartao: [
      { value: 'Sim', label: 'Sim' },
      { value: 'Nao', label: 'Nao' },
    ],
  },
});

assert.equal(normalized.templateValues.battery_health, '100%');
assert.equal(normalized.templateValues.celular_slot_para_cartao, undefined);
assert.deepEqual(normalized.emptyFields, [
  {
    fieldKey: 'celular_slot_para_cartao',
    fieldLabel: 'Slot para cartao',
    importance: 'required',
  },
]);

console.log('model json empty fields regression ok');
