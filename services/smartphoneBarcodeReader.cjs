'use strict';

// Lê códigos de barras (IMEI em Code128, EAN-13, DataMatrix...) da foto da etiqueta.
// Faz uma leitura da imagem inteira e, se faltar algo, recorta em blocos ampliados:
// barras finas em foto de celular costumam passar despercebidas na imagem inteira.

const fs = require('fs');
const sharp = require('sharp');

const BARCODE_FORMATS = ['Code128', 'EAN13', 'EAN8', 'UPCA', 'Code39', 'DataMatrix', 'QRCode'];
const MAX_SIDE = 3000;
const TILE_TARGET_WIDTH = 1800;
const DEFAULT_BUDGET_MS = 15000;

let zxingPromise = null;

function loadZxing() {
  if (!zxingPromise) {
    zxingPromise = (async () => {
      const zxing = require('zxing-wasm/reader');
      // Carrega o .wasm do node_modules: sem isso a biblioteca tenta baixar de CDN.
      const wasmBinary = fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
      await zxing.prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
      return zxing;
    })().catch((error) => {
      zxingPromise = null;
      throw error;
    });
  }
  return zxingPromise;
}

async function decodeRegion(zxing, image, region, scale) {
  let pipeline = image.clone().extract(region);
  if (scale !== 1) pipeline = pipeline.resize({ width: Math.round(region.width * scale), kernel: 'lanczos3' });
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const imageData = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
    colorSpace: 'srgb',
  };
  const results = await zxing.readBarcodes(imageData, {
    formats: BARCODE_FORMATS,
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 12,
  });
  return results
    .filter((result) => result.isValid && result.text)
    .map((result) => ({
      text: String(result.text),
      format: String(result.format),
      y: Math.round(region.top + (Number(result.position?.topLeft?.y) || 0) / scale),
    }));
}

function buildTiles(width, height, grid) {
  const tileWidth = Math.ceil(width / grid);
  const tileHeight = Math.ceil(height / grid);
  const overlapX = Math.round(tileWidth * 0.25);
  const overlapY = Math.round(tileHeight * 0.25);
  const tiles = [];
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const left = Math.max(0, col * tileWidth - overlapX);
      const top = Math.max(0, row * tileHeight - overlapY);
      tiles.push({
        left,
        top,
        width: Math.min(width - left, tileWidth + 2 * overlapX),
        height: Math.min(height - top, tileHeight + 2 * overlapY),
      });
    }
  }
  return tiles;
}

/**
 * @param {Buffer} buffer imagem original (JPG/PNG/WEBP)
 * @param {{ isComplete?: (items: Array<{text:string,format:string,y:number}>) => boolean, budgetMs?: number }} options
 * @returns {Promise<{items: Array<{text:string,format:string,y:number}>, width:number, height:number, passes:number, ms:number}>}
 */
async function readBarcodesFromImage(buffer, options = {}) {
  const started = Date.now();
  const budgetMs = Number(options.budgetMs) > 0 ? Number(options.budgetMs) : DEFAULT_BUDGET_MS;
  const isComplete = typeof options.isComplete === 'function' ? options.isComplete : () => false;
  const zxing = await loadZxing();
  const { data: normalized, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .png()
    .toBuffer({ resolveWithObject: true });
  const image = sharp(normalized);
  const found = new Map();
  const add = (list) => {
    for (const item of list) {
      const key = `${item.format}:${item.text}`;
      if (!found.has(key) || found.get(key).y > item.y) found.set(key, item);
    }
  };
  const sorted = () => [...found.values()].sort((a, b) => a.y - b.y);

  let passes = 1;
  add(await decodeRegion(zxing, image, { left: 0, top: 0, width: info.width, height: info.height }, 1));
  for (const grid of [2, 3]) {
    if (isComplete(sorted())) break;
    for (const tile of buildTiles(info.width, info.height, grid)) {
      if (Date.now() - started > budgetMs) break;
      const scale = Math.min(2.5, Math.max(1, TILE_TARGET_WIDTH / tile.width));
      add(await decodeRegion(zxing, image, tile, scale));
      passes += 1;
    }
  }
  return { items: sorted(), width: info.width, height: info.height, passes, ms: Date.now() - started };
}

module.exports = { readBarcodesFromImage, BARCODE_FORMATS };
