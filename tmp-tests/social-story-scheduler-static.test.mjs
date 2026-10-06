import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const api = await readFile(new URL('../services/marketingCampaignApi.cjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const serverJs = await readFile(new URL('../vps_server.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../pages/admin/settings/marketing/SocialStorySchedulerPanel.tsx', import.meta.url), 'utf8');
const calendar = await readFile(new URL('../pages/admin/settings/marketing/MultiDateCalendar.tsx', import.meta.url), 'utf8');
const marketingPage = await readFile(new URL('../pages/admin/settings/MarketingPage.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../services/socialStoryScheduleService.ts', import.meta.url), 'utf8');

test('Phone price lists use server snapshots and the existing approval schedule', () => {
  assert.match(client, /post\('\/admin\/marketing\/phone-price-list\/preview', \{ brands, priceMode, layout \}\)/);
  assert.equal((panel.match(/previewPhonePriceList\(phoneBrands, phonePriceMode, phoneLayout\)/g) || []).length, 2);
  assert.match(panel, /\[mode, phoneBrands, phonePriceMode, phoneLayout\]/);
  assert.match(panel, /useState<PhonePriceListLayout>\('cards'\)/);
  assert.match(panel, /Formato da arte/);
  assert.match(panel, /<option value="cards">Com imagens dos celulares<\/option>/);
  assert.match(panel, /<option value="list">Lista de modelos e preços<\/option>/);
  assert.match(panel, /if \(layout === 'cards'\) setPhonePriceMode\('cash'\)/);
  assert.match(panel, /disabled=\{busy \|\| phoneLayout === 'cards'\}/);
  for (const mode of ['none', 'cash', 'card']) assert.ok(panel.includes(`value="${mode}"`));
  assert.match(panel, /requestId !== previewRequestRef\.current/);
  assert.match(panel, /setPhonePreview\(null\)/);
  assert.match(panel, /Gerado em/);
  assert.match(panel, /Em cada horário agendado, a tabela será gerada novamente antes do envio/);
  assert.match(panel, /Atualizando lista automaticamente/);
  assert.doesNotMatch(panel, /Gerar lista agora/);
  assert.match(panel, /Abrir arte para baixar/);
  assert.match(panel, /max-w-\[432px\]/);
  assert.match(panel, /sourceType: mode === 'whatsapp_campaign' \? 'whatsapp_campaign' : 'standalone'/);
  assert.match(panel, /items: mode !== 'whatsapp_campaign' \? currentItems : undefined/);
  assert.match(panel, /phonePriceList: mode === 'phone_price_list' \? \{ brands: phoneBrands, priceMode: phonePriceMode, layout: phoneLayout \}/);
});

test('dynamic tables are regenerated before claiming and unavailable generation cannot fall back to saved media', () => {
  const worker = api.slice(api.indexOf('async function runNextSocialStoryDelivery'), api.indexOf('async function runNextSocialStoryDelivery') + 600);
  assert.ok(worker.indexOf('refreshNextPriceListBatch') < worker.indexOf('claimNextSocialStoryDelivery'));
  assert.match(api, /NOT EXISTS \(SELECT 1 FROM social_story_price_list_batches b[\s\S]*?b\.generated_at IS NULL/);
  assert.match(api, /await ensurePriceListBatchTable\(pool\)/);
  assert.match(api, /phonePriceList: tableRecipe, regenerateBeforeDelivery: true/);
});

test('deployment ships the daily batch dependency with the generator and supports selective release', async () => {
  const deploy = await readFile(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');
  const selective = await readFile(new URL('../scripts/deploy-phone-price-list.cjs', import.meta.url), 'utf8');
  assert.match(deploy, /'services\/socialStoryPriceListBatches\.cjs'/);
  assert.match(deploy, /--dynamic-price-tables-only/);
  assert.match(selective, /'services\/marketingCampaignApi\.cjs', 'services\/socialStoryPriceListBatches\.cjs'/);
  assert.match(selective, /ensurePriceListBatchTable\(db\)/);
  assert.match(selective, /Remote module differs from release baseline/);
});

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
  assert.match(api, /instagram_content_publish/);
  assert.doesNotMatch(api, /'instagram_content_publishing'/);
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
