const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });

const API_BASE = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '';
const ZONE_NAME = process.env.MDV_MAIL_DOMAIN || 'mercadodovale.com.br';
const VPS_IP = process.env.VPS_SITE_HOST || process.env.VPS_HOST || '76.13.232.162';
const MAIL_HOST = process.env.MDV_MAIL_HOST || `mail.${ZONE_NAME}`;
const APPLY = process.env.APPLY_CLOUDFLARE_MAIL_DNS === 'true';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_MAIL_DNS';
const CONFIRMATION = process.env.CONFIRM_CLOUDFLARE_MAIL_DNS || '';

const sshHost = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const sshUser = process.env.VPS_SITE_USER || process.env.VPS_USER || 'root';
const sshPassword = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;

if (!TOKEN) throw new Error('Missing CLOUDFLARE_API_TOKEN');
if (!sshHost || !sshUser || (!sshPassword && !privateKey)) throw new Error('Missing VPS SSH env vars');

function fail(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, message, ...extra }, null, 2));
  process.exit(1);
}

async function cf(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
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
      path: pathname,
      errors: json?.errors || null,
      messages: json?.messages || null,
    });
  }
  return json.result;
}

function sshExec(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }
        let stdout = '';
        let stderr = '';
        stream.on('data', (chunk) => { stdout += chunk.toString(); });
        stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        stream.on('close', (code) => {
          conn.end();
          if (code && code !== 0) reject(new Error(stderr || stdout || `ssh command failed: ${code}`));
          else resolve(stdout);
        });
      });
    }).on('error', reject).connect({
      host: sshHost,
      port: 22,
      username: sshUser,
      password: sshPassword,
      privateKey,
      readyTimeout: 20000,
    });
  });
}

function parseDkimTxt(raw) {
  const text = String(raw || '');
  const match = text.match(/\(([\s\S]*?)\)\s*;/);
  const compact = (match ? match[1] : text)
    .replace(/"[\s\r\n]*"/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, '');
  if (!compact.startsWith('v=DKIM1;')) {
    throw new Error('Unable to parse DKIM TXT value from VPS');
  }
  return compact;
}

function desiredRecords(dkimValue) {
  return [
    { label: 'mail-a', type: 'A', name: MAIL_HOST, content: VPS_IP, proxied: false, ttl: 1 },
    { label: 'mx', type: 'MX', name: ZONE_NAME, content: MAIL_HOST, priority: 10, ttl: 1 },
    { label: 'spf', type: 'TXT', name: ZONE_NAME, content: `v=spf1 mx ip4:${VPS_IP} ~all`, ttl: 1 },
    { label: 'dkim', type: 'TXT', name: `default._domainkey.${ZONE_NAME}`, content: dkimValue, ttl: 1 },
    {
      label: 'dmarc',
      type: 'TXT',
      name: `_dmarc.${ZONE_NAME}`,
      content: `v=DMARC1; p=quarantine; rua=mailto:contato@${ZONE_NAME}; adkim=s; aspf=s`,
      ttl: 1,
    },
  ];
}

function isManagedName(record) {
  return [
    MAIL_HOST,
    ZONE_NAME,
    `default._domainkey.${ZONE_NAME}`,
    `_dmarc.${ZONE_NAME}`,
  ].includes(record.name);
}

function shouldReplace(record, desired) {
  if (record.name !== desired.name || record.type !== desired.type) return false;
  if (record.type === 'TXT' && desired.label === 'spf') return String(record.content || '').startsWith('v=spf1');
  if (record.type === 'MX') return true;
  return true;
}

function equivalent(record, desired) {
  return record.name === desired.name
    && record.type === desired.type
    && record.content === desired.content
    && (desired.proxied === undefined || record.proxied === desired.proxied)
    && (desired.priority === undefined || Number(record.priority) === Number(desired.priority));
}

async function main() {
  const dkimRaw = await sshExec(`cat /etc/opendkim/keys/${ZONE_NAME}/default.txt`);
  const dkimValue = parseDkimTxt(dkimRaw);
  const desired = desiredRecords(dkimValue);

  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active`);
  const zone = zones[0];
  if (!zone?.id) fail('zone_not_found', { zone: ZONE_NAME });

  const records = [];
  for (const name of [...new Set(desired.map((record) => record.name))]) {
    const result = await cf(`/zones/${zone.id}/dns_records?per_page=100&name=${encodeURIComponent(name)}`);
    records.push(...result);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
  const backupPath = path.join('reports', `cloudflare-mail-dns-before-${timestamp}.json`);

  const deletions = records.filter((record) =>
    isManagedName(record)
    && desired.some((item) => item.name === record.name && item.type === record.type)
    && !desired.some((item) => equivalent(record, item))
    && desired.some((item) => shouldReplace(record, item))
  );

  const creates = desired.filter((item) => !records.some((record) => equivalent(record, item)));

  fs.writeFileSync(
    path.join(__dirname, '..', backupPath),
    JSON.stringify({ zone: { id: zone.id, name: zone.name }, records, desired, deletions, creates }, null, 2),
  );

  if (!APPLY || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      dry_run: true,
      zone: { id: zone.id, name: zone.name },
      backup_path: backupPath,
      delete_count: deletions.length,
      create_count: creates.length,
      deletions: deletions.map((record) => ({
        type: record.type,
        name: record.name,
        content: record.content,
        priority: record.priority,
        proxied: record.proxied,
      })),
      creates: creates.map((record) => ({
        label: record.label,
        type: record.type,
        name: record.name,
        content_preview: record.type === 'TXT' && record.content.length > 80 ? `${record.content.slice(0, 80)}...` : record.content,
        priority: record.priority,
        proxied: record.proxied,
      })),
      apply_requires: {
        APPLY_CLOUDFLARE_MAIL_DNS: 'true',
        CONFIRM_CLOUDFLARE_MAIL_DNS: EXPECTED_CONFIRMATION,
      },
    }, null, 2));
    return;
  }

  const results = [];
  for (const record of deletions) {
    await cf(`/zones/${zone.id}/dns_records/${record.id}`, { method: 'DELETE' });
    results.push({ action: 'delete', type: record.type, name: record.name, ok: true });
  }

  for (const record of creates) {
    const body = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      comment: `Mercado do Vale mail DNS ${timestamp}`,
    };
    if (record.proxied !== undefined) body.proxied = record.proxied;
    if (record.priority !== undefined) body.priority = record.priority;
    const result = await cf(`/zones/${zone.id}/dns_records`, { method: 'POST', body: JSON.stringify(body) });
    results.push({ action: 'create', type: result.type, name: result.name, ok: true });
  }

  console.log(JSON.stringify({
    ok: true,
    applied: true,
    zone: { id: zone.id, name: zone.name },
    backup_path: backupPath,
    results,
  }, null, 2));
}

main().catch((err) => fail('unexpected_error', { error: err.message }));
