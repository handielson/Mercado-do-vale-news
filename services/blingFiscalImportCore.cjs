function majorToCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round((numeric + Number.EPSILON) * 100));
}

function normalizeBlingFiscalDocument(item, type) {
  const model = type === 'nfce' ? '65' : '55';
  const sourceReference = String(item?.id || '').trim();
  const issuedAt = String(item?.dataEmissao || '').trim();
  if (!sourceReference || !/^\d{4}-\d{2}-\d{2}/.test(issuedAt)) return null;
  const accessKey = String(item?.chaveAcesso || item?.chave || '').replace(/\D/g, '');
  return {
    model,
    channel: 'bling',
    externalSaleId: `${type}:${sourceReference}`,
    status: 'authorized',
    accessKey: accessKey.length === 44 ? accessKey : null,
    documentNumber: String(item?.numero || '').trim() || null,
    series: String(item?.serie || '').trim() || null,
    issuedAt: issuedAt.slice(0, 19).replace('T', ' '),
    totalCents: majorToCents(item?.totalNota ?? item?.valorTotal ?? item?.valorNota ?? 0),
    source: 'bling_import',
    sourceReference,
  };
}

function fiscalDocumentTotals(documents = []) {
  const authorized = documents.filter(document => String(document.status).toLowerCase() === 'authorized');
  const cancelled = documents.filter(document => String(document.status).toLowerCase() === 'cancelled');
  return {
    authorizedDocumentCents: authorized.reduce((sum, document) => sum + Math.max(0, Number(document.total_cents ?? document.totalCents ?? 0)), 0),
    authorizedDocumentCount: authorized.length,
    cancelledDocumentCents: cancelled.reduce((sum, document) => sum + Math.max(0, Number(document.total_cents ?? document.totalCents ?? 0)), 0),
    cancelledDocumentCount: cancelled.length,
  };
}

module.exports = { majorToCents, normalizeBlingFiscalDocument, fiscalDocumentTotals };
