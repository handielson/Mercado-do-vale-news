function firstMatch(value, patterns) {
  for (const pattern of patterns) {
    const match = String(value || '').match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

export function sanitizeTikTokBulkDebugText(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [removido]')
    .replace(
      /((?:access|refresh)[_-]?token|app[_-]?secret|authorization|x-sync-key)(\s*["':=]+\s*)([^,}\s"]+)/gi,
      '$1$2[removido]'
    )
    .trim();
}

export function buildTikTokBulkDebug({
  action,
  product,
  link,
  error,
  category,
  warehouse,
  timestamp = new Date().toISOString(),
}) {
  const rawMessage = String(error?.message || error || 'Erro nao informado');
  const message = sanitizeTikTokBulkDebugText(rawMessage);
  const httpStatus = String(
    error?.statusCode ||
    error?.status ||
    firstMatch(rawMessage, [/\[VPS\]\s+(\d{3})\b/i, /\bHTTP\s+(\d{3})\b/i]) ||
    'nao informado'
  );
  const tiktokCode = String(
    error?.tiktokCode ||
    firstMatch(rawMessage, [
      /TikTok Shop API failed:\s*(\d+)\s*:/i,
      /["']code["']\s*:\s*["']?(\d+)/i,
    ]) ||
    'nao informado'
  );
  const requestId = sanitizeTikTokBulkDebugText(
    error?.requestId ||
    error?.request_id ||
    firstMatch(rawMessage, [
      /["']request_id["']\s*:\s*["']([^"']+)/i,
      /["']requestId["']\s*:\s*["']([^"']+)/i,
      /\brequest\s+([A-Za-z0-9_-]{8,})/i,
    ]) ||
    'nao informado'
  );
  const jobId = sanitizeTikTokBulkDebugText(error?.jobId || error?.job_id || 'nao informado');

  return [
    'TikTok Shop - debug do envio em massa',
    `Acao: ${action || 'nao informada'}`,
    `Produto: ${product?.name || 'nao informado'}`,
    `Produto local ID: ${product?.id || 'nao informado'}`,
    `SKU: ${product?.sku || 'nao informado'}`,
    `Produto TikTok ID: ${link?.tiktok_product_id || 'nao informado'}`,
    `Categoria: ${category?.name || 'nao informada'}${category?.id ? ` (${category.id})` : ''}`,
    `Armazem: ${warehouse?.name || warehouse?.id || 'nao informado'}`,
    `HTTP: ${httpStatus}`,
    `Erro: ${message}`,
    `Codigo TikTok: ${tiktokCode}`,
    `Request ID: ${requestId}`,
    `Job ID: ${jobId}`,
    `Horario: ${timestamp}`,
  ].join('\n');
}
