#!/usr/bin/env node

const { Client } = require('ssh2');

const HOST = process.env.VPS_HOST || '76.13.232.162';
const USER = process.env.VPS_USER || 'root';
const PASS = process.env.VPS_ROOT_PASSWORD;
const APPLY = process.env.AUTORESPONDER_ARCHIVE_WRITE_APPLY === '1';
const ARCHIVE_DATE = process.env.AUTORESPONDER_ARCHIVE_WRITE_DATE || process.argv[2] || '2026-05-04';
const TEST_ROOT = process.env.AUTORESPONDER_ARCHIVE_WRITE_ROOT || '/tmp/mdv-autoresponder-archive-write-test';
const REMOTE_SCRIPT = '/var/www/mdv-api/cron/archive-autoresponder-logs.cjs';

const FORBIDDEN_ACTIONS = [
  'crontab is not changed',
  'pm2 is not restarted',
  'delete mode is not enabled',
  'Synology final path is not used',
];

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getExpectedRemotePaths(date) {
  const [year, month, day] = date.split('-');
  const archivePath = `${TEST_ROOT}/${year}/${month}/${day}.json.gz`;
  return {
    archivePath,
    checksumPath: `${archivePath}.sha256`,
  };
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      stream.on('close', (code) => {
        if (code !== 0) {
          const detail = stderr.trim() || stdout.trim() || `Remote command exited ${code}`;
          reject(new Error(`Remote command failed: ${command}\n${detail}`));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

function printPlan() {
  const paths = getExpectedRemotePaths(ARCHIVE_DATE);
  console.log(JSON.stringify({
    ok: true,
    apply: false,
    host: HOST,
    user: USER,
    date: ARCHIVE_DATE,
    test_root: TEST_ROOT,
    archivePath: paths.archivePath,
    checksumPath: paths.checksumPath,
    remote_command: `AUTORESPONDER_ARCHIVE_DRY_RUN=0 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0 AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR=${TEST_ROOT} node ${REMOTE_SCRIPT} ${ARCHIVE_DATE}`,
    validations: [
      'archive file exists',
      'checksum file exists',
      'sha256sum matches checksum file',
      'gzip -t passes',
      'JSON.parse succeeds after gunzip',
      'archive_date matches requested date',
    ],
    forbidden_actions: FORBIDDEN_ACTIONS,
    next: 'Set AUTORESPONDER_ARCHIVE_WRITE_APPLY=1 and VPS_ROOT_PASSWORD to write the controlled archive file on the VPS.',
  }, null, 2));
}

function buildPayloadReader(archivePath) {
  const script = `
const fs = require('fs');
const zlib = require('zlib');
const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(${JSON.stringify(archivePath)})).toString('utf8'));
console.log(JSON.stringify({
  archive_date: payload.archive_date,
  source: payload.source,
  rows: Array.isArray(payload.rows) ? payload.rows.length : null
}));
`;
  return `node -e ${shellQuote(script)}`;
}

async function runWriteTest() {
  if (!PASS) {
    throw new Error('Missing VPS_ROOT_PASSWORD. Refusing to connect without an explicit runtime password.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ARCHIVE_DATE)) {
    throw new Error(`Invalid AUTORESPONDER_ARCHIVE_WRITE_DATE: ${ARCHIVE_DATE}`);
  }

  const paths = getExpectedRemotePaths(ARCHIVE_DATE);
  const conn = await connect();
  try {
    const archiveCommand = [
      'cd /var/www/mdv-api',
      `AUTORESPONDER_ARCHIVE_DRY_RUN=0 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0 AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR=${shellQuote(TEST_ROOT)} node ${shellQuote(REMOTE_SCRIPT)} ${shellQuote(ARCHIVE_DATE)}`,
    ].join(' && ');
    const archiveOutput = await execRemote(conn, archiveCommand);

    await execRemote(conn, `test -s ${shellQuote(paths.archivePath)}`);
    await execRemote(conn, `test -s ${shellQuote(paths.checksumPath)}`);
    await execRemote(conn, `gzip -t ${shellQuote(paths.archivePath)}`);

    const actualSha = (await execRemote(conn, `sha256sum ${shellQuote(paths.archivePath)} | awk '{print $1}'`)).trim();
    const checksumFile = (await execRemote(conn, `cat ${shellQuote(paths.checksumPath)}`)).trim();
    const expectedSha = checksumFile.split(/\s+/)[0];
    if (actualSha !== expectedSha) {
      throw new Error(`Checksum mismatch: sha256sum=${actualSha}, file=${expectedSha}`);
    }

    const payload = JSON.parse((await execRemote(conn, buildPayloadReader(paths.archivePath))).trim());
    if (payload.archive_date !== ARCHIVE_DATE) {
      throw new Error(`Archive date mismatch: expected ${ARCHIVE_DATE}, got ${payload.archive_date}`);
    }

    console.log(JSON.stringify({
      ok: true,
      apply: true,
      host: HOST,
      date: ARCHIVE_DATE,
      test_root: TEST_ROOT,
      archivePath: paths.archivePath,
      checksumPath: paths.checksumPath,
      sha256: actualSha,
      payload,
      archive_output: archiveOutput.trim(),
      validations: {
        archive_exists: true,
        checksum_exists: true,
        gzip_test: true,
        checksum_matches: true,
        json_parse: true,
      },
      forbidden_actions: FORBIDDEN_ACTIONS,
    }, null, 2));
  } finally {
    conn.end();
  }
}

async function main() {
  if (!APPLY) {
    printPlan();
    return;
  }
  await runWriteTest();
}

main().catch((err) => {
  console.error('[test-autoresponder-archive-vps-write] failed:', err.message);
  process.exitCode = 1;
});
