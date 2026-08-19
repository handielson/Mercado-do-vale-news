import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const api = await readFile(new URL('../services/marketingCampaignApi.cjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const serverJs = await readFile(new URL('../vps_server.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../pages/admin/settings/marketing/SocialStorySchedulerPanel.tsx', import.meta.url), 'utf8');

test('Story scheduling requires approval and creates idempotent deliveries', () => {
  assert.match(api, /SOCIAL_STORY_SCHEDULE_ACTION/);
  assert.match(api, /'pending_approval'/);
  assert.match(api, /waiting_approval/);
  assert.match(api, /UNIQUE KEY uq_social_story_delivery \(idempotency_key\)/);
  assert.match(api, /content changed after approval request/);
});

test('Instagram publisher uses official Stories container flow and required permissions', () => {
  assert.match(api, /instagram_content_publish/);
  assert.match(api, /content_publishing_limit/);
  assert.match(api, /media_type: 'STORIES'/);
  assert.match(api, /media_publish/);
  assert.match(api, /resize\(1080, 1920/);
  assert.match(api, /\.jpeg\(/);
});

test('WhatsApp import reuses card then ordered color videos', () => {
  for (const source of [server, serverJs]) {
    assert.match(source, /buildWhatsAppStatusStoryItemsVps/);
    assert.match(source, /getWhatsAppStatusProductImage\(product\)/);
    assert.match(source, /resolveWhatsAppStatusVideoUrls\(product\)/);
    assert.match(source, /sendWhatsAppStandaloneStoryMediaVps/);
  }
  assert.ok(server.indexOf('getWhatsAppStatusProductImage(product)') < server.lastIndexOf('resolveWhatsAppStatusVideoUrls(product)'));
});

test('Panel exposes standalone, WhatsApp import and both destinations', () => {
  assert.match(panel, /Story avulso/);
  assert.match(panel, /Importar do WhatsApp/);
  assert.match(panel, /toggleDestination\('instagram'\)/);
  assert.match(panel, /toggleDestination\('whatsapp'\)/);
  assert.match(panel, /Central de Aprovações/);
});
