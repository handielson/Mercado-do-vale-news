import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const api = await readFile(new URL('../services/marketingCampaignApi.cjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const serverJs = await readFile(new URL('../vps_server.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../pages/admin/settings/marketing/SocialStorySchedulerPanel.tsx', import.meta.url), 'utf8');
const calendar = await readFile(new URL('../pages/admin/settings/marketing/MultiDateCalendar.tsx', import.meta.url), 'utf8');
const marketingPage = await readFile(new URL('../pages/admin/settings/MarketingPage.tsx', import.meta.url), 'utf8');

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
  assert.match(api, /isSelfDecision && decision === 'approve' && !allowsOrganicStorySelfApproval\(current\)/);
  assert.doesNotMatch(api, /isSelfDecision && !\(decision === 'approve'/);
  assert.match(api, /organic_story_self_approval: Boolean\(decision === 'approve' && isSelfDecision/);
  assert.match(api, /invalidSelfApproval = approval\.reviewed_by === approval\.requested_by/);
  assert.match(api, /&& !allowsOrganicStorySelfApproval\(approval\)/);
  assert.match(api, /organic_story_self_approval/);
});

test('Instagram publisher uses official Stories container flow and required permissions', () => {
  assert.match(api, /instagram_content_publishing/);
  assert.doesNotMatch(api, /'instagram_content_publish'/);
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

test('Panel exposes standalone, WhatsApp import and explicit destination choices', () => {
  assert.match(panel, /Stories de produtos/);
  assert.match(panel, /Catálogo/);
  assert.match(panel, /Story avulso/);
  assert.match(panel, /Importar do WhatsApp/);
  assert.match(panel, /Somente WhatsApp/);
  assert.match(panel, /Somente Instagram/);
  assert.match(panel, /WhatsApp \+ Instagram/);
  assert.match(panel, /setDestinations\(\['whatsapp'\]\)/);
  assert.match(panel, /setDestinations\(\['instagram'\]\)/);
  assert.match(panel, /setDestinations\(\['whatsapp', 'instagram'\]\)/);
  assert.match(marketingPage, /Agendar Stories/);
  assert.match(marketingPage, /Escolha explicitamente WhatsApp, Instagram ou os dois/);
  assert.match(panel, /defaultDestinations = \['instagram'\]/);
  assert.match(panel, /Central de Aprovações/);
  assert.match(panel, /Com preço/);
  assert.match(panel, /Sem preço/);
  assert.match(panel, /previewWhatsApp\(campaignId, includePrice\)/);
  assert.match(panel, /buildCatalogStoryItems\(sourceProducts/);
  assert.match(panel, /catalogService\.getCategoriesWithNames\(\)/);
  assert.match(panel, /catalogService\.getProducts\(filters/);
  assert.match(panel, /Categoria/);
  assert.match(panel, /Categoria completa/);
  assert.match(panel, /Intervalo entre produtos/);
  assert.match(panel, /Escolher produtos/);
  assert.match(panel, /Carregar mídias do catálogo/);
  assert.match(panel, /toBrowserSafeMediaUrl\(item\.mediaUrl\)/);
  assert.match(panel, /<img src=\{toBrowserSafeMediaUrl\(item\.mediaUrl\)\}/);
  assert.match(panel, /<video[\s\S]{0,160}src=\{toBrowserSafeMediaUrl\(item\.mediaUrl\)\}/);
  assert.match(panel, /Há mídias sem URL HTTPS pública/);
  assert.match(panel, /onLoadedMetadata/);
  assert.match(panel, /onError=\{\(\) => removeUnavailableMedia\(item\)\}/);
  assert.match(panel, /está indisponível e foi removida da programação/);
  assert.match(panel, /MultiDateCalendar/);
  assert.doesNotMatch(panel, /for \(const \{ dateKey: date, instant \} of schedulePlan\.entries\)/);
  assert.match(calendar, /Dia sim, dia não/);
  assert.match(calendar, /Todos os dias/);
});

test('Unavailable public media is preflighted and retried without calling a publisher', () => {
  assert.match(api, /assertSocialStoryMediaAvailable\(delivery, dependencies\)/);
  assert.match(api, /SOCIAL_STORY_MEDIA_UNAVAILABLE/);
  assert.match(api, /Nova tentativa automatica em/);
  assert.match(api, /deliveryStatus = retryableMediaFailure \? 'pending' : 'failed'/);
  assert.match(api, /DATE_SUB\(NOW\(\),INTERVAL \$\{SOCIAL_STORY_MEDIA_RETRY_DELAY_MINUTES\} MINUTE\)/);
});

test('Panel rejects a stale local Story time before calling the VPS', () => {
  assert.match(panel, /prepareSocialStoryScheduleDates\(selectedDates, time\)/);
  assert.match(panel, /schedulePlan\.past\?\.instant/);
  assert.match(panel, /já passou\. Escolha um dia e horário futuros/);
  assert.match(panel, /const scheduledDates = schedulePlan\.entries\.flatMap/);
  assert.match(panel, /scheduledAt: scheduledDates\[0\], scheduledDates, destinations/);
  assert.match(api, /const scheduledAtDate = scheduledDates\[0\]/);
  assert.match(api, /A data e o horário do Story precisam estar no futuro/);
  assert.doesNotMatch(api, /Scheduled date\/time cannot be in the past/);
});

test('One multi-date Story batch creates one schedule and one approval', () => {
  assert.match(api, /const rawScheduledDates = Array\.isArray\(body\.scheduledDates\)/);
  assert.match(api, /Selecione no máximo 30 dias por lote/);
  assert.match(api, /const scheduledItems = expandSocialStoryItemsForDates\(normalizedItems, scheduledDates\)/);
  assert.match(api, /scheduledDates: scheduledDates\.map/);
  assert.match(api, /dayCount: scheduledDates\.length/);
  assert.match(api, /expectedDeliveries: scheduledItems\.length \* destinations\.length/);
  assert.match(panel, /1 aprovação criada para/);
  assert.match(panel, /Será criada apenas 1 solicitação na Central de Aprovações/);
  assert.match(panel, /Solicitar 1 aprovação/);
});

test('Price choice is frozen into previews and approval snapshots', () => {
  assert.match(api, /buildWhatsAppStoryItems\(campaignId, \{ includePrice \}\)/);
  assert.match(api, /buildWhatsAppStoryItems\(sourceId, \{ includePrice \}\)/);
  assert.match(api, /destinations, includePrice, items: normalizedItems/);
});

test('API rejects partial Story schedules when any media URL is not public HTTPS', () => {
  assert.match(api, /const limitedSourceItems = sourceItems\.slice\(0, 80\)/);
  assert.match(api, /normalizedItems\.length !== limitedSourceItems\.length/);
  assert.match(api, /Every Story item must have a public HTTPS image or video URL/);
});
