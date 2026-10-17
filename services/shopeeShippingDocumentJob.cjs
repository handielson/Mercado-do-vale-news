'use strict';

// Jobs are scoped by shop/connection/package/type. Keep job IDs, never signed
// media links or PDF buffers: each download obtains a fresh 30-minute link.
function createShopeeShippingDocumentDownloader({
  request,
  fetchMedia = (...args) => fetch(...args),
  wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) {
  const jobs = new Map();
  const inFlight = new Map();
  const prefix = '/api/v2/logistics/';
  const failure = (error, message, step, status = 502) => ({ status, data: { error, message, step } });
  const pending = () => ({ status: 202, data: {
    error: 'shipping_document_processing',
    message: 'A etiqueta esta sendo gerada pela Shopee. Aguarde alguns segundos e tente novamente.',
    status: 'PROCESSING',
  } });

  async function jsonRequest(step, body, context) {
    const response = await request(prefix + step, body, context);
    const data = await response.json();
    if (!response.ok || data?.error) {
      return { failure: failure(data?.error || 'shipping_document_request_failed',
        data?.message || 'A Shopee nao conseguiu processar a etiqueta.', step, response.ok ? 422 : response.status) };
    }
    return { data: data?.response };
  }

  async function run(context, key) {
    for (const [id, entry] of jobs) if (entry.expiresAt <= now()) jobs.delete(id);
    // One recreation for an expired/failed job, not for a merely pending job.
    for (let generation = 0; generation < 2; generation += 1) {
      let job = jobs.get(key);
      if (!job) {
        const created = await jsonRequest('create_shipping_document_job', {
          shipping_document_type: context.documentType,
          package_list: [context.packageNumber],
        }, context);
        if (created.failure) return created.failure;
        const rejected = created.data?.fail_list?.[0];
        if (rejected) return failure(rejected.fail_error || 'shipping_document_package_failed',
          rejected.fail_message || 'A Shopee recusou a geracao da etiqueta deste pacote.', 'create_shipping_document_job', 422);
        if (typeof created.data?.job_id !== 'string' || !created.data.job_id.trim()) {
          return failure('shipping_document_job_missing', 'A Shopee nao retornou o identificador da etiqueta.', 'create_shipping_document_job');
        }
        job = { id: created.data.job_id, expiresAt: now() + 30 * 60 * 1000 };
        if (jobs.size >= 500) jobs.delete(jobs.keys().next().value);
        jobs.set(key, job);
      }

      let jobStatus;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await jsonRequest('get_shipping_document_job_status', { job_id: job.id }, context);
        if (result.failure) return result.failure;
        jobStatus = String(result.data?.job_status || '').toUpperCase();
        if (['READY', 'EXPIRED', 'FAILED'].includes(jobStatus)) break;
        if (jobStatus !== 'PROCESSING') return failure('shipping_document_job_status_invalid',
          'A Shopee retornou um status de etiqueta desconhecido.', 'get_shipping_document_job_status');
        if (attempt < 7) await wait(750);
      }
      if (['EXPIRED', 'FAILED'].includes(jobStatus)) {
        jobs.delete(key);
        if (generation === 0) continue;
        return failure('shipping_document_job_failed', 'A Shopee nao conseguiu gerar a etiqueta. Tente novamente.', 'get_shipping_document_job_status');
      }
      if (jobStatus !== 'READY') return pending();

      // A link may expire during delivery. Ask for a fresh link using the same
      // job once; never log or expose signed URLs to consumers.
      for (let linkAttempt = 0; linkAttempt < 2; linkAttempt += 1) {
        const response = await request(prefix + 'download_shipping_document_job', { job_id: job.id }, context);
        const contentType = response.headers.get('content-type') || '';
        let fileResponse = response;
        if (contentType.includes('json')) {
          const data = await response.json();
          if (data?.error === 'logistics.download_later') return pending();
          if (data?.error === 'logistics.sd_file_expired' || data?.error === 'logistics.sd_job_print_failed') {
            jobs.delete(key);
            if (generation === 0) break;
          }
          if (!response.ok || data?.error) return failure(data?.error || 'shipping_document_download_failed',
            data?.message || 'Falha ao obter a etiqueta da Shopee.', 'download_shipping_document_job', response.ok ? 422 : response.status);
          const mediaLink = data?.response?.media_link || data?.media_link;
          let url;
          try { url = new URL(mediaLink); } catch { /* Invalid upstream response. */ }
          if (!url || url.protocol !== 'https:' || url.username || url.password) return failure('shipping_document_link_invalid',
            'A Shopee nao retornou um link valido para a etiqueta.', 'download_shipping_document_job');
          try {
            fileResponse = await fetchMedia(url.href, { signal: AbortSignal.timeout(30000) });
          } catch {
            return failure('shipping_document_download_failed', 'Falha ao baixar o arquivo de etiqueta da Shopee.', 'media_download');
          }
          if ([401, 403].includes(fileResponse.status) && linkAttempt === 0) continue;
        }
        if (!fileResponse.ok) return failure('shipping_document_download_failed',
          'Falha ao baixar o arquivo de etiqueta da Shopee.', 'media_download', 502);
        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        if (buffer.subarray(0, 5).toString() !== '%PDF-') return failure('shipping_document_invalid_pdf',
          'O arquivo retornado pela Shopee nao e uma etiqueta PDF valida.', 'media_download');
        return { status: 200, buffer };
      }
    }
    return failure('shipping_document_job_failed', 'Nao foi possivel gerar a etiqueta.', 'download_shipping_document_job');
  }

  return async function download(context) {
    const key = JSON.stringify([context.scope, context.packageNumber, context.documentType]);
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = run(context, key).catch(() => failure('shipping_document_request_failed',
      'Falha de comunicacao ao obter a etiqueta da Shopee. Tente novamente.', 'shipping_document_job'));
    inFlight.set(key, promise);
    try { return await promise; } finally { inFlight.delete(key); }
  };
}

module.exports = { createShopeeShippingDocumentDownloader };
