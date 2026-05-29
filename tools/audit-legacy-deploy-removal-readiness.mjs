import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve4, resolveCname } from 'node:dns/promises';

const APEX_DOMAIN = 'mercadodovale.com.br';
const WWW_DOMAIN = 'www.mercadodovale.com.br';
const VPS_IP = '76.13.232.162';
const LEGACY_APEX_IP = '76.76.21.21';
const LEGACY_HOST = 'mercado-do-vale-news.vercel.app';
const DNS_TIMEOUT_MS = 5000;
const EXTERNAL_PANEL_CONFIRMATION = [
  {
    provider: 'Bling',
    mode: 'manual_panel_read_only',
    expected_urls: [
      'https://www.mercadodovale.com.br/api/auth/callback/bling',
      'https://www.mercadodovale.com.br/api/bling-webhook',
    ],
    panel_checks: [
      'Link de redirecionamento do aplicativo aponta para a VPS',
      'Aba Webhooks nao possui URL da Vercel',
      'Servidores/recursos de webhook usam a rota publica da VPS',
    ],
  },
  {
    provider: 'Shopee',
    mode: 'manual_panel_read_only',
    expected_urls: [
      'https://www.mercadodovale.com.br/api/shopee?action=callback',
      'https://www.mercadodovale.com.br/api/shopee-webhook',
    ],
    panel_checks: [
      'Live Redirect URL/Domain aponta para www.mercadodovale.com.br',
      'Push Mechanism/Live Call Back URL aponta para a rota da VPS',
      'Nenhum campo de callback/push mantem dominio Vercel',
    ],
  },
  {
    provider: 'Mercado Pago',
    mode: 'manual_panel_read_only',
    expected_urls: [
      'https://www.mercadodovale.com.br/api/mercadopago-webhook',
    ],
    panel_checks: [
      'Webhooks > Configurar notificacoes usa URL de producao da VPS',
      'Eventos de pagamento necessarios continuam selecionados',
      'Nenhuma notification_url produtiva aponta para Vercel',
    ],
  },
];

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function rootContains(name) {
  return readdirSync('.', { withFileTypes: true }).some((entry) => entry.name === name);
}

async function resolveSafe(label, fn) {
  try {
    const value = await Promise.race([
      fn(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('dns_timeout')), DNS_TIMEOUT_MS);
      }),
    ]);
    return { label, ok: true, value };
  } catch (err) {
    return { label, ok: false, error: err.message };
  }
}

async function main() {
  const packageJson = JSON.parse(readText('package.json') || '{}');
  const packageLock = readText('package-lock.json');
  const server = readText('server.js');
  const vpsServer = readText('vps_server.js');
  const vpsServerCjs = readText('vps_server.cjs');
  const vercelConfigPresent = existsSync('vercel.json');
  const legacyApiPresent = existsSync('api');
  const legacyConfigPresent = [
    'vercel.json',
    '.vercelignore',
    '.vercel-build-trigger',
    'diag-vercel.cjs',
    'VERCEL_ENV_VARS.md',
  ].some(rootContains);

  const [apexA, wwwA, wwwCname] = await Promise.all([
    resolveSafe(APEX_DOMAIN, () => resolve4(APEX_DOMAIN)),
    resolveSafe(WWW_DOMAIN, () => resolve4(WWW_DOMAIN)),
    resolveSafe(`${WWW_DOMAIN} cname`, () => resolveCname(WWW_DOMAIN)),
  ]);

  const legacyCronsDisabled = !vercelConfigPresent || !readText('vercel.json').includes('"crons"');
  const corsAllowsLegacyFallback = [server, vpsServer, vpsServerCjs].some((source) => source.includes(LEGACY_HOST));
  const legacyCronUserAgentAllowed = [vpsServer, vpsServerCjs].some((source) => source.includes('vercel-cron/1.0'));
  const blockers = [];

  if (legacyConfigPresent) blockers.push('legacy_config_present');
  if (legacyApiPresent) blockers.push('legacy_api_files_present');
  if (packageJson.dependencies?.['@vercel/node'] || packageLock.includes('"@vercel/node"')) blockers.push('legacy_runtime_present');
  if (corsAllowsLegacyFallback) blockers.push('cors_allows_legacy_fallback');
  if (legacyCronUserAgentAllowed) blockers.push('legacy_cron_user_agent_allowed');

  console.log(JSON.stringify({
    ready_to_remove_legacy_deploy: blockers.length === 0,
    legacy_config_present: legacyConfigPresent,
    legacy_api_files_count: legacyApiPresent ? 1 : 0,
    legacy_crons_disabled: legacyCronsDisabled,
    cors_allows_legacy_fallback: corsAllowsLegacyFallback,
    legacy_cron_user_agent_allowed: legacyCronUserAgentAllowed,
    expected_vps_ip: VPS_IP,
    legacy_apex_ip: LEGACY_APEX_IP,
    dns: {
      apex_a: apexA,
      www_a: wwwA,
      www_cname: wwwCname,
    },
    external_cutover_checklist: [
      'callbacks OAuth Bling e Shopee',
      'webhooks Bling, Shopee e Mercado Pago',
      'painel Mercado Pago apontando para www.mercadodovale.com.br',
      'painel Shopee/Bling sem URL da Vercel',
    ],
    external_panel_confirmation: EXTERNAL_PANEL_CONFIRMATION,
    blockers,
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
