import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('services/marketingCampaignApi.cjs', 'utf8');
const service = fs.readFileSync('services/metaMarketingConnectionService.ts', 'utf8');
const panel = fs.readFileSync('pages/admin/settings/marketing/MetaMarketingConnectionPanel.tsx', 'utf8');

assert.match(api, /META_DELIVERY_STATUS_ACTION = 'meta\.set_delivery_status\.v1'/);
assert.match(api, /delivery-status-approvals/);
assert.match(api, /async function executeMetaDeliveryStatusChange/);
assert.match(api, /Legacy campaigns can only be paused/);
assert.match(api, /Meta has not approved/);
assert.match(api, /Activation blocked by active campaign outside the managed portfolio/);
assert.match(api, /Pause primeiro as campanhas antigas ativas/);

const executor = api.slice(
    api.indexOf('async function executeMetaDeliveryStatusChange'),
    api.indexOf('async function runMetaReviewAutoLaunch'),
);
const adActivation = executor.indexOf("graphPost(payload.ad_id, token, { status: 'ACTIVE' })");
const campaignActivation = executor.indexOf("graphPost(payload.campaign_id, token, { status: 'ACTIVE' })");
assert.ok(adActivation >= 0 && campaignActivation > adActivation, 'campaign parent must activate last');
const campaignPause = executor.indexOf("graphPost(payload.campaign_id, token, { status: 'PAUSED' })");
const adPause = executor.indexOf("graphPost(payload.ad_id, token, { status: 'PAUSED' })");
assert.ok(campaignPause >= 0 && adPause > campaignPause, 'campaign parent must pause first');

assert.match(service, /prepareDeliveryStatusApproval/);
assert.match(panel, /Preparar ativação/);
assert.match(panel, /Preparar pausa/);
assert.match(panel, /A ativação será liberada quando a Meta concluir a análise/);
assert.match(panel, /activeOutsidePortfolio\.length > 0/);

console.log('marketing Meta delivery controls: OK');
