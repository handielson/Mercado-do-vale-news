import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('pages/admin/settings/marketing/MarketingCampaignAgentPanel.tsx', 'utf8');
const service = readFileSync('services/marketingCampaignPortfolioService.ts', 'utf8');
const metaService = readFileSync('services/metaMarketingConnectionService.ts', 'utf8');

assert.match(service, /id: 'store-carousel'/);
assert.match(service, /id: 'smartphones'/);
assert.match(service, /Petrolina–PE/);
assert.match(service, /Juazeiro–BA/);
assert.match(service, /Aleatoriedade controlada/);
assert.match(service, /marketing\.instagram\.campaign_portfolio/);
assert.match(service, /objective: 'sales'/);
assert.match(service, /destination: 'whatsapp'/);
assert.match(service, /Quero comprar: \{nome_produto\} \| Codigo: \{sku\}/);
assert.match(panel, /Valor autorizado/);
assert.match(panel, /WhatsApp oficial:/);
assert.match(panel, /Mensagem preparada para o bot/);
assert.match(panel, /teto autorizado, não uma ordem para gastar tudo/);
assert.match(panel, /Salvar aqui não ativa nem gasta nada/);
assert.match(panel, /Campanhas configuradas/);
assert.match(panel, /Público inicial: amplo e local/);
assert.match(panel, /Preparar anúncios completos/);
assert.match(panel, /dois conjuntos e dois anúncios completos em estado PAUSADO/);
assert.match(metaService, /campaign-draft-approvals/);
assert.match(metaService, /creative-plan-approvals/);
assert.match(metaService, /paused-ad-bundle-approvals/);
assert.match(panel, /Criativos que irão para aprovação/);
assert.match(panel, /Etapa 1 · Aprovação interna do Gestão MV/);
assert.match(panel, /Como pedir a aprovação da Meta/);
assert.match(panel, /Processo oficial da Meta/);
assert.match(panel, /Mensagem pronta:/);

console.log('marketing campaign agent portfolio: OK');
