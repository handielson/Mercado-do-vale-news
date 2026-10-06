import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/MarketingPage.tsx', 'utf8');
const workspace = readFileSync('pages/admin/settings/marketing/MarketingWorkspace.tsx', 'utf8');
const { MARKETING_SECTIONS, resolveMarketingTab } = await import('../pages/admin/settings/marketing/marketingNavigation.ts');

assert.equal(resolveMarketingTab(null), 'overview');
assert.equal(resolveMarketingTab('invalid'), 'overview');
for (const tab of ['studio', 'instagram', 'facebook', 'whatsapp', 'campaigns', 'approvals', 'calendar', 'tables']) assert.equal(resolveMarketingTab(tab), tab);
assert.equal(new Set(MARKETING_SECTIONS.map(section => section.id)).size, MARKETING_SECTIONS.length);
assert.deepEqual(MARKETING_SECTIONS.filter(section => section.group === 'Criar').map(section => section.id), ['studio', 'tables']);
assert.match(page, /resolveMarketingTab\(searchParams.get\('tab'\)\)/);
assert.match(page, /useSearchParams\(\)/);
assert.match(page, /next.set\('tab', tab\)/);
assert.match(page, /setActiveTab\('instagram'\)/);
assert.match(workspace, /onNavigate\(section.id\)/);
assert.match(workspace, /aria-current=/);
assert.match(workspace, /<optgroup/);
assert.match(page, /activeTab === 'instagram'/);
assert.match(page, /activeTab === 'facebook'[\s\S]*?<FacebookMarketplaceSchedulerPanel/);
assert.match(page, /activeTab === 'whatsapp'[\s\S]*?<WhatsAppStatusCampaignPanel/);
assert.match(page, /activeTab === 'approvals'[\s\S]*?<MarketingApprovalCenterPanel/);
assert.match(page, /activeTab === 'campaigns'[\s\S]*?<MarketingCampaignAgentPanel/);
assert.doesNotMatch(page, /activeTab === 'agenda'|setActiveTab\('agenda'\)/);
assert.match(page, /activeTab === 'tables'.*purpose="tables"/);
assert.match(page, /instagramSchedulerView === 'stories'.*<SocialStorySchedulerPanel/);
assert.match(page, /useState<MarketingAssetFormat>\('status'\)/);
assert.match(page, /Crie sua arte em 3 passos/);
assert.match(page, /Busque o aparelho/);

console.log('marketing channel tabs are separated: OK');
