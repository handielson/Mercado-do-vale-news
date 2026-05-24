import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '';
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME || 'mercadodovale.com.br';
const VPS_IP = process.env.VPS_SITE_IP || '76.13.232.162';
const APPLY = process.env.APPLY_CLOUDFLARE_DNS_CUTOVER === 'true';
const CONFIRMATION = process.env.CONFIRM_CLOUDFLARE_DNS_CUTOVER || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_DNS_CUTOVER';
const PROXIED = process.env.CLOUDFLARE_DNS_PROXIED !== 'false';

const desiredRecords = [
  {
    label: 'apex',
    name: ZONE_NAME,
    type: 'A',
    content: VPS_IP,
    proxied: PROXIED,
    ttl: 1,
  },
  {
    label: 'www',
    name: `www.${ZONE_NAME}`,
    type: 'CNAME',
    content: ZONE_NAME,
    proxied: PROXIED,
    ttl: 1,
  },
];

function fail(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, message, ...extra }, null, 2));
  process.exit(1);
}

async function cf(path, options = {}) {
  if (!TOKEN) {
    fail('missing_CLOUDFLARE_API_TOKEN', {
      required_permission: 'Zone:DNS:Edit for mercadodovale.com.br',
      dry_run_example: '$env:CLOUDFLARE_API_TOKEN="..." ; node tools\\cloudflare-dns-cutover.mjs',
      apply_example: '$env:APPLY_CLOUDFLARE_DNS_CUTOVER="true" ; $env:CONFIRM_CLOUDFLARE_DNS_CUTOVER="I_UNDERSTAND_DNS_CUTOVER" ; node tools\\cloudflare-dns-cutover.mjs',
    });
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    fail('cloudflare_api_error', {
      status: response.status,
      path,
      errors: json?.errors || null,
      messages: json?.messages || null,
    });
  }
  return json.result;
}

function buildPlan(records) {
  return desiredRecords.map((desired) => {
    const exactType = records.find((record) => record.name === desired.name && record.type === desired.type);
    const sameName = records.filter((record) => record.name === desired.name);
    const changed = !exactType
      || exactType.content !== desired.content
      || exactType.proxied !== desired.proxied
      || exactType.ttl !== desired.ttl;

    return {
      ...desired,
      action: exactType ? (changed ? 'patch' : 'unchanged') : 'create',
      record_id: exactType?.id || null,
      current: exactType ? {
        type: exactType.type,
        name: exactType.name,
        content: exactType.content,
        proxied: exactType.proxied,
        ttl: exactType.ttl,
      } : null,
      same_name_records: sameName.map((record) => ({
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
        ttl: record.ttl,
      })),
    };
  });
}

async function main() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active`);
  const zone = zones[0];
  if (!zone?.id) fail('zone_not_found', { zone: ZONE_NAME });

  const records = await cf(`/zones/${zone.id}/dns_records?per_page=100&name=${encodeURIComponent(ZONE_NAME)}`);
  const wwwRecords = await cf(`/zones/${zone.id}/dns_records?per_page=100&name=${encodeURIComponent(`www.${ZONE_NAME}`)}`);
  const allRecords = [...records, ...wwwRecords];
  const plan = buildPlan(allRecords);

  mkdirSync('reports', { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join('reports', `cloudflare-dns-before-${timestamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ zone, records: allRecords, plan }, null, 2));

  if (!APPLY || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      dry_run: true,
      reason: !APPLY ? 'apply_disabled' : 'missing_explicit_confirmation',
      zone: { id: zone.id, name: zone.name },
      backup_path: backupPath,
      desired: desiredRecords,
      plan,
      apply_requires: {
        APPLY_CLOUDFLARE_DNS_CUTOVER: 'true',
        CONFIRM_CLOUDFLARE_DNS_CUTOVER: EXPECTED_CONFIRMATION,
      },
    }, null, 2));
    return;
  }

  const results = [];
  for (const item of plan) {
    if (item.action === 'unchanged') {
      results.push({ label: item.label, action: 'unchanged', ok: true });
      continue;
    }

    const body = JSON.stringify({
      type: item.type,
      name: item.name,
      content: item.content,
      proxied: item.proxied,
      ttl: item.ttl,
      comment: `Mercado do Vale VPS cutover ${timestamp}`,
    });

    const result = item.action === 'patch'
      ? await cf(`/zones/${zone.id}/dns_records/${item.record_id}`, { method: 'PATCH', body })
      : await cf(`/zones/${zone.id}/dns_records`, { method: 'POST', body });

    results.push({
      label: item.label,
      action: item.action,
      id: result.id,
      type: result.type,
      name: result.name,
      content: result.content,
      proxied: result.proxied,
      ttl: result.ttl,
      ok: true,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    applied: true,
    zone: { id: zone.id, name: zone.name },
    backup_path: backupPath,
    results,
  }, null, 2));
}

main().catch((err) => {
  fail('unexpected_error', { error: err.message });
});
