const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {}

const APPLY = process.argv.includes('--apply');
const FIELD_KEY = 'memoria_ram_virtual';
const DEFAULT_VALUE = '';
const CATEGORY_NAMES = new Set(['smartphones', 'celulares']);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env. Expected VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function selectAll(table, select, extra = (query) => query) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const query = extra(supabase.from(table).select(select).range(from, to));
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function main() {
  const categories = await selectAll('categories', 'id, name');
  const smartphoneCategories = categories.filter((category) => CATEGORY_NAMES.has(String(category.name || '').trim().toLowerCase()));
  const smartphoneCategoryIds = new Set(smartphoneCategories.map((category) => String(category.id)));

  if (smartphoneCategoryIds.size === 0) {
    throw new Error('No Smartphone/Celular categories found.');
  }

  const models = await selectAll(
    'models',
    'id, name, category_id, template_values',
    (query) => query.in('category_id', Array.from(smartphoneCategoryIds)).order('name', { ascending: true })
  );

  const missingField = models.filter((model) => {
    const templateValues = model.template_values && typeof model.template_values === 'object'
      ? model.template_values
      : {};
    return !Object.prototype.hasOwnProperty.call(templateValues, FIELD_KEY);
  });

  const alreadyPresent = models.length - missingField.length;
  const updated = [];
  const failed = [];

  if (APPLY) {
    for (const model of missingField) {
      const templateValues = model.template_values && typeof model.template_values === 'object'
        ? model.template_values
        : {};
      const nextTemplateValues = {
        ...templateValues,
        [FIELD_KEY]: DEFAULT_VALUE,
      };

      const { error } = await supabase
        .from('models')
        .update({ template_values: nextTemplateValues })
        .eq('id', model.id);

      if (error) {
        failed.push({ id: model.id, name: model.name, error: error.message });
      } else {
        updated.push({ id: model.id, name: model.name });
      }
    }
  }

  const result = {
    ok: failed.length === 0,
    mode: APPLY ? 'apply' : 'dry-run',
    field: FIELD_KEY,
    defaultValue: DEFAULT_VALUE,
    categories: smartphoneCategories.map((category) => ({ id: category.id, name: category.name })),
    totalModels: models.length,
    alreadyPresent,
    missing: missingField.length,
    updated: updated.length,
    failed,
    sampleMissing: missingField.slice(0, 20).map((model) => ({ id: model.id, name: model.name })),
  };

  console.log(JSON.stringify(result, null, 2));

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
