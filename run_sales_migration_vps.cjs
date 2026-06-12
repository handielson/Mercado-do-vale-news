/**
 * run_sales_migration_vps.cjs
 * Adiciona novas colunas de logística, desconto e observações à tabela sales na VPS.
 * Uso: node run_sales_migration_vps.cjs
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
  console.log('🔍 Lendo .env da VPS para descobrir DB_NAME...');
  const envResult = await ssh("cat /var/www/mdv-api/.env | grep DB_NAME");
  const match = envResult.stdout.match(/DB_NAME\s*=\s*(.+)/);
  const dbName = match ? match[1].trim().replace(/['"]/g, '') : null;

  if (!dbName) {
    throw new Error('Não foi possível detectar DB_NAME na VPS.');
  }
  console.log(`✅ Banco detectado: "${dbName}"`);

  // Lista de colunas para adicionar à tabela sales
  const columnsToAdd = [
    { name: 'delivery_type', type: 'VARCHAR(100) NULL' },
    { name: 'delivery_person_id', type: 'CHAR(36) NULL' },
    { name: 'delivery_cost_store', type: 'INT DEFAULT 0' },
    { name: 'delivery_cost_customer', type: 'INT DEFAULT 0' },
    { name: 'delivery_total', type: 'INT DEFAULT 0' },
    { name: 'promotional_discount', type: 'INT DEFAULT 0' },
    { name: 'referral_code', type: 'VARCHAR(100) NULL' },
    { name: 'internal_notes', type: 'TEXT NULL' }
  ];

  for (const col of columnsToAdd) {
    console.log(`🔍 Verificando se a coluna '${col.name}' existe na tabela sales...`);
    const check = await ssh(
      `mysql -u root ${dbName} -e "SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='sales' AND COLUMN_NAME='${col.name}';"`
    );
    const alreadyExists = check.stdout.includes('1');

    if (alreadyExists) {
      console.log(`✅ Coluna '${col.name}' já existe.`);
    } else {
      console.log(`🔧 Adicionando coluna '${col.name}'...`);
      const alter = await ssh(
        `mysql -u root ${dbName} -e "ALTER TABLE sales ADD COLUMN ${col.name} ${col.type};"`
      );
      if (alter.code !== 0) {
        console.error(`❌ Erro ao adicionar coluna '${col.name}':`, alter.stderr);
        throw new Error(`ALTER TABLE para ${col.name} falhou`);
      }
      console.log(`✅ Coluna '${col.name}' adicionada com sucesso.`);
    }
  }

  console.log('🎉 Todas as migrações de colunas na VPS foram verificadas/concluídas!');
}

run().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
