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

test('A single admin may approve only an organic zero-cost Story', () => {
  assert.match(api, /function allowsOrganicStorySelfApproval\(approval\)/);
  assert.match(api, /approval\?\.action_type !== SOCIAL_STORY_SCHEDULE_ACTION/);
  assert.match(api, /approval\?\.target_type !== 'social_story_schedule'/);
  assert.match(api, /financialImpact\.currency === 'BRL'/);
  assert.match(api, /Number\(financialImpact\.amount\) === 0/);
  assert.match(api, /financialImpact\.recurring === false/);
  assert.match(api, /decision === 'approve' && allowsOrganicStorySelfApproval\(current\)/);
  assert.match(api, /invalidSelfApproval = approval\.reviewed_by === approval\.requested_by/);
  assert.match(api, /&& !allowsOrganicStorySelfApproval\(approval\)/);
  assert.match(api, /organic_story_self_approval/);
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
    assert.match(source, /getWhatsAppStatusStoryProductImageVps\(product, includePrice\)/);
    assert.match(source, /item\?\.image_url/);
    assert.match(source, /resolveWhatsAppStatusVideoUrls\(product\)/);
    assert.match(source, /resolveWhatsAppStatusStoryVideoUrlsVps\(product, includePrice\)/);
    assert.match(source, /if \(includePrice\) return buildWhatsAppStatusVideoCandidates\(product\)/);
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
  assert.match(panel, /Com preço/);
  assert.match(panel, /Sem preço/);
  assert.match(panel, /previewWhatsApp\(campaignId, includePrice\)/);
});

test('Price choice is frozen into previews and approval snapshots', () => {
  assert.match(api, /buildWhatsAppStoryItems\(campaignId, \{ includePrice \}\)/);
  assert.match(api, /buildWhatsAppStoryItems\(sourceId, \{ includePrice \}\)/);
  assert.match(api, /snapshot = \{ title, sourceType, sourceId, scheduledAt, destinations, includePrice, items: normalizedItems \}/);
});
