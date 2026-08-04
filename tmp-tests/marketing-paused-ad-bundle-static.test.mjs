import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('services/marketingCampaignApi.cjs', 'utf8');
const panel = readFileSync('pages/admin/settings/marketing/MarketingCampaignAgentPanel.tsx', 'utf8');
const approvalPanel = readFileSync('pages/admin/settings/marketing/MarketingApprovalCenterPanel.tsx', 'utf8');
const metaService = readFileSync('services/metaMarketingConnectionService.ts', 'utf8');

assert.match(api, /META_AUTHORIZED_MONTHLY_CEILING_BRL = 1000/);
assert.match(api, /monthlyCeiling > META_AUTHORIZED_MONTHLY_CEILING_BRL/);
assert.match(api, /status IN \('approved','succeeded'\)/);
assert.match(api, /Aprove primeiro os criativos de/);
assert.match(api, /resolveApprovedCity\(token, 'Petrolina', 'Pernambuco'\)/);
assert.match(api, /resolveApprovedCity\(token, 'Juazeiro', 'Bahia'\)/);
assert.match(api, /location_types: \['home'\]/);
assert.match(api, /publisher_platforms: \['instagram'\]/);
assert.match(api, /destination_type: 'WHATSAPP'/);
assert.match(api, /optimization_goal: 'CONVERSATIONS'/);
assert.match(api, /event_type: 'CLICK_THROUGH', window_days: 1/);
assert.match(api, /event_type: 'VIEW_THROUGH', window_days: 0/);
assert.doesNotMatch(api, /event_type: 'CLICK_THROUGH', window_days: 7/);
assert.match(api, /meta-paused-ads-v2:/);
assert.doesNotMatch(api, /meta-paused-ads-v1:/);
assert.match(api, /tagMetaExecutionError\(error, 'criar campanha pausada'/);
assert.match(api, /tagMetaExecutionError\(error, 'criar conjunto pausado'/);
assert.match(api, /setTimeout\(resolve, 1200\)/);
assert.match(api, /Meta did not confirm paused ad set .*effective_status/);
assert.match(api, /tagMetaExecutionError\(error, 'criar anúncio pausado'/);
assert.match(api, /error\.metaTraceId = meta\.fbtrace_id/);
assert.match(api, /end_time: isoWithoutMilliseconds\(addDays\(start, item\.duration_days\)\)/);
assert.match(api, /call_to_action: \{ type: 'WHATSAPP_MESSAGE'/);
assert.match(api, /status: 'PAUSED'/);
assert.match(api, /revalidateApprovedProducts/);
assert.match(api, /SELECT approval_id,item_key FROM marketing_approval_execution_items WHERE provider=.*external_id=/);
assert.match(api, /Origem: \$\{item\.tracking_code\}/);
assert.match(api, /immediateMaximum: 0/);
assert.match(api, /delivery: 'PAUSED'/);
assert.doesNotMatch(api, /status: 'ACTIVE'/);

assert.match(metaService, /preparePausedAdBundleApproval/);
assert.match(metaService, /paused-ad-bundle-approvals/);
assert.match(panel, /Preparar anúncios completos/);
assert.match(panel, /veiculação e o gasto continuarão bloqueados/);
assert.match(approvalPanel, /Análise da Meta começa automaticamente/);
assert.match(approvalPanel, /Veiculação começa nesta etapa/);
assert.match(approvalPanel, /meta_ad_bundle/);

console.log('marketing paused WhatsApp ad bundle: OK');
