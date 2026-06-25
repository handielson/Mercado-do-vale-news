/**
 * estorno-cc7162aa.cjs  — v3
 * Usa SSH direto (spawn) para rodar queries no MySQL e VPS API para estorno
 */
'use strict';

const { spawnSync } = require('child_process');
const https = require('https');

const VPS_HOST  = '76.13.232.162';
const VPS_USER  = 'root';
const SSH_KEY   = 'C:\\Users\\Nitro\\.ssh\\mdv-vps-nitro-20260612';
const VPS_BASE  = 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY  = 'f7a0e7265086423bca33a8c4089fdf59240df5fea80d1ebd159fdad2aaf08bd7';
const DB_NAME   = 'mercadodovale';
const SALE_PRE  = 'cc7162aa';
const REASON    = 'Estorno manual cancelamento PDV cc7162aa';

// ─── SSH helper (usa array de args, sem shell) ──────────────────────────────
function ssh(cmd) {
  const result = spawnSync('ssh', [
    '-i', SSH_KEY,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=10',
    `${VPS_USER}@${VPS_HOST}`,
    cmd,
  ], { encoding: 'utf8', timeout: 30000 });

  if (result.error) throw new Error(`SSH error: ${result.error.message}`);
  const combined = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0) throw new Error(`SSH status ${result.status}: ${combined.trim()}`);
  return result.stdout.trim();
}

// ─── MySQL helper via SSH ───────────────────────────────────────────────────
function mysqlQ(sql) {
  const raw = ssh(`mysql ${DB_NAME} --batch --silent -e "${sql.replace(/"/g, '\\"')}"`);
  if (!raw) return [];
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const cols = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const vals = line.split('\t');
    const obj = {};
    cols.forEach((c, i) => { obj[c.trim()] = vals[i] === 'NULL' ? null : (vals[i] || '').trim(); });
    return obj;
  });
}

