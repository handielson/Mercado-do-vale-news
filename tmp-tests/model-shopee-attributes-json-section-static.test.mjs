import fs from 'node:fs';

const source = fs.readFileSync('components/settings/ModelModal.tsx', 'utf8');

const jsonSection = source.slice(
  source.indexOf('Campos tecnicos editaveis'),
  source.indexOf('Logistica editavel')
);

if (!jsonSection.includes('renderShopeeAttributeField')) {
  throw new Error('JSON / IA technical fields section must render editable Shopee attribute fields.');
}

if (!source.includes('handleShopeeAttributeDefaultFieldChange')) {
  throw new Error('ModelModal must update Shopee attribute defaults from individual inputs.');
}

if (!source.includes("shopee_attribute_labels")) {
  throw new Error('ModelModal must persist Shopee attribute labels for public display.');
}

if (!source.includes('shopee_attribute_required')) {
  throw new Error('ModelModal must persist required Shopee attribute metadata.');
}
