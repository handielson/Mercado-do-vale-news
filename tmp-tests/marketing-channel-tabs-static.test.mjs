import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/MarketingPage.tsx', 'utf8');

assert.match(page, /useState<'studio' \| 'instagram' \| 'facebook' \| 'whatsapp'>\('studio'\)/);
assert.match(page, /setActiveTab\('instagram'\)/);
assert.match(page, /setActiveTab\('facebook'\)/);
assert.match(page, /setActiveTab\('whatsapp'\)/);
assert.match(page, /activeTab === 'instagram'/);
assert.match(page, /activeTab === 'facebook'[\s\S]*?<FacebookMarketplaceSchedulerPanel/);
assert.match(page, /activeTab === 'whatsapp'[\s\S]*?<WhatsAppStatusCampaignPanel/);
assert.doesNotMatch(page, /activeTab === 'agenda'|setActiveTab\('agenda'\)/);
assert.match(page, />Central de Conteúdo</);

console.log('marketing channel tabs are separated: OK');
