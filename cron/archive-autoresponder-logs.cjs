#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const os = require('os');

for (const envPath of ['/var/www/mdv-api/.env', path.join(process.cwd(), '.env'), path.join(process.cwd(), '.env.local')]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const ARCHIVE_ROOT = process.env.AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR || '/volume1/backups/autoresponder';
const DRY_RUN = process.env.AUTORESPONDER_ARCHIVE_DRY_RUN === '1';
const DELETE_ENABLED = process.env.AUTORESPONDER_ARCHIVE_DELETE_ENABLED === '1';

function getYesterdayBrtDate(now = new Date()) {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCDate(brt.getUTCDate() - 1);
  return brt.toISOString().slice(0, 10);
}

function getDateRange(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid archive date: ${date}`);
  }
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: `${date} 00:00:00`,
    end: `${next.toISOString().slice(0, 10)} 00:00:00`,
  };
}

function getArchivePaths(date) {
  const [year, month, day] = date.split('-');
  const dir = path.join(ARCHIVE_ROOT, year, month);
  return {
    dir,
    archivePath: path.join(dir, `${day}.json.gz`),
    checksumPath: path.join(dir, `${day}.json.gz.sha256`),
  };
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const [key, value] of Object.entries(normalized)) {
      if (value instanceof Date) normalized[key] = value.toISOString();
    }
    return normalized;
  });
}

async function writeArchive({ date, rows, archiveRoot = ARCHIVE_ROOT, dryRun = DRY_RUN, selfTest = false }) {
  const [year, month, day] = date.split('-');
  const dir = path.join(archiveRoot, year, month);
  const archivePath = path.join(dir, `${day}.json.gz`);
  const checksumPath = path.join(dir, `${day}.json.gz.sha256`);
  const payload = {
    generated_at: new Date().toISOString(),
    archive_date: date,
    source: selfTest ? 'self-test' : 'mysql',
    rows: normalizeRows(rows),
  };
  const json = JSON.stringify(payload);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');

  if (dryRun) {
    return { ok: true, dry_run: true, self_test: selfTest, date, rows: rows.length, bytes: compressed.length, sha256 };
  }

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(archivePath, compressed);
  await fs.promises.writeFile(checksumPath, `${sha256}  ${path.basename(archivePath)}\n`);

  return { ok: true, dry_run: false, self_test: selfTest, date, rows: rows.length, archivePath, checksumPath, sha256 };
}

async function verifyArchiveChecksum(archivePath, expectedSha256) {
  const compressed = await fs.promises.readFile(archivePath);
  const actualSha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Archive checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  const payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  return payload;
}

async function runSelfTest() {
  const archiveRoot = process.env.AUTORESPONDER_ARCHIVE_SELF_TEST_DIR || path.join(os.tmpdir(), 'mdv-autoresponder-archive-self-test');
  const selfTestArchive = { archive_date: '2026-05-04' };
  const result = await writeArchive({
    date: selfTestArchive.archive_date,
    archiveRoot,
    selfTest: true,
    rows: [
      {
        id: 1,
        sender: '5587999990000',
        question: 'tem cabo usb?',
        intent: 'product_search',
        response_time_ms: 123,
        matched_products: [{ id: 'LE-234P', name: 'Carregador Usb', sku: 'LE234PPRE' }],
        created_at: new Date('2026-05-04T12:00:00-03:00'),
      },
    ],
  });
  const payload = await verifyArchiveChecksum(result.archivePath, result.sha256);
  console.log(JSON.stringify({ ...result, self_test: true, archive_date: payload.archive_date, verified_rows: payload.rows.length }, null, 2));
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
    return;
  }

  const date = process.argv[2] || getYesterdayBrtDate();
  const { start, end } = getDateRange(date);

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    const [rows] = await pool.query(
      `SELECT * FROM autoresponder_logs
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at ASC, id ASC`,
      [start, end]
    );
    const result = await writeArchive({ date, rows });
    console.log(JSON.stringify(result, null, 2));
    if (!DELETE_ENABLED) {
      console.log('cleanup skipped: AUTORESPONDER_ARCHIVE_DELETE_ENABLED is not enabled');
    } else {
      console.log('cleanup skipped: delete step intentionally not implemented in this phase');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[archive-autoresponder-logs] failed:', err);
  process.exitCode = 1;
});
