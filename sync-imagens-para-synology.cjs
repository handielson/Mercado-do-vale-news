#!/usr/bin/env node
/**
 * sync-imagens-para-synology.cjs
 *
 * Sincroniza imagens de produtos da VPS para o Synology NAS.
 * Usa o SynologyDrive montado localmente, sem precisar da API do Synology.
 *
 * FLUXO:
 *   1. Lista todas as imagens na VPS via GET /images/list
 *   2. Para cada imagem, verifica se já existe no Synology local
 *   3. Se não existir, baixa da VPS e salva no SynologyDrive
 *   4. O cliente SynologyDrive sincroniza automaticamente para o NAS
 *
 * USO:
 *   node sync-imagens-para-synology.cjs           → Sync incremental (só novas)
 *   node sync-imagens-para-synology.cjs --force   → Força re-download de todas
 *   node sync-imagens-para-synology.cjs --dry-run → Só lista, não baixa
 */

require('dotenv').config({ path: '.env.local' });

const fs   = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════

const VPS_BASE   = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY   = process.env.VITE_VPS_SYNC_KEY;

// Pasta raiz do SynologyDrive montado localmente
const SYNOLOGY_BASE = 'C:\\Users\\Nitro\\SynologyDrive\\SynologyDrive';
// Pasta de backup de imagens no Synology
const PASTA_DESTINO = path.join(SYNOLOGY_BASE, 'backup-mercadodovale', 'imagens', 'products');

const MODO_FORCE   = process.argv.includes('--force');
const MODO_DRY_RUN = process.argv.includes('--dry-run');

// ═══════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════

if (!SYNC_KEY) {
  console.error('❌ VITE_VPS_SYNC_KEY não configurada no .env.local');
  process.exit(1);
}

if (!fs.existsSync(SYNOLOGY_BASE)) {
  console.error(`❌ SynologyDrive não encontrado em: ${SYNOLOGY_BASE}`);
  console.error('   Verifique se o Synology Drive Client está rodando e sincronizado.');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════
// LISTAR IMAGENS NA VPS
// ═══════════════════════════════════════════════════════════

async function listarImagensVPS() {
  const url = `${VPS_BASE}/images/list?prefix=products`;
  console.log(`\n📡 Buscando lista de imagens na VPS...`);
  console.log(`   URL: ${url}`);

  const res = await fetch(url, {
    headers: { 'X-Sync-Key': SYNC_KEY },
  });

  if (!res.ok) {
    throw new Error(`VPS retornou ${res.status}: ${res.statusText}`);
  }

  const imagens = await res.json();
  if (!Array.isArray(imagens)) {
    throw new Error(`Resposta inesperada da VPS: ${JSON.stringify(imagens)}`);
  }

  return imagens;
  // Cada item tem: { path: "products/SKU/arquivo.webp", url: "...", filename: "..." }
}

// ═══════════════════════════════════════════════════════════
// BAIXAR UMA IMAGEM
// ═══════════════════════════════════════════════════════════

async function baixarImagem(imagemPath) {
  const url = `${VPS_BASE}/images/${imagemPath}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao baixar ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ═══════════════════════════════════════════════════════════
// SALVAR NO SYNOLOGY
// ═══════════════════════════════════════════════════════════

function salvarNoSynology(imagemPath, buffer) {
  // imagemPath = "products/SKU-XPTO/imagem-001.webp"
  // remove o prefixo "products/" pois já está em PASTA_DESTINO/products/
  const relPath = imagemPath.startsWith('products/')
    ? imagemPath.slice('products/'.length)
    : imagemPath;

  const destino = path.join(PASTA_DESTINO, relPath);
  const dir = path.dirname(destino);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(destino, buffer);
  return destino;
}

// ═══════════════════════════════════════════════════════════
// VERIFICAR SE JÁ EXISTE
// ═══════════════════════════════════════════════════════════

function jaExiste(imagemPath) {
  const relPath = imagemPath.startsWith('products/')
    ? imagemPath.slice('products/'.length)
    : imagemPath;
  const destino = path.join(PASTA_DESTINO, relPath);
  return fs.existsSync(destino);
}

// ═══════════════════════════════════════════════════════════
// FORMATAR BYTES
// ═══════════════════════════════════════════════════════════

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ═══════════════════════════════════════════════════════════
// SINCRONIZAR
// ═══════════════════════════════════════════════════════════

async function sincronizar() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    MERCADO DO VALE — SYNC DE IMAGENS VPS → SYNOLOGY      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (MODO_DRY_RUN) console.log('\n  🔍 MODO DRY-RUN — nada será baixado');
  if (MODO_FORCE)   console.log('\n  ⚡ MODO FORCE — re-download de todas as imagens');

  // 1. Listar imagens
  const imagens = await listarImagensVPS();
  console.log(`\n✅ ${imagens.length} imagem(ns) encontrada(s) na VPS\n`);

  if (imagens.length === 0) {
    console.log('Nenhuma imagem para sincronizar.');
    return;
  }

  // 2. Criar pasta destino
  if (!MODO_DRY_RUN && !fs.existsSync(PASTA_DESTINO)) {
    fs.mkdirSync(PASTA_DESTINO, { recursive: true });
    console.log(`📁 Pasta criada: ${PASTA_DESTINO}\n`);
  }

  // 3. Processar cada imagem
  let sincronizadas = 0;
  let puladas       = 0;
  let erros         = 0;
  let totalBytes    = 0;

  for (let i = 0; i < imagens.length; i++) {
    const img = imagens[i];
    const imagemPath = img.path; // ex: "products/SKU-XPT/foto.webp"
    const progresso  = `[${String(i + 1).padStart(4)} / ${imagens.length}]`;

    // Verificar se já existe (skip incremental)
    if (!MODO_FORCE && jaExiste(imagemPath)) {
      process.stdout.write(`  ${progresso} ⏭  ${imagemPath}\n`);
      puladas++;
      continue;
    }

    if (MODO_DRY_RUN) {
      process.stdout.write(`  ${progresso} 🔍  ${imagemPath} → (dry-run)\n`);
      sincronizadas++;
      continue;
    }

    process.stdout.write(`  ${progresso} ⬇  ${imagemPath}... `);

    try {
      const buffer  = await baixarImagem(imagemPath);
      const destino = salvarNoSynology(imagemPath, buffer);
      totalBytes += buffer.length;
      console.log(`✅ (${formatBytes(buffer.length)})`);
      sincronizadas++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      erros++;
    }

    // Pequena pausa para não sobrecarregar a VPS
    await new Promise(r => setTimeout(r, 50));
  }

  // 4. Relatório final
  console.log('\n' + '═'.repeat(60));
  console.log(`  ✅ Sincronizadas : ${sincronizadas}`);
  console.log(`  ⏭  Já existiam  : ${puladas}`);
  console.log(`  ❌ Erros         : ${erros}`);
  if (!MODO_DRY_RUN && totalBytes > 0) {
    console.log(`  📦 Total baixado : ${formatBytes(totalBytes)}`);
  }
  console.log('═'.repeat(60));
  console.log(`\n📂 Destino: ${PASTA_DESTINO}`);

  if (!MODO_DRY_RUN && sincronizadas > 0) {
    console.log('\n⏳ O SynologyDrive vai sincronizar os arquivos automaticamente.');
    console.log('   Você pode verificar o status no ícone da bandeja do SynologyDrive.');
  }

  console.log('');
}

sincronizar().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
