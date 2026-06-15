#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

for (const envPath of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: envPath, quiet: true });
}

const sku = String(process.argv[2] || '').trim();
const vpsBaseUrl = String(process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET;

const mimeExtensions = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function assertInput() {
  if (!sku) throw new Error('Usage: node tools/migrate-product-inline-images.mjs SKU');
  if (!syncKey) throw new Error('VITE_VPS_SYNC_KEY, VPS_SYNC_KEY, or SYNC_SECRET is required.');
}

function parseInlineImage(value) {
  const match = /^data:([^;,]+);base64,(.*)$/u.exec(String(value || ''));
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const extension = mimeExtensions.get(mimeType);
  if (!extension) throw new Error(`Unsupported inline image MIME: ${mimeType}`);

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('Inline image decoded to an empty payload.');

  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  return { buffer, mimeType, extension, hash };
}

async function vpsJson(pathname, options = {}) {
  const response = await fetch(`${vpsBaseUrl}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'X-Sync-Key': syncKey,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`VPS ${options.method || 'GET'} ${pathname} failed ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchProductsBySku() {
  const params = new URLSearchParams({
    sku,
    status: 'all',
    limit: '20',
    _t: String(Date.now()),
  });
  const products = await vpsJson(`/products?${params.toString()}`);
  return Array.isArray(products) ? products : [];
}

async function uploadInlineImage(inlineImage, index) {
  const fileName = `${sku.toUpperCase()}_${String(index + 1).padStart(2, '0')}_${inlineImage.hash}.${inlineImage.extension}`;
  const storagePath = `products/${sku.toUpperCase()}/${fileName}`;
  const formData = new FormData();
  formData.append('file', new Blob([inlineImage.buffer], { type: inlineImage.mimeType }), path.basename(storagePath));
  formData.append('path', storagePath);

  const response = await fetch(`${vpsBaseUrl}/images/upload`, {
    method: 'POST',
    headers: { 'X-Sync-Key': syncKey },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`VPS upload failed ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  if (!payload?.url || !String(payload.url).startsWith('http')) {
    throw new Error(`Upload did not return a public URL for ${storagePath}`);
  }

  return String(payload.url);
}

async function main() {
  assertInput();

  const products = await fetchProductsBySku();
  if (products.length === 0) throw new Error(`No product found for SKU ${sku}.`);

  const sourceProduct = products.find((product) =>
    Array.isArray(product.images) && product.images.some((image) => parseInlineImage(image))
  );
  if (!sourceProduct) throw new Error(`SKU ${sku} has no inline data images to migrate.`);

  const sourceImages = Array.isArray(sourceProduct.images) ? sourceProduct.images : [];
  const nextImages = [];
  let uploadedCount = 0;

  for (let index = 0; index < sourceImages.length; index += 1) {
    const image = sourceImages[index];
    const inlineImage = parseInlineImage(image);
    if (!inlineImage) {
      if (typeof image === 'string' && image.trim()) nextImages.push(image.trim());
      continue;
    }
    nextImages.push(await uploadInlineImage(inlineImage, index));
    uploadedCount += 1;
  }

  if (uploadedCount === 0 || nextImages.length === 0) {
    throw new Error(`No migrated URLs were produced for SKU ${sku}.`);
  }

  const patchResult = await vpsJson('/products/images', {
    method: 'PATCH',
    body: JSON.stringify({ sku, images: nextImages }),
  });

  console.log(JSON.stringify({
    sku,
    matchedProducts: products.length,
    sourceProductId: sourceProduct.id,
    uploadedCount,
    affectedRows: patchResult.affectedRows ?? null,
    images: nextImages,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
