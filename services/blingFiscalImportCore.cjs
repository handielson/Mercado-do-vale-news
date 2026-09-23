function majorToCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round((numeric + Number.EPSILON) * 100));
}

function normalizeBlingFiscalDocument(item, type) {
  const model = type === 'nfce' ? '65' : '55';
  const sourceReference = String(item?.id || '').trim();
  const issuedAt = String(item?.dataEmissao || '').trim();
  const status = Number(item?.situacao);
  const amount = item?.valorNota ?? item?.totalNota ?? item?.valorTotal;
  if (!sourceReference || !/^\d{4}-\d{2}-\d{2}/.test(issuedAt)
    || ![2, 5].includes(status) || amount == null || !Number.isFinite(Number(amount)) || Number(amount) < 0
    || Number(item?.tipo) !== 1) return null;
  const accessKey = String(item?.chaveAcesso || item?.chave || '').replace(/\D/g, '');
  return {
    model,
    channel: 'bling',
    externalSaleId: `${type}:${sourceReference}`,
    status: status === 5 ? 'authorized' : 'cancelled',
    accessKey: accessKey.length === 44 ? accessKey : null,
    documentNumber: String(item?.numero || '').trim() || null,
    series: String(item?.serie || '').trim() || null,
    issuedAt: issuedAt.slice(0, 19).replace('T', ' '),
    totalCents: majorToCents(amount),
    source: 'bling_import',
    sourceReference,
  };
}

function blingFiscalEmissionPeriod(from, to) {
  return { initial: `${from} 00:00:00`, final: `${to} 23:59:59` };
}

function invalidImport(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

async function collectBlingFiscalDocuments({ listPage, getDetail, pause = async () => {}, maxDocuments = 120 }) {
  const documents = [];
  for (const type of ['nfe', 'nfce']) {
    for (const status of [5, 2]) {
      for (let page = 1; page <= 100; page += 1) {
        await pause();
        const items = await listPage(type, status, page);
        if (!Array.isArray(items)) throw invalidImport(`Resposta inválida na listagem ${type}, situação ${status}, página ${page}.`);
        if (documents.length + items.length > maxDocuments) throw invalidImport('Período com notas demais para uma importação segura. Divida em períodos menores.');
        for (const item of items) {
          if (!item?.id || Number(item.situacao) !== status) throw invalidImport(`Situação ou identificador divergente na listagem ${type}, página ${page}.`);
          await pause();
          const detail = await getDetail(type, item.id);
          if (String(detail?.id) !== String(item.id) || Number(detail?.situacao) !== status) {
            throw invalidImport(`Situação ou identificador divergente no detalhe ${type}, página ${page}.`);
          }
          const document = normalizeBlingFiscalDocument(detail, type);
          if (!document) throw invalidImport(`Detalhe fiscal incompleto em ${type}, página ${page}; importação interrompida.`);
          documents.push(document);
        }
        if (items.length < 100) break;
        if (page === 100) throw invalidImport(`Paginação de ${type} excedeu 100 páginas; divida o período.`);
      }
    }
  }
  return documents;
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

module.exports = { majorToCents, blingFiscalEmissionPeriod, normalizeBlingFiscalDocument, collectBlingFiscalDocuments, fiscalDocumentTotals };
