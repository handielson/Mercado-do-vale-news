/**
 * migrate-base64-to-urls.cjs
 *
 * Migra imagens base64 do banco MySQL para arquivos na VPS.
 * Para cada produto com imagem base64:
 *   1. Decodifica o base64
 *   2. Salva como .webp em /var/www/mdv-api/uploads/products/{id}/
 *   3. Atualiza o campo `images` no banco para URL HTTP
 *
 * Uso:
 *   node migrate-base64-to-urls.cjs            → processa todos (dry-run primeiro)
 *   node migrate-base64-to-urls.cjs --dry-run  → mostra o que seria feito
 *   node migrate-base64-to-urls.cjs --limit 10 → processa só 10 produtos
 */
const { execSync } = require('child_process');
const fs = require('fs');

const HOST     = '76.13.232.162';
const USER_SSH = 'root';
const PASS_SSH = '@@@@Jsj2865@@@@';
const VPS_BASE = 'https://api.xiaomipetrolina.com.br';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1]) : 0; // 0 = sem limite
})();

async function run() {
  // Garantir ssh2
  try { require.resolve('ssh2'); } catch (_) {
    execSync('npm install ssh2 --no-save', { stdio: 'inherit' });
  }
  const { Client } = require('ssh2');

  const exec = (conn, cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('data', d => { out += d; });
      stream.stderr.on('data', d => { errOut += d; });
      stream.on('close', code => code !== 0 ? reject(new Error(errOut || 'exit ' + code)) : resolve(out));
    });
  });

  // Abre UMA sessao SFTP e reutiliza para todos os uploads
  const openSftp = (conn) => new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  const writeFile = (sftp, remotePath, buffer) => new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath);
    stream.on('close', resolve);
    stream.on('error', reject);
    stream.end(buffer);
  });

  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log('Conectado a VPS:', HOST);
      if (DRY_RUN) console.log('MODO DRY-RUN — nada sera alterado no banco\n');

      try {
        // Abre sessao SFTP unica para todos os uploads
        const sftp = DRY_RUN ? null : await openSftp(conn);
        // Ler credenciais do .env
        const envRaw = await exec(conn, 'cat /var/www/mdv-api/.env');
        const env = {};
        for (const line of envRaw.split('\n')) {
          const m = line.match(/^([^=]+)=(.*)$/);
          if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
        }
        const dbUser = env.DB_USER || 'root';
        const dbPass = env.DB_PASS || '';
        const dbName = env.DB_NAME || '';
        const C = `mysql -u "${dbUser}" -p"${dbPass}" "${dbName}" --batch --skip-column-names`;

        // Buscar produtos com imagem base64
        const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : '';
        const queryOut = await exec(conn,
          `${C} -e "SELECT id, images FROM products WHERE images IS NOT NULL AND images LIKE '%data:image%' ${limitClause}"`
        );

        const rows = queryOut.trim().split('\n').filter(Boolean);
        console.log(`Produtos com base64: ${rows.length}\n`);

        if (rows.length === 0) {
          console.log('Nenhum produto com base64 encontrado. Migracao ja completa!');
          conn.end(); resolve(null); return;
        }

        let ok = 0, skip = 0, erros = 0;

        for (let i = 0; i < rows.length; i++) {
          const parts  = rows[i].split('\t');
          const prodId = parts[0].trim();
          let   images;

          try {
            images = JSON.parse(parts[1].trim());
          } catch (_) {
            console.log(`[${i+1}/${rows.length}] ${prodId} — JSON invalido, pulando`);
            skip++; continue;
          }

          if (!Array.isArray(images) || images.length === 0) {
            skip++; continue;
          }

          const newUrls = [];
          let changed = false;

          for (let j = 0; j < images.length; j++) {
            const img = images[j];

            // Ja e URL HTTP — manter
            if (typeof img === 'string' && img.startsWith('http')) {
              newUrls.push(img);
              continue;
            }

            // Base64 — converter e fazer upload
            if (typeof img === 'string' && img.startsWith('data:image')) {
              const match = img.match(/^data:image\/([\w+]+);base64,(.+)$/);
              if (!match) { newUrls.push(img); continue; }

              const ext    = match[1] === 'jpeg' ? 'jpg' : match[1];
              const buffer = Buffer.from(match[2], 'base64');
              const fname  = `img-${j + 1}.${ext}`;
              const dir    = `/var/www/mdv-api/uploads/products/${prodId}`;
              const remote = `${dir}/${fname}`;
              const url    = `${VPS_BASE}/images/products/${prodId}/${fname}`;

              process.stdout.write(`[${i+1}/${rows.length}] ${prodId} img${j+1} (${(buffer.length/1024).toFixed(0)}KB)... `);

              if (DRY_RUN) {
                console.log(`-> ${url} [dry-run]`);
                newUrls.push(url);
                changed = true;
              } else {
                try {
                  // Use SFTP stat/mkdir to avoid opening new SSH channels with exec
                  try {
                    await new Promise((res, rej) => sftp.stat(dir, err => err ? rej(err) : res()));
                  } catch (err) {
                    // Try to create parent then dir
                    const parentDir = `/var/www/mdv-api/uploads/products`;
                    await new Promise(r => sftp.mkdir(parentDir, () => r()));
                    await new Promise(r => sftp.mkdir(dir, () => r()));
                  }
                    
                  await writeFile(sftp, remote, buffer); // reutiliza sessao SFTP
                  newUrls.push(url);
                  changed = true;
                  console.log('OK');
                } catch (e) {
                  console.log('ERRO: ' + e.message);
                  newUrls.push(img);
                  erros++;
                }
              }
            } else {
              newUrls.push(img); // outro formato — manter
            }
          }

          // Atualizar banco via SQL escrito em arquivo temporario (evita escaping de JSON)
          if (changed && !DRY_RUN) {
            const newJson = JSON.stringify(newUrls);
            // Escape apenas aspas simples no JSON (para uso dentro de string SQL)
            const jsonEscaped = newJson.replace(/'/g, "'\\''" );
            const sql = `UPDATE products SET images = '${jsonEscaped}' WHERE id = '${prodId}';`;
            // Encode em base64 e decodifica na VPS — elimina problemas de escaping no shell
            const sqlB64 = Buffer.from(sql).toString('base64');
            await exec(conn,
              `echo '${sqlB64}' | base64 -d | mysql -u "${dbUser}" -p"${dbPass}" "${dbName}"`
            );
            ok++;
          } else if (changed && DRY_RUN) {
            ok++;
          }
        }

        console.log(`\n=== RESULTADO ===`);
        console.log(`  Migrados : ${ok}`);
        console.log(`  Pulados  : ${skip}`);
        console.log(`  Erros    : ${erros}`);
        if (!DRY_RUN && ok > 0) {
          console.log('\nPROXIMO PASSO: Reative compact:true em services/catalogService.ts');
          console.log('Linha aprox. 56: adicione  compact: true,  nos dois blocos de getProducts');
        }

        conn.end(); resolve(null);
      } catch (e) {
        console.error('\nErro fatal:', e.message);
        conn.end(); reject(e);
      }
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER_SSH, password: PASS_SSH });
  });
}

run().catch(err => { console.error('Falha:', err.message); process.exit(1); });
