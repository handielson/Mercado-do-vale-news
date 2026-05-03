import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(__dirname, '..', 'vps_server.js'), 'utf8');

assert.match(source, /function buildImageDerivativeTargets\(/, 'VPS server should define derivative target planning');
assert.match(source, /async function generateImageDerivatives\(/, 'VPS server should define derivative generation');
assert.match(source, /sharp\(filePath\)[\s\S]*\.resize\(\{ width: target\.width, withoutEnlargement: true \}\)/, 'derivatives should be resized without enlarging originals');
assert.match(source, /-\(320\|480\|768\|800\|1280\)\\\.\(webp\|avif\)/, 'immutable derivative detection should only match known width suffixes');
assert.doesNotMatch(source, /-\\d\+\\\.\(webp\|avif\)/, 'img-1.webp must not be treated as a generated derivative');

const uploadProductRoute = source.match(/fastify\.post\('\/products\/:id\/upload-image'[\s\S]*?\n\}\);/);
assert.ok(uploadProductRoute, 'product upload route should exist');
assert.match(uploadProductRoute[0], /await generateImageDerivatives\(dest, 'product'\)/, 'product upload should generate product derivatives');

const imageBankRoute = source.match(/fastify\.post\('\/images\/upload'[\s\S]*?\n\}\);/);
assert.ok(imageBankRoute, 'image bank upload route should exist');
assert.match(imageBankRoute[0], /await generateImageDerivatives\(dest, 'product'\)/, 'image bank upload should generate product derivatives');

const bannerRoute = source.match(/fastify\.post\('\/banners\/upload'[\s\S]*?\n\}\);/);
assert.ok(bannerRoute, 'banner upload route should exist');
assert.match(bannerRoute[0], /await generateImageDerivatives\(dest, 'banner'\)/, 'banner upload should generate banner derivatives');
