// Opt-in projection at the data source: bot calls never load UI images/templates.
const BOT_FIELDS = Object.freeze([
  'company_name', 'name', 'address', 'address_zip_code', 'address_street',
  'address_number', 'address_complement', 'address_neighborhood', 'address_city',
  'address_state', 'address_lat', 'address_lng', 'business_hours',
  'holiday_overrides', 'local_holidays', 'pix_key', 'pix_beneficiary_name',
]);
function companySettingsReadSql(view) {
  return view === 'bot'
    ? `SELECT ${BOT_FIELDS.map(field => '`' + field + '`').join(', ')} FROM company_settings LIMIT 1`
    : 'SELECT * FROM company_settings LIMIT 1';
}
function selectBotCompanySettings(row) {
  if (!row) return null;
  return Object.fromEntries(BOT_FIELDS.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));
}
module.exports = { BOT_FIELDS, companySettingsReadSql, selectBotCompanySettings };
