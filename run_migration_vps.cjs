/**
 * run_migration_vps.cjs
 * Detecta o DB_NAME do .env da VPS e roda o ALTER TABLE via SSH.
 * Uso: node run_migration_vps.cjs
 */
const { Client } = require('ssh2');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';

function ssh(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '', stderr = '';
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        stream.on('data', d => stdout += d.toString());
        stream.stderr.on('data', d => stderr += d.toString());
        stream.on('close', code => { conn.end(); resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }); });
      });
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

async function run() {
  // 1. Descobre o DB_NAME lendo o .env da VPS
  console.log('🔍 Lendo .env da VPS para descobrir DB_NAME...');
  const envResult = await ssh("cat /var/www/mdv-api/.env | grep DB_NAME");
  console.log('  Linha encontrada:', envResult.stdout || '(vazio)');

  const match = envResult.stdout.match(/DB_NAME\s*=\s*(.+)/);
  const dbName = match ? match[1].trim().replace(/['"]/g, '') : null;

  if (!dbName) {
    console.log('  DB_NAME não encontrado. Listando bancos disponíveis...');
    const list = await ssh("mysql -u root -e 'SHOW DATABASES;'");
    console.log('  Bancos:\n', list.stdout || list.stderr);
    throw new Error('Não foi possível detectar DB_NAME. Ajuste o script com o banco correto.');
  }

  console.log(`✅ Banco detectado: "${dbName}"`);

  // 2. Verifica se a coluna já existe (compatível com MySQL 5.7)
  console.log('🔍 Verificando se extra_config já existe...');
  const check = await ssh(
    `mysql -u root ${dbName} -e "SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='shipping_settings' AND COLUMN_NAME='extra_config';"`
  );
  const alreadyExists = check.stdout.includes('1');

  if (alreadyExists) {
    console.log('✅ Coluna extra_config já existe! Nada a fazer.');
    return;
  }

  // 3. ALTER TABLE sem IF NOT EXISTS (MySQL 5.7 compatível)
  console.log('🔧 Executando ALTER TABLE...');
  const alter = await ssh(
    `mysql -u root ${dbName} -e "ALTER TABLE shipping_settings ADD COLUMN extra_config JSON NULL;"`
  );

  if (alter.code !== 0) {
    console.error('❌ Erro:', alter.stderr);
    throw new Error('ALTER TABLE falhou');
  }
  console.log('✅ ALTER TABLE executado!');

  // 4. Verifica
  const desc = await ssh(`mysql -u root ${dbName} -e "DESCRIBE shipping_settings;"`);
  if (desc.stdout.includes('extra_config')) {
    console.log('✅ Coluna extra_config confirmada na tabela!');
  } else {
    console.log('Colunas da tabela:\n', desc.stdout);
  }
}

run().catch(err => { console.error('❌ Erro fatal:', err.message); process.exit(1); });
