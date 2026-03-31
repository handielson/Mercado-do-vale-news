/**
 * diagnostico-vps.cjs
 * Verifica o estado dos dados de produtos na VPS:
 * - Quantos têm imagens reais (URLs) vs base64 vs vazio
 * - Quantos têm descrição
 * - Amostra de produtos com problemas
 *
 * Uso: node diagnostico-vps.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });


const VPS_BASE = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SYNC_KEY) { console.error('❌ VITE_VPS_SYNC_KEY não encontrada em .env.local'); process.exit(1); }

// ── Funções de fetch ──────────────────────────────────────────────────────────

async function fetchVpsPage(offset, limit = 100) {
  const url = `${VPS_BASE}/products?limit=${limit}&offset=${offset}&status=all`;
  const res = await fetch(url, { headers: { 'X-Sync-Key': SYNC_KEY } });
  if (!res.ok) throw new Error(`VPS error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchSupabaseSample(skus) {
  // Busca description de até 10 SKUs do Supabase para comparar
  const filter = skus.map(s => `"${s}"`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/products?select=sku,description,images&sku=in.(${filter})`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return res.json();
}

// ── Análise ───────────────────────────────────────────────────────────────────

function classifyImages(images) {
  if (!images) return 'null';
  let arr = images;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { return 'string_ruim'; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return 'vazio';
  const first = arr[0];
  if (typeof first !== 'string') return 'vazio';
  if (first.startsWith('data:')) return 'base64';
  if (first.startsWith('http')) return 'url';
  return 'desconhecido';
}

function classifyDescription(desc) {
  if (!desc || typeof desc !== 'string') return 'vazio';
  if (desc.trim().length === 0) return 'vazio';
  return 'tem';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Diagnóstico de dados na VPS...\n');

  // Busca todos os produtos
  let all = [];
  let offset = 0;
  const PAGE = 100;

  process.stdout.write('📥 Buscando produtos');
  while (true) {
    const page = await fetchVpsPage(offset, PAGE);
    if (!Array.isArray(page) || page.length === 0) break;
    all = all.concat(page);
    process.stdout.write('.');
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  console.log(` ${all.length} total\n`);

  // Contadores
  const counts = {
    total: all.length,
    active: 0,
    img_url: 0,
    img_base64: 0,
    img_vazio: 0,
    img_outro: 0,
    desc_tem: 0,
    desc_vazio: 0,
    specs_tem: 0,
    specs_vazio: 0,
    preco_ok: 0,
    preco_zero: 0,
  };

  const exemplos = {
    sem_imagem: [],
    base64: [],
    sem_descricao: [],
  };

  for (const p of all) {
    if (p.status === 'active') counts.active++;

    // Imagens
    const imgClass = classifyImages(p.images);
    if (imgClass === 'url')    counts.img_url++;
    else if (imgClass === 'base64') { counts.img_base64++; if (exemplos.base64.length < 3) exemplos.base64.push({ sku: p.sku, name: p.name?.slice(0,40) }); }
    else                        { counts.img_vazio++;   if (exemplos.sem_imagem.length < 5) exemplos.sem_imagem.push({ sku: p.sku, name: p.name?.slice(0,40) }); }

    // Descrição
    const descClass = classifyDescription(p.description);
    if (descClass === 'tem') counts.desc_tem++;
    else { counts.desc_vazio++; if (exemplos.sem_descricao.length < 5) exemplos.sem_descricao.push({ sku: p.sku, name: p.name?.slice(0,40) }); }

    // Specs
    const hasSpecs = p.technical_specifications && p.technical_specifications.trim().length > 0;
    if (hasSpecs) counts.specs_tem++; else counts.specs_vazio++;

    // Preço
    const preco = p.price_retail || p.price;
    if (preco && preco > 0) counts.preco_ok++; else counts.preco_zero++;
  }

  // Resumo
  console.log('════════════════════════════════════════');
  console.log('📊 RESUMO VPS');
  console.log('════════════════════════════════════════');
  console.log(`Total produtos:  ${counts.total}`);
  console.log(`Ativos:          ${counts.active}`);
  console.log('');
  console.log('🖼️  IMAGENS:');
  console.log(`  ✅ URL real:   ${counts.img_url}  (${pct(counts.img_url, counts.total)})`);
  console.log(`  ⚠️  Base64:    ${counts.img_base64}  (${pct(counts.img_base64, counts.total)}) ← sem URL acessível`);
  console.log(`  ❌ Sem imagem: ${counts.img_vazio}  (${pct(counts.img_vazio, counts.total)})`);
  console.log('');
  console.log('📝 DESCRIÇÃO:');
  console.log(`  ✅ Tem:        ${counts.desc_tem}  (${pct(counts.desc_tem, counts.total)})`);
  console.log(`  ❌ Vazio:      ${counts.desc_vazio}  (${pct(counts.desc_vazio, counts.total)})`);
  console.log('');
  console.log('📋 SPECS TÉCNICAS:');
  console.log(`  ✅ Tem:        ${counts.specs_tem}`);
  console.log(`  ❌ Vazio:      ${counts.specs_vazio}`);
  console.log('');
  console.log('💰 PREÇO:');
  console.log(`  ✅ OK:         ${counts.preco_ok}`);
  console.log(`  ❌ Zero/null:  ${counts.preco_zero}`);
  console.log('════════════════════════════════════════');

  if (exemplos.base64.length) {
    console.log('\n⚠️  Amostras com base64 (sem URL):');
    exemplos.base64.forEach(e => console.log(`  - ${e.sku}: ${e.name}`));
  }
  if (exemplos.sem_imagem.length) {
    console.log('\n❌ Amostras sem imagem:');
    exemplos.sem_imagem.forEach(e => console.log(`  - ${e.sku || '(sem sku)'}: ${e.name}`));
  }
  if (exemplos.sem_descricao.length) {
    console.log('\n❌ Amostras sem descrição:');
    exemplos.sem_descricao.forEach(e => console.log(`  - ${e.sku || '(sem sku)'}: ${e.name}`));
  }

  // Se houver produtos sem descrição, verifica no Supabase se existem lá
  const skusSemDesc = all.filter(p => !p.description?.trim() && p.sku).map(p => p.sku).slice(0, 10);
  if (skusSemDesc.length > 0 && SUPABASE_URL && SUPABASE_KEY) {
    console.log('\n🔁 Verificando Supabase para esses SKUs sem descrição...');
    try {
      const sbData = await fetchSupabaseSample(skusSemDesc);
      const comDescSupa = sbData.filter(p => p.description?.trim());
      const comImgSupa = sbData.filter(p => Array.isArray(p.images) && p.images.length > 0);
      console.log(`  No Supabase, desses ${skusSemDesc.length} SKUs:`);
      console.log(`  - ${comDescSupa.length} têm descrição no Supabase ← podemos sincronizar`);
      console.log(`  - ${comImgSupa.length} têm imagens no Supabase ← podemos sincronizar`);
    } catch (e) {
      console.log(`  ⚠️ Não foi possível checar Supabase: ${e.message}`);
    }
  }

  console.log('\n✅ Diagnóstico concluído.');
}

function pct(n, total) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
