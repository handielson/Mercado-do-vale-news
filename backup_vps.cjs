/**
 * backup_vps.cjs
 * Faz backup completo de todos os produtos da VPS para um arquivo JSON local.
 * Execute sempre antes de rodar qualquer script de migração ou atualização.
 *
 * Uso: node backup_vps.cjs
 * O arquivo de backup é salvo em: ./backups/vps_backup_YYYY-MM-DD_HH-MM-SS.json
 */

require('dotenv').config({ path: ['.env.local', '.env'] });
const fs = require('fs');
const path = require('path');

const vpsUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const BACKUP_DIR = path.join(__dirname, 'backups');

async function run() {
  console.log('=== BACKUP DA VPS ===');

  // Garante que a pasta de backups existe
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Pasta criada: ${BACKUP_DIR}`);
  }

  // 1. Busca todos os produtos (incluindo inativos)
  console.log('Baixando todos os produtos da VPS...');
  let allProducts = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const res = await fetch(`${vpsUrl}/products?status=all&limit=${limit}&page=${page}`);
    if (!res.ok) {
      console.error(`Erro ao buscar página ${page}:`, await res.text());
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allProducts = allProducts.concat(data);
    console.log(`  Página ${page}: ${data.length} produtos (total: ${allProducts.length})`);
    if (data.length < limit) break;
    page++;
  }

  console.log(`\nTotal de produtos encontrados: ${allProducts.length}`);

  // 2. Salva o arquivo com timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `vps_backup_${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  const backup = {
    created_at: now.toISOString(),
    total: allProducts.length,
    products: allProducts,
  };

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`\n✅ Backup salvo em: ${filepath}`);
  console.log(`   Arquivo: ${filename}`);
  console.log(`   Tamanho: ${(fs.statSync(filepath).size / 1024).toFixed(1)} KB`);
  console.log('\nGuarde este arquivo antes de rodar qualquer script de atualização em massa.');
}

run().catch(err => {
  console.error('Erro fatal no backup:', err);
  process.exit(1);
});
