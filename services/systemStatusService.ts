import { vpsClient } from './vpsClient';

const sourcePaths: Record<string, string> = {
  blingConnection: '/admin/bling/connection-status',
  api: '/status', synology: '/synology/status', backup: '/admin/system-backup', bot: '/admin/bot-health',
  attendance: '/n8n-bot/whatsapp-switch/status', waha: '/admin/whatsapp-status-health',
  meta: '/admin/marketing/meta/status', stories: '/admin/marketing/stories', ml: '/mercado-livre/settings',
  shopee: '/shopee-connections', tiktok: '/tiktok-shop/settings', bling: '/admin/fiscal-companies/bling-sync-status',
  payments: '/public/payment-integrations', fiscal: '/admin/fiscal-certificates/alerts', print3d: '/admin/print3d/status',
};

export async function readSystemStatusSource(source: string): Promise<unknown> {
  if (source === 'site') {
    const response = await fetch('/VERSION.json', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Version unavailable');
    return response.json();
  }
  if (!sourcePaths[source]) throw new Error('Unknown status source');
  return vpsClient.get(sourcePaths[source], { timeoutMs: 12000 });
}
