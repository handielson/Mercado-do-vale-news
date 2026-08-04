import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/MarketingPage.tsx', 'utf8');

assert.match(page, /useState<'studio' \| 'instagram' \| 'facebook' \| 'whatsapp' \| 'campaigns' \| 'approvals'>\(\(\) =>/);
assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\('tab'\)/);
assert.match(page, /setActiveTab\('instagram'\)/);
assert.match(page, /setActiveTab\('facebook'\)/);
assert.match(page, /setActiveTab\('whatsapp'\)/);
assert.match(page, /setActiveTab\('approvals'\)/);
assert.match(page, /setActiveTab\('campaigns'\)/);
assert.match(page, /activeTab === 'instagram'/);
assert.match(page, /activeTab === 'facebook'[\s\S]*?<FacebookMarketplaceSchedulerPanel/);
assert.match(page, /activeTab === 'whatsapp'[\s\S]*?<WhatsAppStatusCampaignPanel/);
assert.match(page, /activeTab === 'approvals'[\s\S]*?<MarketingApprovalCenterPanel/);
assert.match(page, /activeTab === 'campaigns'[\s\S]*?<MarketingCampaignAgentPanel/);
assert.doesNotMatch(page, /activeTab === 'agenda'|setActiveTab\('agenda'\)/);
assert.match(page, />Central de Conteúdo</);

console.log('marketing channel tabs are separated: OK');
