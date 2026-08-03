import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, panel, service, server, migration] = await Promise.all([
  readFile(new URL('../pages/admin/settings/MarketingPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../pages/admin/settings/marketing/FacebookMarketplaceSchedulerPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../services/facebookMarketplaceScheduleService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../migrations/008_facebook_marketplace_schedule.sql', import.meta.url), 'utf8'),
]);

assert.match(page, /<FacebookMarketplaceSchedulerPanel/);
assert.match(panel, /facebook\.com\/marketplace\/create\/item/);
assert.match(panel, /localStorage\.setItem\('facebook_marketplace_groups'/);
assert.match(panel, /status: 'published'/);
assert.match(service, /\/table-data\/facebook_marketplace_schedule/);
assert.match(server, /CREATE TABLE IF NOT EXISTS facebook_marketplace_schedule/);
assert.match(server, /maybeSendFacebookMarketplaceRemindersVps/);
assert.match(server, /SET status = 'ready', reminder_sent_at = \?/);
assert.match(migration, /idx_facebook_marketplace_due \(status, scheduled_for\)/);

console.log('facebook-marketplace-scheduler static checks: OK');
