import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');
const page = readFileSync('pages/admin/whatsapp/NovoBotPage.tsx', 'utf8');
const service = readFileSync('services/n8nBotControlService.ts', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const paymentSpecialistPatch = readFileSync('tmp-tests/n8n-add-payment-specialist-flow.cjs', 'utf8');
const patch = [
  readFileSync('tmp-tests/n8n-add-admin-client-control.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-add-delivery-payment-flow.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-add-store-hours-intent.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-fix-null-classifier-and-cep.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-fix-cep-lookup-fallback.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-fix-delivery-cep-http-node.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-fix-delivery-address-extra-pipe.cjs', 'utf8'),
  paymentSpecialistPatch,
  readFileSync('tmp-tests/n8n-add-store-location-specialist-flow.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-fix-global-identity-handoff.cjs', 'utf8'),
  readFileSync('tmp-tests/n8n-add-delivery-freight-policy.cjs', 'utf8'),
].join('\n');

for (const source of [server, serverCjs]) {
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_client_controls/, 'server must create n8n bot controls table');
  assert.match(source, /fastify\.get\('\/n8n-bot\/client-control'/, 'server must expose lookup endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/client-control\/block'/, 'server must expose block endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/client-control\/reset'/, 'server must expose reset endpoint');
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_admin_numbers/, 'server must persist admin WhatsApp numbers');
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_global_control/, 'server must persist global n8n bot control');
  assert.match(source, /fastify\.get\('\/n8n-bot\/admin-numbers'/, 'server must expose admin number listing');
  assert.match(source, /fastify\.post\('\/n8n-bot\/admin-numbers'/, 'server must expose admin number upsert');
  assert.match(source, /fastify\.delete\('\/n8n-bot\/admin-numbers\/:id'/, 'server must expose admin number removal');
  assert.match(source, /fastify\.get\('\/n8n-bot\/global-control'/, 'server must expose global control lookup');
  assert.match(source, /fastify\.post\('\/n8n-bot\/global-control'/, 'server must expose global control update');
  assert.match(source, /normalizeN8nBotAdminCommand/, 'server must normalize admin command text');
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_messages/, 'server must create n8n bot messages table');
  assert.match(source, /contact_name VARCHAR\(160\) NULL/, 'server must persist n8n bot contact names');
  assert.match(source, /normalizeN8nBotContactName/, 'server must normalize contact names from n8n logs');
  assert.match(source, /SELECT id, remote_jid, phone, contact_name/, 'server must return contact name in message history');
  assert.match(source, /fastify\.get\('\/n8n-bot\/conversations'/, 'server must expose n8n bot conversations endpoint');
  assert.match(source, /fastify\.get\('\/n8n-bot\/messages'/, 'server must expose n8n bot messages endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/messages\/log'/, 'server must expose n8n bot message log endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/messages\/manual'/, 'server must expose n8n manual reply endpoint');
  assert.match(source, /payload\.quoted = quoted/, 'manual n8n replies must support WhatsApp quoted replies');
  assert.match(source, /N8N_BOT_EVOLUTION_INSTANCE_NAME \|\| 'botmercadodovale'/, 'manual n8n replies must target the current n8n Evolution instance by default');
  assert.match(source, /idle_followup_sent_at/, 'server must persist n8n idle follow-up state');
  assert.match(source, /idle_closed_at/, 'server must persist n8n idle close state');
  assert.match(source, /runN8nBotIdleFollowups/, 'server must run n8n idle follow-ups');
  assert.match(source, /scheduleN8nBotIdleFollowups/, 'server must schedule n8n idle follow-ups automatically');
  assert.match(source, /WHERE msg\.direction IN \('inbound', 'outbound'\)/, 'idle follow-up must evaluate the latest real customer/bot message');
  assert.match(source, /WHERE latest\.direction = 'outbound'/, 'idle follow-up must run after the bot answered and the customer stayed silent');
  assert.match(source, /latest\.source_node <> 'idle-followup'/, 'idle follow-up must not repeat after its own reminder');
  assert.match(source, /N8N_BOT_IDLE_CLOSE_MESSAGE/, 'idle close must have an outbound message');
  assert.match(source, /sourceNode: 'idle-close'/, 'idle close must be logged as an outbound close message');
  assert.match(source, /buildN8nBotMemorySessionKey\(remoteJid, resetCount\)/, 'server must return versioned memory session key');
}

assert.match(service, /\/n8n-bot\/client-control\/block/, 'front service must call block endpoint');
assert.match(service, /\/n8n-bot\/client-control\/reset/, 'front service must call reset endpoint');
assert.match(service, /\/n8n-bot\/conversations/, 'front service must list n8n conversations');
assert.match(service, /\/n8n-bot\/messages/, 'front service must list n8n messages');
assert.match(service, /sendManualMessage/, 'front service must send n8n manual replies');
assert.match(service, /replyToWaMessageId/, 'front service must pass WhatsApp message ids for quoted replies');
assert.match(service, /contact_name\?: string \| null/, 'front service must type contact names');
assert.match(service, /listAdminNumbers/, 'front service must list admin WhatsApp numbers');
assert.match(service, /saveAdminNumber/, 'front service must save admin WhatsApp numbers');
assert.match(service, /removeAdminNumber/, 'front service must remove admin WhatsApp numbers');
assert.match(service, /getGlobalControl/, 'front service must fetch global bot control');
assert.match(service, /setGlobalControl/, 'front service must update global bot control');
assert.match(page, /Bloquear fluxo/, 'new bot page must expose block action');
assert.match(page, /Limpar atendimento/, 'new bot page must expose admin reset action');
assert.match(page, /Ao vivo/, 'new bot page must expose live refresh mode');
assert.match(page, /messageTone/, 'new bot page must render a message timeline');
assert.match(page, /selectedReplyMessage/, 'new bot page must track the marked message being replied to');
assert.match(page, /Responder/, 'new bot page must expose reply actions on inbound messages');
assert.match(page, /Pausar bot depois/, 'manual reply UI must let the attendant pause the bot after answering');
assert.match(page, /sendManualReply/, 'new bot page must send manual replies');
assert.match(page, /displayContactName/, 'new bot page must display contact names when available');
assert.match(page, /ChevronDown/, 'conversation list must expose an expandable arrow icon');
assert.match(page, /expandedRemoteJid/, 'conversation list must track the expanded conversation');
assert.match(page, /expandedMessagesByJid/, 'conversation list must cache compact expanded histories by conversation');
assert.match(page, /toggleConversationExpansion/, 'conversation list must expand and collapse a conversation inline');
assert.match(page, /limit: 10/, 'expanded conversation preview must fetch a compact history instead of the full timeline');
assert.match(page, /Conversas recentes/, 'expanded conversation preview must label the inline history block');
assert.match(page, /Comandos por WhatsApp/, 'Novo Bot page must expose WhatsApp command settings');
assert.match(page, /Numero admin/, 'Novo Bot page must let admin enter an authorized number');
assert.match(page, /Pausar geral/, 'Novo Bot page must expose global pause');
assert.match(page, /Continuar geral/, 'Novo Bot page must expose global continue');
assert.match(page, /adminNumbers/, 'Novo Bot page must track authorized admin numbers');
assert.match(page, /globalControl/, 'Novo Bot page must track global bot control state');
assert.match(routes, /NovoBotPage/, 'routes must include new bot page');
assert.match(routes, /\/admin\/whatsapp\/novo-bot/, 'routes must expose separated new bot path');
assert.match(layout, /Novo Bot/, 'admin menu must include Novo Bot');

assert.match(patch, /Controle Bot - Verificar Cliente/, 'n8n patch must add client control node');
assert.match(patch, /Controle Bot - Buscar Admin Global/, 'n8n patch must fetch admin/global command control');
assert.match(patch, /Controle Bot - Comando Admin/, 'n8n patch must parse admin WhatsApp commands');
assert.match(patch, /Controle Bot - E comando admin\?/, 'n8n patch must branch admin commands before customer flow');
assert.match(patch, /Controle Bot - Executar Comando Admin/, 'n8n patch must execute admin commands through VPS API');
assert.match(patch, /Controle Bot - Responder Admin/, 'n8n patch must confirm admin commands via WhatsApp');
assert.match(patch, /Controle Bot - Pausa global\?/, 'n8n patch must stop customer flow when global pause is active');
assert.match(patch, /Controle Bot - Bloqueado\?/, 'n8n patch must add blocked IF node');
assert.match(patch, /memorySessionKey/, 'n8n patch must use versioned memory session key');
assert.match(patch, /SYNC_SECRET/, 'n8n patch must provide sync secret to workflow runtime');
assert.match(patch, /delete staticData\.salesPostList\[remoteJid\]/, 'n8n reset must clear post-list state');
assert.match(patch, /Controle Bot - Registrar Entrada/, 'n8n patch must add inbound message logger');
assert.match(patch, /Controle Bot - Buscar Controle/, 'n8n patch must use HTTP node for client control lookup');
assert.match(patch, /Controle Bot - Aplicar Controle/, 'n8n patch must restore source data after control lookup');
assert.match(patch, /Controle Bot - Reset pendente\?/, 'n8n patch must consume admin resets after applying them');
assert.match(patch, /Controle Bot - Registrar Saida/, 'n8n patch must add outbound message logger');
assert.match(patch, /Controle Bot - Restaurar Saida/, 'n8n patch must restore outbound items after logging');
assert.match(patch, /\/n8n-bot\/messages\/log/, 'n8n patch must log messages to VPS');
assert.match(patch, /n8n-nodes-base\.httpRequest/, 'n8n log/control calls must use HTTP Request nodes');
assert.match(patch, /patchTransientHttpNode/, 'n8n patch must make transient HTTP nodes resilient');
assert.match(patch, /Vendas - Buscar Taxas/, 'n8n patch must protect payment fees lookup');
assert.match(patch, /Vendas - Buscar Produtos/, 'n8n patch must protect product lookup');
assert.match(patch, /continueRegularOutput/, 'n8n HTTP failures must not abort the sales flow');
assert.match(patch, /maxTries = 3/, 'n8n transient HTTP nodes must retry before continuing');
assert.match(patch, /Enviar WhatsApp - Tipo imagem\?/, 'outbound logger must preserve the image/text router');
assert.match(patch, /Enviar WhatsApp - Imagem/, 'image messages must route to the media send node');
assert.match(patch, /imageTrueTarget/, 'patch result must report image true routing');
assert.match(patch, /imageFalseTarget/, 'patch result must report image false routing');
assert.match(patch, /Me confirma o numero do item ou o modelo/, 'photo requests without active state must ask for selection instead of reopening the catalog');
assert.match(patch, /uniqueColorItems/, 'post-list color choices must dedupe repeated stock variations');
assert.match(patch, /optionColorItems\.length === 1/, 'single unique color must be selected even when stock has duplicate rows');
assert.match(patch, /optionColorItems\.find/, 'mentioned color must resolve against deduped color options');
assert.match(patch, /quantityIntent/, 'post-list quantity step must classify full message before consuming a number');
assert.match(patch, /!wantsPhoto && quantityIntent/, 'photo requests with numbers must not be consumed as quantity');
assert.match(patch, /produto\|item\|do\|da/, 'post-list selection must understand contextual number references like foto do 22');
assert.match(patch, /Vendas - Preparar Contexto IA/, 'sales flow must prepare state context before the classifier');
assert.match(patch, /salesConversationState/, 'classifier must receive the active sales state');
assert.match(patch, /Agente Inicial e Roteador/, 'initial AI agent must own routing and flow intent decisions');
assert.match(patch, /fluxo_venda/, 'classifier JSON must include sales flow action');
assert.match(patch, /salesFlowAction/, 'post-list executor must consume AI flow action');
assert.match(patch, /aiAction === 'informar_quantidade'/, 'quantity must come from AI-classified intent before fallback parsing');
assert.match(patch, /aiAction === 'nova_busca'/, 'customer can start a new search even with active sales state');
assert.match(patch, /Parse Classificacao[\s\S]*Vendas - Verificar Pos Lista/, 'post-list executor must run after AI classification');
assert.match(patch, /withGreeting/, 'post-list executor must preserve detected greetings in operational replies');
assert.match(patch, /periodGreeting/, 'post-list media replies must be able to send greeting before photos');
assert.match(patch, /No link tem mais fotos, video e as caracteristicas dele/, 'photo replies must include product link for complete media and characteristics');
assert.match(patch, /slice\(0, 3\)/, 'photo replies should send a small WhatsApp preview instead of flooding all media');
assert.match(patch, /nextCode = nextCode\.replace\([\s\S]*titleCase\(item\.color\)[\s\S]*,\s*''\s*\)/, 'photo replies must remove the standalone color text because the caption already includes it');
assert.match(patch, /buildAllPhotoMessages/, 'photo requests for multi-color products must send previews instead of asking color first');
assert.match(patch, /if \(!variant && \(wantsPhoto \|\| wantsPhotoFromAI\)\)/, 'photo intent must bypass the color-question branch when no color was chosen');
assert.match(patch, /Gostou de alguma dessas cores\? Posso separar para voce/, 'multi-color photo preview must continue the sale after showing variations');
assert.match(patch, /awaiting_delivery_zip/, 'sales flow must ask for delivery CEP before address details');
assert.match(patch, /entrega_frete/, 'entry classifier must recognize random delivery freight questions');
assert.match(patch, /Entrega - Politica/, 'workflow must route delivery freight questions to a dedicated specialist');
assert.match(patch, /DELIVERY_FREIGHT_TABLE/, 'delivery freight policy must keep an editable n8n table');
assert.match(patch, /defaultMotoboyFeeCents:\s*5000/, 'delivery freight table must start with R$ 50 default motoboy fee');
assert.match(patch, /customerShareCents:\s*2500/, 'delivery freight table must split R$ 25 to the customer by default');
assert.match(patch, /Petrolina/, 'delivery freight table must include Petrolina urban free delivery');
assert.match(patch, /Juazeiro/, 'delivery freight table must include Juazeiro urban free delivery');
assert.match(patch, /brasilapi\.com\.br\/api\/cep\/v2/, 'sales flow must look up delivery address by CEP with Brasil API');
assert.match(patch, /brasilapi\.com\.br\/api\/cep\/v1/, 'sales flow must fallback to BrasilAPI v1 when CEP v2 lookup fails');
assert.match(patch, /viacep\.com\.br\/ws/, 'sales flow must fallback to ViaCEP when BrasilAPI lookup fails');
assert.match(patch, /Vendas - Precisa buscar CEP\?/, 'delivery CEP lookup must branch to a real HTTP node');
assert.match(patch, /Vendas - Buscar CEP ViaCEP/, 'delivery CEP lookup must use an n8n HTTP Request node');
assert.match(patch, /needsDeliveryCepLookup: true/, 'post-list code must mark CEP lookup instead of doing fetch directly');
assert.match(patch, /lineBreak \+ addressText\(found\) \+ lineBreak \+ 'Agora me manda/, 'delivery address follow-up must not leave an extra pipe before asking number/complement');
assert.match(patch, /awaiting_pickup_time/, 'sales flow must ask pickup customers for the estimated pickup time');
assert.match(patch, /business_hours/, 'pickup validation must use dynamic company business hours');
assert.match(patch, /awaiting_payment_method/, 'sales flow must continue to payment after delivery or pickup data');
assert.match(patch, /pix_key/, 'payment flow must be able to use the company Pix key');
assert.match(patch, /formas_pagamento/, 'entry classifier must recognize random payment-policy questions');
assert.match(patch, /Pagamento - Politica/, 'workflow must route payment-policy questions to a dedicated payment specialist');
assert.match(patch, /nao aceitamos aparelho usado como entrada/, 'payment policy must politely reject used products as trade-in');
assert.match(patch, /No boleto a gente nao trabalha/, 'payment policy must politely reject boleto payments');
assert.match(patch, /ate 12x/, 'payment policy must answer how many installments are available');
assert.match(patch, /pagamento por link/, 'payment policy must explain card payment is only in person');
assert.match(patch, /paymentPolicyReply/, 'payment policy must answer by specific payment topic');
assert.doesNotMatch(
  paymentSpecialistPatch.match(/const paymentPolicyHelpersCode = `[\s\S]*?`;/)?.[0] || '',
  /\\\\uD83D|\\\\uDE0A|\\\\uDCB3|\\\\uDE4F/,
  'customer-facing payment policy must not send raw unicode escape text'
);
assert.match(patch, /Vendas - Buscar Taxas Parcelamento/, 'card installment flow must fetch the real payment fee table');
assert.match(patch, /awaiting_card_installment/, 'card payment flow must wait for the customer installment choice');
assert.match(patch, /parseDownPayment/, 'payment specialist must identify Pix or cash down payments');
assert.match(patch, /buildInstallmentOptions/, 'payment specialist must build installment options from 1x to 12x');
assert.match(patch, /paymentInstallments\s*=\s*12/, 'payment specialist must include 12x card options');
assert.match(patch, /localizacao_loja/, 'entry classifier must recognize random store-location questions');
assert.match(patch, /Loja - Buscar Dados Empresa/, 'store location flow must fetch public company settings');
assert.match(patch, /Loja - Localizacao/, 'workflow must route store-location questions to a dedicated specialist');
assert.match(patch, /address_lat/, 'store location specialist must use company latitude when available');
assert.match(patch, /address_lng/, 'store location specialist must use company longitude when available');
assert.match(patch, /maps\.google\.com/, 'store location specialist must build a Google Maps link');
assert.match(patch, /chunkSize = 5/, 'smartphone quote messages must be chunked in blocks of 5 products');
assert.match(patch, /horario_loja/, 'entry classifier must recognize random store-hours questions');
assert.match(patch, /Loja - Horario Atendimento/, 'workflow must route store-hours questions to a dedicated specialist');
assert.match(patch, /business_hours/, 'store-hours specialist must use dynamic company business hours');
assert.match(patch, /identidade_bot/, 'entry classifier must recognize bot identity questions');
assert.match(patch, /Sou Nina, sua agente virtual/, 'bot identity specialist must answer with Nina');
assert.match(patch, /Atendente - Horario/, 'human handoff must use a dynamic hours-aware specialist');
assert.match(patch, /atendimento online/, 'human handoff must explain online availability');
assert.doesNotMatch(patch, /Claro!\s*😊\|\|\|Vou chamar um atendente/, 'human handoff must not force a generic Claro greeting');
assert.match(patch, /lunchEnd/, 'store-hours specialist must explain lunch return time when needed');
assert.match(patch, /parsed\.venda && typeof parsed\.venda === 'object'/, 'classifier parser must tolerate venda null');
assert.match(patch, /digits\.length === 8/, 'delivery CEP parsing must accept exactly 8 digits after removing punctuation');
assert.match(patch, /patchSplitMessagesNode/, 'split node must preserve custom per-message delay metadata');
assert.match(patch, /delayMs: Number\(message\.delayMs \|\| 0\)/, 'array messages must carry delayMs into send nodes');
assert.match(patch, /patchSendDelayNode/, 'send nodes must prefer custom delayMs when present');
assert.match(patch, /Number\(\$json\.delayMs \|\| 0\) > 0/, 'Evolution send payload must use custom delay to preserve media block order');
assert.match(patch, /1200 \+ messages\.length \* 4500/, 'multi-color media flow must delay final text until after previews and link');

console.log('n8n admin client control static checks passed');
