#!/usr/bin/env node
/**
 * fix-expired-images.cjs
 *
 * Roda na VPS para corrigir produtos com imagens expiradas do Bling S3.
 *
 * FLUXO:
 *   1. Lê .env da VPS.
 *   2. Conecta ao banco local MySQL.
 *   3. Busca produtos que possuem URLs 'orgbling.s3.amazonaws.com' no campo `images`.
 *   4. Recupera e (se necessário) renova o Token do Bling no banco.
 *   5. Para cada produto:
 *      a. Faz requisição à API v3 do Bling para obter novas URLs assinadas.
 *      b. Baixa as imagens e salva direto no disco da VPS (/var/www/mdv-api/uploads/products/{sku}/).
 *      c. Atualiza as URLs no banco para o caminho local (ex: https://api.xiaomipetrolina.com.br/images/products/...).
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Carregar variáveis de ambiente da pasta atual (.env da VPS)
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || '';
const DB_PORT = process.env.DB_PORT || 3306;

const UPLOADS_DIR = '/var/www/mdv-api/uploads/products';
const VPS_BASE_URL = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';

function isExpiredSignedS3Url(url) {
  if (typeof url !== 'string' || !url.startsWith('https://orgbling.s3.amazonaws.com')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const expiresParam = parsed.searchParams.get('Expires');
    if (expiresParam && /^\d+$/.test(expiresParam)) {
      return Number(expiresParam) * 1000 <= Date.now();
    }
    const amzExpires = parsed.searchParams.get('X-Amz-Expires');
    const amzDate = parsed.searchParams.get('X-Amz-Date');
    if (amzExpires && amzDate && /^\d+$/.test(amzExpires)) {
      const match = amzDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const issuedAt = Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second)
        );
        return (issuedAt + Number(amzExpires) * 1000) <= Date.now();
      }
    }
  } catch (err) {
    // Ignore URL parsing errors
  }
  return false;
}

async function refreshBlingToken(settings, pool) {
  console.log('🔄 Renovando token do Bling...');
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', settings.bling_refresh_token);

  const basicAuth = Buffer.from(`${settings.bling_client_id}:${settings.bling_client_secret}`).toString('base64');
  const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao renovar token Bling (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();

  await pool.query(
    'UPDATE company_settings SET bling_access_token = ?, bling_refresh_token = ?, bling_token_expires_at = ? WHERE id = ?',
    [data.access_token, data.refresh_token || settings.bling_refresh_token, expiresAt, settings.id]
  );

  console.log('✅ Token do Bling renovado e salvo com sucesso!');
  return data.access_token;
}

async function getBlingAccessToken(pool) {
  const [rows] = await pool.query('SELECT id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret FROM company_settings LIMIT 1');
  if (!rows.length) {
    throw new Error('Configurações da empresa não encontradas no banco!');
  }
  const settings = rows[0];
  if (!settings.bling_access_token) {
    throw new Error('Integração do Bling não configurada (sem access_token)!');
  }

  const expiresAt = settings.bling_token_expires_at ? new Date(settings.bling_token_expires_at).getTime() : 0;
  const isExpired = expiresAt && expiresAt <= Date.now();

  if (isExpired) {
    return refreshBlingToken(settings, pool);
  }

  return settings.bling_access_token;
}

function extensionFromContentType(contentType, url) {
  if (contentType) {
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
  }
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).slice(1).toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {}
  return 'jpg';
}

async function run() {
  console.log('⚡ Iniciando correção de imagens do Bling...');
  
  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: DB_PORT
  });

  try {
    // 1. Obter Token do Bling
    const accessToken = await getBlingAccessToken(pool);
    
    // 2. Buscar produtos que contêm URLs orgbling no campo images
    const [products] = await pool.query(
      "SELECT id, sku, name, images, bling_id FROM products WHERE images LIKE '%orgbling.s3.amazonaws.com%' AND status = 'active'"
    );

    console.log(`🔍 Encontrados ${products.length} produtos ativos com imagens Bling S3.`);

    let corrigidos = 0;
    let falhas = 0;

    for (const prod of products) {
      let imagesList = [];
      try {
        imagesList = typeof prod.images === 'string' ? JSON.parse(prod.images) : (prod.images ?? []);
      } catch (err) {
        console.error(`❌ Erro ao parsear JSON de imagens do produto SKU: ${prod.sku}`);
        continue;
      }

      if (!Array.isArray(imagesList) || imagesList.length === 0) continue;

      // Verificar se realmente há imagens expiradas
      const hasExpired = imagesList.some(isExpiredSignedS3Url);
      if (!hasExpired) {
        console.log(`  ⏭️  Produto SKU ${prod.sku} tem URLs Bling mas nenhuma está expirada hoje.`);
        continue;
      }

      if (!prod.bling_id) {
        console.log(`  ⚠️  Produto SKU ${prod.sku} possui imagens do Bling S3 expiradas mas está sem bling_id!`);
        continue;
      }

      console.log(`🛠️ Corrigindo SKU: ${prod.sku} (Bling ID: ${prod.bling_id})...`);

      try {
        // Obter detalhes atualizados do produto via API do Bling v3
        const blingRes = await fetch(`https://www.bling.com.br/Api/v3/produtos/${prod.bling_id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });

        if (!blingRes.ok) {
          throw new Error(`Falha ao buscar produto no Bling (HTTP ${blingRes.status})`);
        }

        const blingData = await blingRes.json();
        const productDetail = blingData?.data;

        const internas = productDetail?.midia?.imagens?.internas || [];
        const externas = productDetail?.midia?.imagens?.externas || productDetail?.midia?.imagens?.imagensURL || [];
        const freshImages = [...internas, ...externas]
          .map(img => img.link || img.url)
          .filter(Boolean);

        if (freshImages.length === 0) {
          throw new Error('Nenhuma imagem encontrada nos dados retornados do Bling!');
        }

        const materializedUrls = [];
        const skuFolder = String(prod.sku || prod.bling_id).trim();
        const localFolder = path.join(UPLOADS_DIR, skuFolder);

        if (!fs.existsSync(localFolder)) {
          fs.mkdirSync(localFolder, { recursive: true });
        }

        for (let idx = 0; idx < freshImages.length; idx++) {
          const rawUrl = freshImages[idx];
          
          if (rawUrl.startsWith(VPS_BASE_URL) || rawUrl.startsWith('https://imagens.xiaomipetrolina.com.br')) {
            // Já está na VPS
            materializedUrls.push(rawUrl);
            continue;
          }

          console.log(`  ⬇️  Baixando imagem ${idx + 1} de Bling S3...`);
          
          // Baixar imagem do Bling S3
          const imgRes = await fetch(rawUrl);
          if (!imgRes.ok) {
            throw new Error(`Falha ao baixar imagem do S3 (HTTP ${imgRes.status})`);
          }

          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = extensionFromContentType(imgRes.headers.get('content-type'), rawUrl);

          const filename = `bling-${prod.bling_id}-${String(idx + 1).padStart(2, '0')}.${ext}`;
          const localDest = path.join(localFolder, filename);

          fs.writeFileSync(localDest, buffer);

          const publicUrl = `${VPS_BASE_URL}/images/products/${skuFolder}/${filename}`;
          materializedUrls.push(publicUrl);
          console.log(`    ✅ Salvo localmente: ${publicUrl}`);
        }

        // Atualizar produto no banco
        const updatedImagesJson = JSON.stringify(materializedUrls);
        const coverUrl = materializedUrls[0] || null;

        await pool.query(
          'UPDATE products SET images = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [updatedImagesJson, coverUrl, prod.id]
        );

        console.log(`🎉 SKU ${prod.sku} corrigido com sucesso!`);
        corrigidos++;
      } catch (prodErr) {
        console.error(`❌ Erro ao processar SKU ${prod.sku}:`, prodErr.message);
        falhas++;
      }
    }

    console.log('\n--- RELATÓRIO FINAL ---');
    console.log(`✅ Sucesso: ${corrigidos}`);
    console.log(`❌ Falhas: ${falhas}`);

  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
  } finally {
    await pool.end();
  }
}

run();
