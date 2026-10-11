import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { saveFamilyRegistration } from '../components/products/familyRegistration.js';

const serviceSource = fs.readFileSync('services/productVideoUpload.ts', 'utf8');
const compiled = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function service({ statuses = [{ status: 'success', url: 'https://videos.test/MINI0002-01.mp4' }], receipt = { ok: true, uploadId: 'job-1' }, httpStatus = 200 } = {}) {
  const posts = [], reads = [], headers = [], exports = {};
  class XHR {
    upload = {};
    open(method, url) { posts.push({ method, url }); }
    setRequestHeader(key, value) { headers.push([key, value]); }
    send(form) { posts.at(-1).form = form; this.status = httpStatus; this.responseText = JSON.stringify(receipt); this.onload(); }
  }
  const sandbox = { exports, FormData, File, XMLHttpRequest: XHR, setTimeout: cb => { cb(); return 0; },
    fetch: async url => { reads.push(url); const data = statuses[Math.min(reads.length - 1, statuses.length - 1)]; return { ok: true, json: async () => data }; },
    require: name => name.endsWith('authSession') ? { getAuthSessionToken: async () => 'fixture-token' } : {
      VPS_DIRECT_BASE_URL: 'https://api.test', buildVpsUrl: path => `https://api.test${path}`, getVpsSyncHeaders: () => ({ 'x-sync-key': 'fixture-key' }),
    },
  };
  vm.runInNewContext(compiled, sandbox);
  return { ...exports, posts, reads, headers };
}
const file = () => new File(['fixture-video'], 'original.mp4', { type: 'video/mp4' });

test('envio usa o endpoint canônico com autenticação, SKU definitivo e confirmação do NAS', async () => {
  const api = service({ statuses: [{ status: 'uploading' }, { status: 'success', url: 'https://videos.test/MINI0002-01.mp4' }] });
  const accepted = [], progress = [];
  const url = await api.uploadProductVideo(file(), 'MINI0002-01', { onAccepted: id => accepted.push(id), onProgress: pct => progress.push(pct) });
  assert.equal(api.posts.length, 1); assert.equal(api.posts[0].url, 'https://api.test/synology/upload?folder=videos');
  assert.equal(api.posts[0].form.get('file').name, 'MINI0002-01.mp4');
  assert.deepEqual(api.headers, [['x-sync-key', 'fixture-key'], ['Authorization', 'Bearer fixture-token']]);
  assert.equal(api.reads.length, 2); assert.deepEqual(accepted, ['job-1']); assert.equal(progress.at(-1), 100); assert.equal(url, 'https://videos.test/MINI0002-01.mp4');
});
test('job pendente é consultado novamente sem reenviar o arquivo', async () => {
  const api = service();
  await api.uploadProductVideo(file(), 'MINI0002-01', { uploadId: 'existing-job' });
  assert.equal(api.posts.length, 0); assert.match(api.reads[0], /existing-job/);
});
test('tipo, tamanho, SKU inválido, resposta malformada e falha do NAS não indicam sucesso', async () => {
  const api = service();
  for (const invalid of [{ name: 'x.jpg', size: 5, type: 'image/jpeg' }, { name: 'x.mp4', size: 0, type: '' }, { name: 'x.mp4', size: 500 * 1024 * 1024 + 1, type: '' }]) assert.throws(() => api.validateProductVideo(invalid));
  await assert.rejects(api.uploadProductVideo(file(), '../BAD'), /SKU definitivo/);
  assert.equal(api.posts.length, 0);
  await assert.rejects(service({ receipt: null }).uploadProductVideo(file(), 'MINI0002-01'), /recebimento/);
  await assert.rejects(service({ httpStatus: 500, receipt: { error: 'offline' } }).uploadProductVideo(file(), 'MINI0002-01'), /offline/);
  await assert.rejects(service({ statuses: [{ status: 'error', error: 'NAS recusou' }] }).uploadProductVideo(file(), 'MINI0002-01'), error => error.uploadFailed === true);
  await assert.rejects(service({ statuses: [{ status: 'success' }] }).uploadProductVideo(file(), 'MINI0002-01'), /endereço/);
  await assert.rejects(service({ statuses: [{ status: 'uploading' }] }).uploadProductVideo(file(), 'MINI0002-01'), /Tente salvar novamente/);
});

