import assert from 'node:assert/strict';

import {
  sanitizePublicCompanySettings,
  publicCompanySettingsToCompany,
} from '../services/publicCompanySettings.ts';

const publicSettings = sanitizePublicCompanySettings({
  id: 'company-1',
  company_name: 'Mercado do Vale',
  name: 'Mercado do Vale Oficial',
  logo: 'https://cdn.example/logo.png',
  phone: '(87) 99999-9999',
  email: 'contato@example.com',
  cnpj: '12.345.678/0001-90',
  address_street: 'Rua A',
  address_number: '123',
  address_neighborhood: 'Centro',
  address_city: 'Petrolina',
  address_state: 'PE',
  address_zip_code: '56300-000',
  social_instagram: '@mercadodovale',
  google_analytics_id: 'G-TEST123',
  business_hours: JSON.stringify({
    monday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
  }),
  holiday_overrides: JSON.stringify(['2026-05-01']),
  local_holidays: JSON.stringify([{ date: '2026-06-24', label: 'Sao Joao' }]),
  extended_warranty_options: JSON.stringify([{ months: 12, percentage: 10, active: true }]),
  extended_warranty_terms_text: '<p>Termos publicos</p>',
  pix_discount_percentage: '5',
  catalog_footer_text: 'Rodape publico',
  about_us_text: 'Historia publica',
  about_us_image_url: 'https://cdn.example/about.jpg',
  maintenance_mode: true,
  maintenance_message: 'Estamos ajustando a loja.',
  maintenance_bypass_hash: 'hash-publico',
  synology_video_base_url: 'https://mdvvideos.example/videos',
  synology_video_extension: '.mp4',
  pix_key: 'secret-pix',
  pix_beneficiary_name: 'secret-name',
  bank_name: 'secret-bank',
  bank_agency: 'secret-agency',
  bank_account: 'secret-account',
  internal_notes: 'secret-notes',
  maintenance_bypass_key: 'secret-admin',
  shopee_partner_id: 'secret-partner',
  shopee_partner_key: 'secret-key',
  shopee_shop_id: 'secret-shop',
  shopee_access_token: 'secret-access',
  shopee_refresh_token: 'secret-refresh',
});

assert.equal(publicSettings.company_name, 'Mercado do Vale');
assert.equal(publicSettings.phone, '(87) 99999-9999');
assert.equal(publicSettings.address, 'Rua A, 123 - Centro - Petrolina - PE - CEP: 56300-000');
assert.equal(publicSettings.business_hours?.monday?.openTime, '08:00');
assert.deepEqual(publicSettings.holiday_overrides, ['2026-05-01']);
assert.equal(publicSettings.extended_warranty_options?.[0]?.months, 12);
assert.equal(publicSettings.pix_discount_percentage, 5);
assert.equal(publicSettings.google_analytics_id, 'G-TEST123');
assert.equal(publicSettings.maintenance_bypass_hash, 'hash-publico');

for (const sensitiveKey of [
  'pix_key',
  'pix_beneficiary_name',
  'bank_name',
  'bank_agency',
  'bank_account',
  'internal_notes',
  'maintenance_bypass_key',
  'shopee_partner_id',
  'shopee_partner_key',
  'shopee_shop_id',
  'shopee_access_token',
  'shopee_refresh_token',
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(publicSettings, sensitiveKey),
    false,
    `${sensitiveKey} must not be exposed publicly`,
  );
}

const company = publicCompanySettingsToCompany(publicSettings);

assert.equal(company.name, 'Mercado do Vale Oficial');
assert.equal(company.phone, '(87) 99999-9999');
assert.equal(company.address.street, 'Rua A');
assert.equal(company.address.city, 'Petrolina');
assert.equal(company.catalogFooterText, 'Rodape publico');
assert.equal(company.googleAnalyticsId, 'G-TEST123');
assert.equal(company.maintenanceMode, true);
assert.equal(company.maintenanceBypassKey, '');
assert.equal(company.shopee_partner_key, '');
assert.equal(company.pixKey, '');
assert.equal(company.bankAccount, '');

console.log('public company settings sanitizer ok');