// ─── fetch via Node https (sem ESM fetch) ──────────────────────────────────
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-sync-key': SYNC_KEY,
        ...headers,
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json; try { json = JSON.parse(data); } catch { json = { raw: data }; }
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        resolve(json);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ESTORNO MANUAL — Pedido #cc7162aa');
  console.log(`  ${new Date().toLocaleString('pt-BR')}`);
  console.log('═══════════════════════════════════════════════════════');

  // 1. Venda ─────────────────────────────────────────────────────────────────
  console.log('\n🔍 Consultando venda…');
  const sales = mysqlQ(`SELECT id, status, total_cents, created_at FROM sales WHERE id LIKE '${SALE_PRE}%' LIMIT 5`);
  if (!sales.length) { console.error('❌ Venda não encontrada!'); process.exit(1); }
  const sale = sales[0];
  const saleId = sale.id;
  console.log(`✔  ID:      ${saleId}`);
  console.log(`   Status:  ${sale.status}`);
  console.log(`   Total:   R$ ${((Number(sale.total_cents) || 0) / 100).toFixed(2)}`);
  console.log(`   Criado:  ${sale.created_at}`);

  // 2. Itens ─────────────────────────────────────────────────────────────────
  console.log('\n📦 Itens da venda…');
  const items = mysqlQ(
    `SELECT si.id, si.product_id, si.quantity, p.name AS product_name, p.bling_id, p.sku
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = '${saleId}'`
  );
  if (!items.length) { console.error('❌ Sem itens na venda!'); process.exit(1); }
  items.forEach((it, i) => {
    console.log(`  ${i+1}. ${it.product_name || it.product_id} | qty: ${it.quantity} | bling_id: ${it.bling_id || '-'} | sku: ${it.sku || '-'}`);
  });

  // 3. Movimentos existentes ─────────────────────────────────────────────────
  console.log('\n🔎 Movimentos de estoque existentes…');
  const movs = mysqlQ(
    `SELECT movement_type, reference_type, product_id, quantity, created_at
     FROM stock_location_movements
     WHERE reference_id = '${saleId}'
     ORDER BY created_at ASC`
  );
  if (!movs.length) {
    console.warn('  ⚠️  NENHUM movimento de estoque registrado para esta venda!');
    console.warn('     Isso confirma por que o estorno automático falhou.');
  } else {
    movs.forEach(m => {
      console.log(`   • [${m.movement_type}] produto: ${m.product_id} | qty: ${m.quantity} | ${m.created_at}`);
    });
  }
  const hasOrigSale = movs.some(m => m.movement_type === 'sale');
  const alreadyCancelled = movs.some(m => m.movement_type === 'cancel');

  if (alreadyCancelled) console.warn('\n⚠️  Já existe um movimento "cancel" — estoque pode já ter sido estornado!');

  // 4. Estorno VPS ───────────────────────────────────────────────────────────
  console.log('\n🔄 Chamando VPS /stock-locations/sale-restores…');
  let vpsResult;
  try {
    vpsResult = await httpPost(`${VPS_BASE}/stock-locations/sale-restores`, {
      sale_id: saleId,
      reason: REASON,
      notes: `Estorno manual ${new Date().toISOString()}`,
    });
    if (Array.isArray(vpsResult) && vpsResult.length === 0) {
      console.warn('  ⚠️  VPS retornou [] — sem movimentos para estornar via location.');
    } else {
      console.log(`  ✅ Estornado: ${JSON.stringify(vpsResult, null, 2)}`);
    }
  } catch (e) {
    console.error('  ❌ Erro VPS:', e.message);
    vpsResult = { error: e.message };
  }

  // 5. Se VPS não tinha movimentos, faz ajuste direto de estoque no banco ─────
  if (Array.isArray(vpsResult) && vpsResult.length === 0 && !hasOrigSale) {
    console.log('\n📝 Ajustando estoque diretamente na tabela products (fallback)…');
    for (const item of items) {
      if (!item.product_id) continue;
      const qty = Number(item.quantity || 1);
      const name = item.product_name || item.product_id;
      ssh(`mysql ${DB_NAME} -e "UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + ${qty}, updated_at = NOW() WHERE id = '${item.product_id}'"`);
      // Insere movimento de ajuste manual
      ssh(`mysql ${DB_NAME} -e "INSERT INTO stock_location_movements (id, company_id, product_id, quantity, movement_type, reason, reference_type, reference_id, notes, created_at, updated_at) SELECT UUID(), company_id, id, ${qty}, 'adjustment', '${REASON}', 'manual_restore', '${saleId}', 'Estorno manual - sem movimentos originais', NOW(), NOW() FROM products WHERE id = '${item.product_id}' LIMIT 1"`);
      const check = mysqlQ(`SELECT stock_quantity FROM products WHERE id = '${item.product_id}' LIMIT 1`);
      console.log(`  ✅ "${name}" +${qty} → novo estoque: ${check[0]?.stock_quantity ?? '?'}`);
    }
  }

  // 6. Sync Bling ────────────────────────────────────────────────────────────
  console.log('\n🔗 Sincronizando entradas no Bling…');
  const blingResults = [];

  for (const item of items) {
    const blingId = item.bling_id ? Number(item.bling_id) : null;
    const qty = Number(item.quantity || 1);
    const name = item.product_name || item.product_id;

    if (!blingId) {
      console.log(`  ℹ️  "${name}" — sem bling_id`);
      blingResults.push({ product: name, status: 'sem_bling_id' });
      continue;
    }

    // Tenta endpoint /bling/stock-entry
    try {
      const r = await httpPost(`${VPS_BASE}/bling/stock-entry`, {
        blingId,
        quantity: qty,
        notes: REASON,
      });
      console.log(`  ✅ "${name}" (bling_id=${blingId}) → +${qty}`);
      blingResults.push({ product: name, bling_id: blingId, quantity: qty, status: 'ok', r });
    } catch (e) {
      // Se endpoint não existir, tenta /api/bling?resource=stock-sync com operacao E
      console.warn(`  ⚠️  /bling/stock-entry falhou: ${e.message}`);
      blingResults.push({ product: name, bling_id: blingId, quantity: qty, status: 'bling_endpoint_error', error: e.message });
    }
  }

  // ─── Relatório ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Venda:     ${saleId} | ${sale.status}`);
  console.log(`VPS:       ${JSON.stringify(vpsResult)}`);
  console.log(`Bling:     ${JSON.stringify(blingResults)}`);

  // Verifica estoque final dos produtos
  console.log('\n📊 Estoque atual dos produtos após estorno:');
  for (const item of items) {
    if (!item.product_id) continue;
    const result = mysqlQ(`SELECT name, stock_quantity FROM products WHERE id = '${item.product_id}' LIMIT 1`);
    const r = result[0];
    console.log(`  • ${r?.name || item.product_id}: ${r?.stock_quantity ?? '?'} unidade(s)`);
  }
}

main().catch(err => {
  console.error('\n💥 Erro fatal:', err?.message || err);
  process.exit(1);
});
