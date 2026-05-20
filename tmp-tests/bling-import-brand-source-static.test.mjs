import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('services/blingService.ts', 'utf8');

assert(
  /resolveSupabaseBrandForModel/.test(service),
  'Bling auto model import should resolve brands directly in Supabase for models.brand_id'
);

assert(
  !/brandService\.create\(\{ name: brandName/.test(service),
  'Bling auto model import must not use VPS brandService.create() as the source for models.brand_id'
);

assert(
  /from\('brands'\)/.test(service) &&
    /\.eq\('company_id', companyId\)/.test(service) &&
    /const payload = \{[\s\S]*company_id: companyId/.test(service) &&
    /\.insert\(payload\)/.test(service),
  'Supabase brand resolver should find/create a brand in the same company before creating a model'
);

assert(
  /vpsApiService\.syncBrand/.test(service),
  'New Supabase brands created for import should still be synced to the VPS'
);

assert(
  !/select\('[^']*logo_url/.test(service),
  'Bling import brand resolver must not select brands.logo_url because the production Supabase table does not have that column'
);

console.log('bling import brand source static checks ok');
