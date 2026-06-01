import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.resolve(__dirname, '../pages/admin/settings/BlingPage.tsx');
const source = fs.readFileSync(pagePath, 'utf8');

if (!source.includes("activeTab === 'webhook' && webhookLogs === null")) {
  throw new Error('Bling webhook tab must automatically load webhook logs when opened with empty state.');
}

if (!source.includes('void loadWebhookLogs();')) {
  throw new Error('Bling webhook tab must call loadWebhookLogs automatically.');
}

console.log('bling webhook auto-load static guard ok');
