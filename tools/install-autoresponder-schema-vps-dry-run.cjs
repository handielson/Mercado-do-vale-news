#!/usr/bin/env node

const { Client } = require('ssh2');

const HOST = process.env.VPS_HOST || '76.13.232.162';
const USER = process.env.VPS_USER || 'root';
const PASS = process.env.VPS_ROOT_PASSWORD;
const APPLY = process.env.AUTORESPONDER_SCHEMA_INSTALL_APPLY === '1';

const TABLES = [
  'autoresponder_settings',
  'autoresponder_rules',
  'autoresponder_tags',
  'autoresponder_logs',
  'autoresponder_conversations',
  'autoresponder_blocklist',
];

const SQL_SNIPPETS = [
  `CREATE TABLE IF NOT EXISTS autoresponder_settings (
    id INT PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    human_message_in_hours TEXT NULL,
    human_message_out_of_hours TEXT NULL,
    human_pause_minutes INT NOT NULL DEFAULT 60,
    auto_pause_fallback_threshold INT NOT NULL DEFAULT 3,
    auto_pause_fallback_minutes INT NOT NULL DEFAULT 30,
    auto_pause_fallback_message TEXT NULL,
    max_replies_per_conversation INT NOT NULL DEFAULT 20,
    max_replies_window_hours INT NOT NULL DEFAULT 24,
    greeting_prefix TEXT NULL,
    fallback_message TEXT NULL,
    send_product_images TINYINT(1) NOT NULL DEFAULT 1,
    max_images_per_response INT NOT NULL DEFAULT 1,
    use_numbered_lists TINYINT(1) NOT NULL DEFAULT 1,
    numbered_list_threshold INT NOT NULL DEFAULT 2,
    numbered_list_validity_minutes INT NOT NULL DEFAULT 30,
    product_tag_keywords JSON NULL,
    archive_to_synology TINYINT(1) NOT NULL DEFAULT 1,
    archive_after_days INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `INSERT IGNORE INTO autoresponder_settings (
    id,
    enabled,
    human_message_in_hours,
    human_message_out_of_hours,
    auto_pause_fallback_message,
    greeting_prefix,
    fallback_message,
    product_tag_keywords
  ) VALUES (
    1,
    0,
    'Transferindo para um especialista, por favor aguarde.',
    'Transferindo para um especialista. No momento estamos fora do horario de atendimento humanizado, entao a resposta pode demorar mais.',
    'Vou chamar um atendente para te ajudar melhor.',
    'Ola!',
    'Atendimento automatico em configuracao. Um atendente vai te responder em breve.',
    JSON_OBJECT()
  )`,

  `CREATE TABLE IF NOT EXISTS autoresponder_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    match_type ENUM('any_keyword','all_keywords','regex','exact') NOT NULL DEFAULT 'any_keyword',
    pattern TEXT NOT NULL,
    reply_type ENUM('text','product_by_tag','product_search') NOT NULL DEFAULT 'text',
    reply_text TEXT NULL,
    reply_tag_id INT NULL,
    reply_search_query VARCHAR(255) NULL,
    attachment_url VARCHAR(500) NULL,
    attachment_caption TEXT NULL,
    auto_apply_tag_id INT NULL,
    tag_ids JSON NULL,
    priority INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    hits INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_priority (active, priority)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS autoresponder_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    description VARCHAR(200) NULL,
    scopes SET('rule','conversation','product') NOT NULL,
    show_on_bot TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS autoresponder_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender VARCHAR(30) NULL,
    question TEXT NULL,
    intent VARCHAR(30) NULL,
    matched_rule_id BIGINT NULL,
    matched_products JSON NULL,
    matched_count INT NOT NULL DEFAULT 0,
    reply_text TEXT NULL,
    response_time_ms INT NULL,
    is_group TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_created (created_at),
    INDEX idx_unmatched (matched_count, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS autoresponder_conversations (
    sender VARCHAR(30) PRIMARY KEY,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_bot_reply_at TIMESTAMP NULL,
    paused_until TIMESTAMP NULL,
    pause_reason VARCHAR(50) NULL,
    paused_by_user_id INT NULL,
    consecutive_fallbacks INT NOT NULL DEFAULT 0,
    total_messages INT NOT NULL DEFAULT 0,
    tag_ids JSON NULL,
    last_options_offered JSON NULL,
    last_options_at TIMESTAMP NULL,
    INDEX idx_paused (paused_until)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS autoresponder_blocklist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pattern VARCHAR(100) NOT NULL,
    pattern_type ENUM('exact','prefix','regex') NOT NULL DEFAULT 'exact',
    contact_name VARCHAR(255) NULL,
    reason TEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INT NULL,
    INDEX idx_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

function buildRemoteScript() {
  return `
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\\r?\\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const envPath = '/var/www/mdv-api/.env';
const env = loadEnv(envPath);
const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 2,
});

const sqlSnippets = ${JSON.stringify(SQL_SNIPPETS)};
const tables = ${JSON.stringify(TABLES)};

async function tableExists(tableName) {
  const [rows] = await pool.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [tableName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await tableExists(tableName))) return { table: tableName, column: columnName, skipped: 'missing_table' };
  const [rows] = await pool.query(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [tableName, columnName]
  );
  if (rows.length > 0) return { table: tableName, column: columnName, changed: false };
  await pool.query(\`ALTER TABLE \\\`\${tableName}\\\` ADD COLUMN \\\`\${columnName}\\\` \${definition}\`);
  return { table: tableName, column: columnName, changed: true };
}

async function listTables() {
  const [rows] = await pool.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?) ORDER BY table_name',
    [tables]
  );
  return rows.map((row) => row.TABLE_NAME || row.table_name);
}

async function main() {
  const before = await listTables();
  for (const sql of sqlSnippets) await pool.query(sql);
  const productsTagIds = await addColumnIfMissing('products', 'tag_ids', 'JSON NULL');
  const after = await listTables();
  console.log(JSON.stringify({
    ok: true,
    env_path: envPath,
    database: env.DB_NAME,
    tables_before: before,
    tables_after: after,
    products_tag_ids: productsTagIds,
    forbidden_actions: [
      'pm2 is not restarted',
      'crontab is not changed',
      'no data is deleted'
    ]
  }, null, 2));
}

main().catch((err) => {
  console.error('[remote-autoresponder-schema] failed:', err);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
`;
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
          reject(new Error(stderr.trim() || stdout.trim() || `Remote command exited ${code}`));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

function printPlan() {
  console.log(JSON.stringify({
    ok: true,
    apply: false,
    host: HOST,
    user: USER,
    target_env: '/var/www/mdv-api/.env',
    creates_if_missing: TABLES,
    alters_if_missing: [{ table: 'products', column: 'tag_ids', definition: 'JSON NULL' }],
    seeds_if_missing: ['autoresponder_settings id=1'],
    forbidden_actions: [
      'pm2 is not restarted',
      'crontab is not changed',
      'no data is deleted',
    ],
    next: 'Set AUTORESPONDER_SCHEMA_INSTALL_APPLY=1 and VPS_ROOT_PASSWORD to apply the idempotent schema preflight.',
  }, null, 2));
}

async function applySchema() {
  if (!PASS) {
    throw new Error('Missing VPS_ROOT_PASSWORD. Refusing to connect without an explicit runtime password.');
  }
  const conn = await connect();
  try {
    const encoded = Buffer.from(buildRemoteScript(), 'utf8').toString('base64');
    const output = await execRemote(conn, `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`);
    process.stdout.write(output);
  } finally {
    conn.end();
  }
}

async function main() {
  if (!APPLY) {
    printPlan();
    return;
  }
  await applySchema();
}

main().catch((err) => {
  console.error('[install-autoresponder-schema-vps-dry-run] failed:', err.message);
  process.exitCode = 1;
});
