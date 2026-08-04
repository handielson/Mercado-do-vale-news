import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS facebook_marketplace_campaigns/, `${file}: campaign table missing`);
  assert.match(source, /COALESCE\(p\.stock_quantity, 0\) >= \?/, `${file}: stock guard missing`);
  assert.match(source, /TIMESTAMPDIFF\(HOUR, s\.scheduled_for, \?\) < \?/, `${file}: republish cooldown missing`);
  assert.match(source, /DATE\(scheduled_for\) = \? AND status <> 'cancelled'/, `${file}: daily limit missing`);
  assert.match(source, /setInterval\(\(\) => void runFacebookMarketplaceAutomationTickVps\(\), 60_000\)/, `${file}: dedicated automation tick missing`);
  assert.match(source, /status, notes\)\s*\n\s*VALUES \(\?, \?, 'campaign'/, `${file}: assisted schedule generation missing`);
  assert.doesNotMatch(source, /facebook[^\n]{0,80}(click|submit)\(/i, `${file}: must not automate Facebook submission`);
}

const panel = readFileSync('pages/admin/settings/marketing/FacebookMarketplaceCampaignPanel.tsx', 'utf8');
assert.match(panel, /Estoque mínimo/);
assert.match(panel, /Intervalo \(min\)/);
assert.match(panel, /Repetir após \(h\)/);
assert.match(panel, /selecione um ou vários/i);
assert.match(panel, /Puxar da conta aberta/);
assert.match(panel, /\^smartphones\?\$\/i/, 'new campaigns must prioritize the exact Smartphones category');

const manifest = JSON.parse(readFileSync('browser-extensions/facebook-groups-sync/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.host_permissions.some((entry) => entry.includes('facebook.com')));

console.log('facebook-marketplace-campaigns-static ok');
