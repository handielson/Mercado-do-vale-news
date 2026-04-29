import assert from 'node:assert/strict';
import { publicCompanySettingsService } from '../services/publicCompanySettings';

let fetchCount = 0;

(globalThis as any).fetch = async () => {
  fetchCount += 1;
  return {
    ok: true,
    json: async () => ({
      company_name: 'Mercado do Vale',
      name: 'Mercado do Vale',
      email: 'contato@mercadodovale.com.br',
    }),
  };
};

publicCompanySettingsService.clearCache();

const results = await Promise.all([
  publicCompanySettingsService.get(),
  publicCompanySettingsService.get(),
  publicCompanySettingsService.get(),
  publicCompanySettingsService.get(),
]);

assert.equal(fetchCount, 1, 'concurrent public company settings requests should share one fetch');
assert.equal(results.every(result => result?.company_name === 'Mercado do Vale'), true);

console.log('public company settings dedupe ok');