function familyApi() {
  const created = [], updated = [], uploads = [];
  return { created, updated, uploads, validateVideo: service().validateProductVideo,
    create: async data => { created.push(data); return { ...data, id: data.parent_id ? 'child' : 'parent', sku: data.parent_id ? 'MINI0002-01' : 'MINI0002' }; },
    update: async (id, data) => { updated.push({ id, ...data }); return { id, ...data }; },
    uploadVideo: async (file, sku, options) => { uploads.push({ file, sku, options }); options.onAccepted('job-1'); return 'https://videos.test/MINI0002-01.mp4'; },
  };
}
const row = () => ({ key: 'white', data: { name: 'Filho', sku: '', specs: {}, images: ['own-photo'] }, inheritImages: false, videoFile: file() });
test('arquivo fica fora do payload e só é enviado depois de confirmar o filho e seu SKU', async () => {
  const api = familyApi(), checkpoint = { children: {} }, draft = row();
  await saveFamilyRegistration({ name: 'Pai' }, [draft], checkpoint, api);
  assert.equal(api.created.length, 2); assert.equal(api.uploads[0].sku, 'MINI0002-01'); assert.equal(api.uploads[0].file, draft.videoFile);
  assert.ok(api.created.every(payload => !('videoFile' in payload))); assert.deepEqual(checkpoint.children.white.images, ['own-photo']);
  assert.equal(checkpoint.children.white.video_url, 'https://videos.test/MINI0002-01.mp4');
});
test('falha no vínculo mantém URL; retry não cria produtos nem reenvia vídeo', async () => {
  const api = familyApi(), checkpoint = { children: {} }, draft = row(); let fails = true;
  const update = api.update;
  api.update = async (id, data) => { if (data.video_url && fails) throw Error('gravação indisponível'); return update(id, data); };
  await assert.rejects(saveFamilyRegistration({ name: 'Pai' }, [draft], checkpoint, api), /gravação indisponível/);
  fails = false; await saveFamilyRegistration({ name: 'Pai' }, [draft], checkpoint, api);
  assert.equal(api.created.length, 2); assert.equal(api.uploads.length, 1); assert.equal(checkpoint.children.white.sku, 'MINI0002-01'); assert.ok(checkpoint.children.white.video_url);
});
test('timeout guarda job e retoma confirmação; herança do pai não envia vídeo próprio', async () => {
  const api = familyApi(), checkpoint = { children: {} }, draft = row(); let fails = true;
  api.uploadVideo = async (_file, sku, options) => { api.uploads.push({ sku, uploadId: options.uploadId }); options.onAccepted('job-1'); if (fails) throw Error('timeout'); return 'https://videos.test/MINI0002-01.mp4'; };
  await assert.rejects(saveFamilyRegistration({ name: 'Pai' }, [draft], checkpoint, api), /timeout/);
  fails = false; await saveFamilyRegistration({ name: 'Pai' }, [draft], checkpoint, api);
  assert.equal(api.uploads[1].uploadId, 'job-1'); assert.equal(api.created.length, 2);
  const inherited = row(); inherited.data.specs._inherit_parent_video = true;
  const inheritanceApi = familyApi();
  await saveFamilyRegistration({ name: 'Pai', video_url: 'parent-video' }, [inherited], { children: {} }, inheritanceApi);
  assert.equal(inheritanceApi.uploads.length, 0); assert.equal(inheritanceApi.created[1].video_url, 'parent-video');
});
test('arquivo inválido bloqueia antes de gravar; campos permanecem no formulário', async () => {
  const api = familyApi(), draft = row(); draft.videoFile = new File([], 'empty.mp4');
  await assert.rejects(saveFamilyRegistration({ name: 'Pai' }, [draft], { children: {} }, api), /conteúdo/); assert.equal(api.created.length, 0);
  const media = fs.readFileSync('components/products/VariationMedia.tsx', 'utf8');
  assert.match(media, /Enviar vídeo/); assert.match(media, /type="file" accept="video\/mp4,\.mp4"/); assert.match(media, /Será enviado ao Synology ao salvar a família/);
  const editor = fs.readFileSync('components/products/ProductFamilyEditor.tsx', 'utf8'); assert.match(editor, /videoFile: media.videoFile/); assert.match(editor, /videoFile=\{row.videoFile\}/);
  assert.match(fs.readFileSync('components/products/ProductCard.tsx', 'utf8'), /uploadVideoWithProgress, pollSynologyUploadStatus.*productVideoUpload/);
});
