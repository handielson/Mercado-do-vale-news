const { problem } = require('./companyFiscalCore.cjs');

const actions = new Set(['pending', 'no_action', 'assess_cancellation', 'assess_return', 'other']);
const field = (value, label, max) => {
  const result = String(value ?? '').trim();
  if (result.length > max) throw problem(`${label} excede ${max} caracteres.`, 400);
  return result;
};

function normalizeDocumentReview(input = {}) {
  if (!['draft', 'reviewed'].includes(input.reviewState)) throw problem('Estado da revisão inválido.', 400);
  if (!actions.has(input.fiscalAction)) throw problem('Providência fiscal inválida.', 400);
  const reviewState = input.reviewState;
  const fiscalAction = input.fiscalAction;
  const result = {
    reviewState,
    valueTreatment: field(input.valueTreatment, 'Tratamento dos valores', 4000),
    fiscalAction,
    justification: field(input.justification, 'Justificativa', 4000),
    evidenceNotes: field(input.evidenceNotes, 'Fontes consultadas', 2000),
    reviewerName: field(input.reviewerName, 'Contador responsável', 255),
    reviewerRegistration: field(input.reviewerRegistration, 'Registro profissional', 100),
  };
  if (reviewState === 'reviewed') {
    const missing = [
      ['valueTreatment', 'tratamento dos valores'], ['justification', 'justificativa'],
      ['evidenceNotes', 'fontes consultadas'], ['reviewerName', 'contador responsável'],
      ['reviewerRegistration', 'registro profissional'],
    ].filter(([key]) => !result[key]).map(([, label]) => label);
    if (fiscalAction === 'pending') missing.push('providência fiscal proposta');
    if (missing.length) throw problem(`Para concluir a revisão, informe: ${missing.join(', ')}.`, 409);
  }
  return result;
}

function documentReviewView(row) {
  return {
    reviewState: row?.review_state || 'draft',
    valueTreatment: row?.value_treatment || '',
    fiscalAction: row?.fiscal_action || 'pending',
    justification: row?.justification || '',
    evidenceNotes: row?.evidence_notes || '',
    reviewerName: row?.reviewer_name || '',
    reviewerRegistration: row?.reviewer_registration || '',
    reviewedAt: row?.reviewed_at ? new Date(row.reviewed_at).toISOString() : '',
    version: Number(row?.version || 0),
  };
}

module.exports = { normalizeDocumentReview, documentReviewView };
