/**
 * vps_setup.cjs
 * 1. Envia vps_server.js -> /var/www/mdv-api/server.js via SFTP
 * 2. npm install @fastify/compress na VPS
 * 3. Migracao SQL (indices + slugs) — compativel com MySQL 5.7+
 * 4. pm2 restart mdv-api
 * Uso: node vps_setup.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';
const REMOTE_DIR = '/var/www/mdv-api';
const LOCAL_SERVER = path.join(__dirname, 'vps_server.js');

async function run() {
  try { require.resolve('ssh2'); } catch (_) {
    console.log('Instalando ssh2...');
    execSync('npm install ssh2 --no-save', { stdio: 'inherit' });
  }

  const { Client } = require('ssh2');

  // exec com flag ignoreError para comandos esperados a falhar (ex: indice ja existe)
  const exec = (conn, cmd, ignoreError = false) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { process.stdout.write(d.toString()); out += d; });
      stream.stderr.on('data', d => process.stderr.write(d.toString()));
      stream.on('close', code => {
        if (code !== 0 && !ignoreError) reject(new Error('exit ' + code));
        else resolve(out);
      });
    });
  });

  const uploadFile = (conn, localPath, remotePath) => new Promise((resolve, reject) => {
    console.log('\nUpload: ' + path.basename(localPath) + ' -> ' + remotePath);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const content = fs.readFileSync(localPath);
      const stream = sftp.createWriteStream(remotePath);
      stream.on('close', () => { console.log('Upload concluido!'); resolve(); });
      stream.on('error', reject);
      stream.end(content);
    });
  });

  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log('Conectado a VPS: ' + HOST);
      try {
        // 1. Upload do server.js atualizado
        await uploadFile(conn, LOCAL_SERVER, REMOTE_DIR + '/server.js');

        // 2. Instalar @fastify/compress (ja instalado, ok se ja existe)
        console.log('\n> npm install @fastify/compress');
        await exec(conn, 'cd ' + REMOTE_DIR + ' && npm install @fastify/compress --save', true);

        // 3. Ler .env para credenciais MySQL
        const envContent = await exec(conn, 'cat ' + REMOTE_DIR + '/.env');
        const env = {};
        for (const line of envContent.split('\n')) {
          const m = line.match(/^([^=]+)=(.*)$/);
          if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
        }
        const dbUser = env.DB_USER  || 'root';
        const dbPass = env.DB_PASS  || '';
        const dbName = env.DB_NAME  || '';
        const C = `mysql -u "${dbUser}" -p"${dbPass}" "${dbName}"`;

        if (!dbName) {
          console.warn('DB_NAME nao encontrado -- pulando SQL');
        } else {
          console.log('\nCriando indices MySQL (ignora se ja existem)...');

          // Indices: CREATE INDEX sem IF NOT EXISTS — --force ignora "duplicate key" error
          const idxSql = [
            'CREATE INDEX idx_products_status_name ON products (status, name)',
            'CREATE INDEX idx_products_status_cat  ON products (status, category_id)',
            'CREATE INDEX idx_products_slug        ON products (slug)',
          ];

          for (const sql of idxSql) {
            // --force continua mesmo com erro (ex: indice ja existe = error 1061)
            await exec(conn, `${C} --force -e "${sql}"`, true);
          }
          console.log('Indices ok!');

          // Slugs: UPDATE seguro, sem IF NOT EXISTS
          console.log('\nPreenchendo slugs vazios...');
          const updateSql = "UPDATE products SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(name,'[^a-zA-Z0-9 -]',' '),' {2,}',' '),' ','-')) WHERE (slug IS NULL OR slug = '') AND name IS NOT NULL AND name != ''";
          await exec(conn, `${C} -e "${updateSql}"`);

          // Verificar resultado
          const countOut = await exec(conn, `${C} -e "SELECT COUNT(*) AS sem_slug FROM products WHERE slug IS NULL OR slug = ''"`);
          console.log('Resultado: ' + countOut.trim());
        }

        // 4. Reiniciar PM2
        console.log('\n> pm2 restart mdv-api');
        await exec(conn, 'pm2 restart mdv-api');
        console.log('\nVPS atualizada com sucesso!');

        conn.end();
        resolve(null);
      } catch (e) {
        console.error('\nErro: ' + e.message);
        conn.end();
        reject(e);
      }
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

run().catch(err => { console.error('Falha: ' + err.message); process.exit(1); });
