import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function extractBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing ${start}`);
  assert.ok(endIndex > startIndex, `missing ${end}`);
  return source.slice(startIndex, endIndex).trim();
}

async function loadVideoResolvers(file) {
  const source = readFileSync(file, 'utf8');
  const buildSource = extractBetween(
    source,
    'function buildWhatsAppStatusVideoCandidates(product)',
    'function normalizeWhatsAppStatusRepeatDays',
  );
  const resolveSource = extractBetween(
    source,
    'async function resolveWhatsAppStatusVideoUrls(product)',
    'async function sendWahaStatusMedia',
  );
  const checkedUrls = [];
  const context = {
    AbortSignal,
    process: { env: { WAHA_STATUS_MEDIA_CHECK_TIMEOUT_MS: '1000', WAHA_STATUS_MEDIA_INTERVAL_MS: '0' } },
    normalizeWhatsAppStatusText(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    },
    getWhatsAppStatusProductVariation(product) {
      return { ram: '8GB', storage: '256GB', color: product?.specs?.color || '' };
    },
    async fetch(url) {
      checkedUrls.push(url);
      const valid = !String(url).includes('invalido');
      return {
        ok: valid,
        headers: { get: () => valid ? 'video/mp4' : 'text/plain' },
      };
    },
  };
  const queueSource = extractBetween(
    source,
    'let whatsAppStatusMediaQueueVps = Promise.resolve();',
    'async function sendWhatsAppStatusProduct(campaign',
  );
  vm.runInNewContext(
    `${buildSource}\n${resolveSource}\n${queueSource}\nthis.build = buildWhatsAppStatusVideoCandidates; this.resolve = resolveWhatsAppStatusVideoUrls; this.enqueue = enqueueWhatsAppStatusMediaBatchVps;`,
    context,
  );
  return { build: context.build, resolve: context.resolve, enqueue: context.enqueue, checkedUrls };
}

const product = {
  id: 'redmi-15-card',
  status_group_products: [
    { id: 'roxo-2', specs: { color: 'Roxo' }, marketing_video_url: 'https://cdn.test/roxo.mp4', video_url: 'https://cdn.test/roxo-fallback.mp4' },
    { id: 'preto-1', specs: { color: 'Preto' }, marketing_video_url: 'https://cdn.test/preto-invalido.mp4', video_url: 'https://cdn.test/preto.mp4' },
    { id: 'azul-2', specs: { color: 'Azul' }, video_url: 'https://cdn.test/azul.mp4' },
    { id: 'azul-1', specs: { color: 'Azul' }, marketing_video_url: 'https://cdn.test/azul.mp4' },
    { id: 'roxo-2', specs: { color: 'Roxo' }, marketing_video_url: 'https://cdn.test/roxo.mp4' },
  ],
};

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const { build, resolve, enqueue, checkedUrls } = await loadVideoResolvers(file);
  const groups = build(product);
  assert.deepEqual(
    Array.from(groups, (group) => group.color),
    ['Azul', 'Preto', 'Roxo'],
    `${file} must order one candidate group per color`,
  );
  assert.deepEqual(
    Array.from(groups[1].candidates),
    ['https://cdn.test/preto-invalido.mp4', 'https://cdn.test/preto.mp4'],
    `${file} must prefer the marketing video and retain the regular video as fallback`,
  );

  const videos = await resolve(product);
  assert.deepEqual(
    Array.from(videos, (video) => `${video.color}:${video.url}`),
    [
      'Azul:https://cdn.test/azul.mp4',
      'Preto:https://cdn.test/preto.mp4',
      'Roxo:https://cdn.test/roxo.mp4',
    ],
    `${file} must resolve every color in deterministic order without duplicate URLs`,
  );
  assert.deepEqual(
    checkedUrls,
    [
      'https://cdn.test/azul.mp4',
      'https://cdn.test/preto-invalido.mp4',
      'https://cdn.test/preto.mp4',
      'https://cdn.test/roxo.mp4',
    ],
    `${file} must validate candidates sequentially`,
  );

  const queueEvents = [];
  const first = enqueue(async () => {
    queueEvents.push('card-a');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
    queueEvents.push('videos-a');
  });
  const second = enqueue(async () => {
    queueEvents.push('card-b');
    queueEvents.push('videos-b');
  });
  await Promise.all([first, second]);
  assert.deepEqual(
    queueEvents,
    ['card-a', 'videos-a', 'card-b', 'videos-b'],
    `${file} must keep concurrent product media batches from interleaving`,
  );
}

console.log('WhatsApp Status color video ordering checks passed');
