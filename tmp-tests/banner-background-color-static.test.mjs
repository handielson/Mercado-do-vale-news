import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const typeSource = readFileSync('types/catalog.ts', 'utf8');
const form = readFileSync('components/admin/BannerForm.tsx', 'utf8');
const carousel = readFileSync('components/catalog/BannerCarousel.tsx', 'utf8');
const service = readFileSync('services/bannerService.ts', 'utf8');

assert.match(typeSource, /background_color\?:\s*string/, 'Banner type must expose optional background_color');

assert.match(form, /background_color:\s*banner\?\.background_color\s*\?\?\s*'#[0-9a-fA-F]{6}'/, 'banner form must initialize background color');
assert.match(form, /Cor do fundo/, 'banner form must show a background color field');
assert.match(form, /type="color"[\s\S]*value=\{formData\.background_color\}/, 'banner form must use a color input bound to background_color');
assert.match(form, /background_color:\s*formData\.background_color/, 'banner form must submit background_color');
assert.match(form, /backgroundColor:\s*formData\.background_color/, 'banner preview must apply background_color');

assert.match(carousel, /const bannerBackgroundColor\s*=\s*banner\.background_color\s*\|\|\s*'#[0-9a-fA-F]{6}'/, 'carousel must derive banner background color');
assert.match(carousel, /backgroundColor:\s*bannerBackgroundColor/, 'carousel must apply banner background color behind object-contain images');

assert.match(service, /background_color/, 'banner service must preserve background_color through VPS mapping');

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /background_color/, `${file} must accept and persist banner background_color`);
  assert.match(source, /ADD COLUMN updated_at/, `${file} must ensure legacy banner tables have updated_at before PATCH`);
}

console.log('banner background color static checks passed');
