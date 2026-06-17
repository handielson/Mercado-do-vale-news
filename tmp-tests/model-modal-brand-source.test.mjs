import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const loadDataBody = source.match(/const loadData = async \(\) => \{([\s\S]*?)\n    \};/)?.[1] || '';

assert.match(
  loadDataBody,
  /brandService\.list\(/,
  'Model modal must load the full brand list used by ModelsPage, so legacy/inactive flag values do not hide every brand'
);

assert.match(
  loadDataBody,
  /brandService\.list\(\{\s*noCache:\s*true\s*\}\)/,
  'Model modal must bypass cached brand data so newly-created brands appear immediately when adding a model'
);

assert.doesNotMatch(
  loadDataBody,
  /brandService\.listActive\(\)/,
  'Model modal must not use listActive because legacy brand active flags can make the selector empty'
);

assert.match(
  loadDataBody,
  /Promise\.allSettled\(\[/,
  'Model modal must tolerate a partial failure when loading brands/categories/custom fields/tags'
);

assert.match(
  loadDataBody,
  /brandsResult\.status === 'fulfilled'[\s\S]*setBrands\(brandsResult\.value\)/,
  'Model modal must keep showing brands even if custom fields or cross-sell tags fail'
);

assert.match(
  loadDataBody,
  /customFieldsService\.clearCache\(\)[\s\S]*customFieldsService\.list\(\)/,
  'Model modal must force fresh custom_fields data so newly created category fields appear immediately'
);

assert.match(
  loadDataBody,
  /fieldsResult\.status === 'fulfilled'[\s\S]*setCustomFields\(fieldsResult\.value\)/,
  'Model modal must not drop category-configured custom fields such as Receptor serial before visibility rules run'
);

assert.match(
  source,
  /buildCategoryFallbackFields\(categoryConfig, customFields, templateValues\)/,
  'Model modal must rebuild template fields from category config and existing model values when custom_fields is empty or fails'
);

assert.match(
  source,
  /shouldCreateTemplateFieldFromCategoryConfig[\s\S]*value === 'off' \|\| value === 'hidden'/,
  'Category fallback fields must respect hidden category fields while preserving configured visible fields'
);

assert.doesNotMatch(
  source,
  /shouldCreateTemplateFieldFromCategoryConfig[\s\S]*UNIQUE_FIELDS\.includes\(key\)/,
  'Category fallback fields must not hide visible category fields solely because their key is globally unique'
);

assert.match(
  source,
  /templateFields = \[[\s\S]*\.\.\.customFields,[\s\S]*\.\.\.buildCategoryFallbackFields\(categoryConfig, customFields, templateValues\)/,
  'Visible template fields must combine database fields with category-config fallback fields'
);

assert.match(
  source,
  /if \(requirement === undefined \|\| requirement === null\) return false/,
  'Selected category templates must hide global fields that are not configured for that category'
);

assert.match(
  source,
  /CATEGORY_FIELD_FALLBACKS[\s\S]*battery_health[\s\S]*table_name: 'battery_healths'/,
  'Fallback model fields must preserve battery health as a table relation instead of showing raw UUIDs'
);

assert.match(
  source,
  /CATEGORY_FIELD_FALLBACKS[\s\S]*irda[\s\S]*field_type: 'select'[\s\S]*options: \['Sim', 'N(?:Ã£|ã)o', 'Consulte'\]/,
  'Fallback model fields must render IrDA as a select instead of a plain text input'
);

function assertFallbackFieldType(key, fieldType) {
  const fallbackBlock = source.match(new RegExp(`${key}: \\{([\\s\\S]*?)\\n    \\}`))?.[1] || '';
  assert.match(
    fallbackBlock,
    new RegExp(`field_type: '${fieldType}'`),
    `Fallback model field ${key} must render as ${fieldType} instead of plain text`
  );
}

for (const key of ['iks', 'sks', 'irda', 'nfc', 'entrada_fone_de_ouvido', 'celular_slot_para_cartao']) {
  assertFallbackFieldType(key, 'select');
}

for (const key of ['battery_mah', 'display', 'cam_principal_mpx', 'cam_selfie_mpx', 'celular_fps_display', 'antutu', 'peso_g']) {
  assertFallbackFieldType(key, 'number');
}

assert.match(
  source,
  /Object\.keys\(templateValues \|\| \{\}\)\.map/,
  'Fallback model fields must include keys already saved on the model, such as memoria_ram_virtual'
);

assert.match(
  source,
  /hasCanonicalVersionField[\s\S]*normalizeFieldAlias\(field\.key\) === 'versao'[\s\S]*normalizeFieldAlias\(field\.label\) === 'versao'/,
  'Model modal must detect the canonical versao field before hiding duplicated version fields'
);

assert.match(
  source,
  /isDuplicateTemplateField[\s\S]*fieldKey === 'version' \|\| fieldLabel === 'version'/,
  'Model modal must treat Version (version) as a duplicate when Versao (versao) exists'
);

assert.match(
  source,
  /visibleSpecFields[\s\S]*\.filter\(field => !isDuplicateTemplateField\(field\)\)/,
  'Visible model template fields must hide duplicated version fields'
);

assert.match(
  source,
  /hiddenSpecFields[\s\S]*isDuplicateTemplateField\(field\)/,
  'Duplicated version fields must be sanitized with other hidden spec fields before save/import'
);

assert.match(
  source,
  /const formatModelNameTitleCase = \(value: string\) => value\.replace/,
  'Model modal must have a dedicated title-case formatter for model names'
);

assert.match(
  source,
  /formatModelNameToken[\s\S]*\^\\d\+\[a-z\]\+\$/i,
  'Model name formatter must uppercase technical tokens like 5G and 128GB instead of leaving them as 5g/128gb'
);

assert.match(
  source,
  /const formatted = formatModelNameTitleCase\(rawValue\);[\s\S]*setName\(formatted\)/,
  'Typing in the model name field must immediately title-case every word'
);

assert.match(
  source,
  /name: formatModelNameTitleCase\(name\)\.trim\(\)/,
  'Saving a model must persist the title-cased model name'
);

assert.match(
  source,
  /setName\(formatModelNameTitleCase\(normalized\.name\)\)/,
  'Applying JSON must title-case the imported model name'
);

console.log('model-modal-brand-source regression passed');
