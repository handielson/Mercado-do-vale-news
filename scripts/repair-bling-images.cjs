#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const API_BASE = String(process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SITE_BASE = 'https://www.mercadodovale.com.br';
const execute = process.argv.includes('--execute');
const skuArg = process.argv.find((arg) => arg.startsWith('--sku='));
const requestedSku = skuArg ? skuArg.slice('--sku='.length).trim().toUpperCase() : '';

function loadLocalEnv() {
  const candidates = [
    '.env.vps.local',
    '.env.local',
    path.join('..', 'mercado-do-vale', '.env.vps.local'),
    path.join('..', 'mercado-do-vale', '.env.local'),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) dotenv.config({ path: resolved, override: false, quiet: true });
  }
}

function safeSku(value, blingId) {
  return String(value || blingId || 'bling')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `BLING-${blingId}`;
}

function hasTemporaryBlingImage(product) {
  return Array.isArray(product.images) && product.images.some((url) =>
    typeof url === 'string' && /^https:\/\/orgbling\.s3\.amazonaws\.com\//i.test(url));
}

function hasStoredProductImage(product) {
  return [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image_url,
  ].some((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
}

function needsBlingImageRepair(product) {
  return Boolean(product?.bling_id && product?.sku) &&
    (hasTemporaryBlingImage(product) || !hasStoredProductImage(product));
}

function imageCandidates(detail) {
  const internal = detail?.midia?.imagens?.internas || [];
  const external = detail?.midia?.imagens?.externas || detail?.midia?.imagens?.imagensURL || [];
  const images = [...internal, ...external, ...(Array.isArray(detail?.imagens) ? detail.imagens : [])];
  const seen = new Set();
  const candidates = [];
  for (const image of images) {
    const urls = [
      image?.link,
      image?.url,
      image?.linkMiniatura,
      typeof image === 'string' ? image : '',
    ].filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
    const unique = [...new Set(urls)];
    if (!unique.length || seen.has(unique[0])) continue;
    seen.add(unique[0]);
    candidates.push(unique);
    if (candidates.length >= 5) break;
  }
  return candidates;
}

function extension(contentType, sourceUrl) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('webp')) return 'webp';
  if (type.includes('png')) return 'png';
  if (type.includes('gif')) return 'gif';
  if (type.includes('avif')) return 'avif';
  try {
    const ext = new URL(sourceUrl).pathname.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  } catch {}
  return 'jpg';
}

async function fetchJson(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      continue;
    }
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
}

async function loadProducts() {
  const products = [];
  for (let offset = 0; ; offset += 2000) {
    const batch = await fetchJson(`${API_BASE}/products?status=all&compact=true&limit=2000&offset=${offset}&_t=repair-bling-images`);
    products.push(...batch);
    if (batch.length < 2000) return products;
  }
}

async function uploadImage(sourceUrls, product, index, syncKey) {
  let blob = null;
  let selectedUrl = '';
  let lastStatus = 0;
  for (const sourceUrl of sourceUrls) {
    const proxyUrl = `${SITE_BASE}/api/bling?resource=image-proxy&url=${encodeURIComponent(sourceUrl)}`;
    const source = await fetch(proxyUrl, { cache: 'no-store' });
    lastStatus = source.status;
    if (!source.ok) continue;
    blob = await source.blob();
    selectedUrl = sourceUrl;
    break;
  }
  if (!blob) throw new Error(`download da imagem ${index + 1}: HTTP ${lastStatus || 'indisponivel'}`);
  const ext = extension(blob.type, selectedUrl);
  const sku = safeSku(product.sku, product.bling_id);
  const filename = `bling-${product.bling_id}-${String(index + 1).padStart(2, '0')}.${ext}`;
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('path', `products/${sku}/${filename}`);
  const uploaded = await fetch(`${API_BASE}/images/upload`, {
    method: 'POST',
    headers: { 'x-sync-key': syncKey },
    body: form,
  });
  if (!uploaded.ok) throw new Error(`upload da imagem ${index + 1}: HTTP ${uploaded.status}`);
  const result = await uploaded.json();
  if (!result.url) throw new Error(`upload da imagem ${index + 1} sem URL`);
  return result.url;
}

async function main() {
  loadLocalEnv();
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || '';
  const products = await loadProducts();
  const targets = products.filter((product) =>
    needsBlingImageRepair(product) && (!requestedSku || String(product.sku).toUpperCase() === requestedSku));

  console.log(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', targets: targets.length, skus: targets.map((p) => p.sku) }, null, 2));
  if (!execute) return;
  if (!syncKey) throw new Error('VITE_VPS_SYNC_KEY/VPS_SYNC_KEY/SYNC_SECRET nao encontrado');

  const result = { repaired: [], failed: [] };
  for (const product of targets) {
    try {
      const detail = await fetchJson(`${SITE_BASE}/api/bling?resource=product-detail&id=${encodeURIComponent(product.bling_id)}`);
      const sources = imageCandidates(detail);
      if (!sources.length) throw new Error('Bling nao retornou imagens atuais');
      const uploaded = [];
      for (let index = 0; index < sources.length; index++) {
        try {
          uploaded.push(await uploadImage(sources[index], product, index, syncKey));
        } catch (error) {
          console.warn(`AVISO ${product.sku}: ${error.message}`);
        }
      }
      if (!uploaded.length) throw new Error('Bling nao retornou nenhuma imagem acessivel');
      const update = await fetchJson(`${API_BASE}/products/images`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-sync-key': syncKey },
        body: JSON.stringify({ sku: product.sku, images: uploaded }),
      });
      if (!update?.ok || Number(update?.affectedRows || 0) < 1) {
        throw new Error('VPS nao confirmou a atualizacao das imagens');
      }
      result.repaired.push({ sku: product.sku, images: uploaded.length });
      console.log(`OK ${product.sku}: ${uploaded.length} imagem(ns)`);
    } catch (error) {
      result.failed.push({ sku: product.sku, error: error.message });
      console.error(`ERRO ${product.sku}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  console.log(JSON.stringify(result, null, 2));
  if (result.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
