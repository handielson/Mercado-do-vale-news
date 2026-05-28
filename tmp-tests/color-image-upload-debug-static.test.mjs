import fs from 'node:fs';

const source = fs.readFileSync('components/settings/ColorImageManager.tsx', 'utf8');

const requiredSnippets = [
  'uploadDebugByColor',
  'type UploadDebugStage',
  "'compress'",
  "'upload_vps'",
  "'save_model_color_images'",
  "console.error('[ColorImageManager] Upload debug:'",
  'navigator.clipboard.writeText(JSON.stringify',
  'Copiar debug',
  'Debug do upload',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missing.length > 0) {
  throw new Error(`Color image upload debug UI is missing: ${missing.join(', ')}`);
}

console.log('color image upload debug static check passed');
