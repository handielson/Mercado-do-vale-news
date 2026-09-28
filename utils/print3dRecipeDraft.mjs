import { calculatePrint3dCost } from './print3dCost.mjs';

/**
 * Portable draft for a future product-linked, immutable production revision.
 * It contains no NAS URL, order reference or claim of approval.
 */
const safeSegment = (value, field) => {
  const segment = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(segment) || segment === '.' || segment === '..') {
    throw new TypeError(`${field} deve conter apenas letras sem acento, números, ponto, hífen ou sublinhado.`);
  }
  return segment;
};

const nonNegative = (value, field, positive = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new TypeError(`${field} deve ser um número ${positive ? 'positivo' : 'não negativo'}.`);
  }
  return value;
};

const safeCents = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} deve estar em centavos inteiros.`);
  return value;
};

const safeText = (value, field, { required = false, max = 500 } = {}) => {
  const text = String(value ?? '').trim();
  if ((required && !text) || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) {
    throw new TypeError(`${field} ${required ? 'é obrigatório e ' : ''}deve ter até ${max} caracteres válidos.`);
  }
  return text;
};

const safeOptionalHttpUrl = (value, field) => {
  const text = safeText(value, field, { max: 1000 });
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new TypeError(`${field} deve ser um endereço completo válido.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError(`${field} deve usar HTTP ou HTTPS e não pode conter credenciais.`);
  }
  return parsed.toString();
};

export function buildPrint3dRecipeDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Informe a ficha de produção.');
  const sku = safeSegment(input.sku, 'SKU');
  const revision = safeSegment(input.revision, 'Revisão');
  const productId = String(input.productId ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) throw new TypeError('Produto cadastrado inválido.');
  const productName = String(input.productName ?? '').trim();
  if (!productName) throw new TypeError('Informe o nome do produto cadastrado.');
  const materialGrams = nonNegative(input.materialGrams, 'Material total', true);
  const printMinutes = nonNegative(input.printMinutes, 'Tempo total', true);
  const inputSource = input.inputSource === undefined ? 'json' : String(input.inputSource);
  if (!['json', 'manual'].includes(inputSource)) throw new TypeError('Origem dos dados de impressão inválida.');
  const printerName = safeText(input.printerName, 'Impressora', { required: true, max: 120 });
  const printerProfile = safeText(input.printerProfile, 'Perfil de impressão', { required: true, max: 160 });
  if (typeof input.materialIncludesSupportsAndPurge !== 'boolean') {
    throw new TypeError('Informe se o material total inclui suportes e purga.');
  }
  const productionNotes = safeText(input.productionNotes, 'Observações de produção', { max: 1000 });
  const sourceUrl = safeOptionalHttpUrl(input.sourceUrl, 'Link de origem');
  const pieces = input.pieces;
  if (!Number.isSafeInteger(pieces) || pieces <= 0) throw new TypeError('Peças do lote deve ser um inteiro positivo.');
  const laborMinutes = nonNegative(input.laborMinutes, 'Mão de obra');
  if (!Array.isArray(input.filaments) || input.filaments.length === 0) throw new TypeError('Informe os filamentos usados.');
  const filaments = input.filaments.map((entry) => ({
    id: safeSegment(entry?.id, 'ID do filamento'),
    name: String(entry?.name ?? '').trim(),
    color: String(entry?.color ?? '').trim(),
    consumedGrams: nonNegative(entry?.consumedGrams, 'Consumo do filamento', true),
    spoolGrams: nonNegative(entry?.spoolGrams, 'Peso do rolo', true),
    spoolCostCents: safeCents(entry?.spoolCostCents, 'Preço do rolo'),
  }));
  if (filaments.some((entry) => !entry.name || !entry.color)) throw new TypeError('Informe nome e cor de cada filamento.');
  const allocatedGrams = filaments.reduce((sum, entry) => sum + entry.consumedGrams, 0);
  if (Math.abs(allocatedGrams - materialGrams) > 0.001) throw new TypeError('A soma dos filamentos deve coincidir com o material total.');
  const supplies = (input.supplies ?? []).map((entry) => ({
    id: safeSegment(entry?.id, 'ID do insumo'),
    name: String(entry?.name ?? '').trim(),
    unitLabel: String(entry?.unitLabel ?? 'un').trim(),
    quantity: nonNegative(entry?.quantity, 'Quantidade do insumo', true),
    unitCostCents: safeCents(entry?.unitCostCents, 'Preço do insumo'),
  }));
  if (supplies.some((entry) => !entry.name || !entry.unitLabel || entry.unitLabel.length > 40 || /[\x00-\x1f]/.test(entry.unitLabel))) throw new TypeError('Informe nome e unidade de cada insumo.');
  if (new Set(supplies.map(entry => entry.id)).size !== supplies.length) throw new TypeError('A ficha contém o mesmo insumo mais de uma vez.');
  const cost = input.cost;
  if (!cost || typeof cost !== 'object') throw new TypeError('Calcule o custo antes de exportar a ficha.');
  const costFields = ['filamentCents', 'energyCents', 'machineCents', 'laborCents', 'suppliesCents', 'batchCents', 'unitCents'];
  const costSnapshot = Object.fromEntries(costFields.map((field) => [field, safeCents(cost[field], field)]));
  if (costSnapshot.batchCents !== costSnapshot.filamentCents + costSnapshot.energyCents + costSnapshot.machineCents + costSnapshot.laborCents + costSnapshot.suppliesCents) {
    throw new TypeError('A memória de cálculo não fecha com o custo do lote.');
  }
  const rates = input.rates;
  if (!rates || typeof rates !== 'object') throw new TypeError('Informe as tarifas usadas no cálculo.');
  const rateSnapshot = {
    printerWatts: nonNegative(rates.printerWatts, 'Potência da impressora', true),
    energyCentsPerKwh: safeCents(rates.energyCentsPerKwh, 'Tarifa de energia'),
    machineCentsPerHour: safeCents(rates.machineCentsPerHour, 'Uso da máquina'),
    laborCentsPerHour: safeCents(rates.laborCentsPerHour, 'Mão de obra por hora'),
    ...(rates.taxPercent !== undefined ? { taxPercent: nonNegative(rates.taxPercent, 'Imposto') } : {}),
  };
  const recomputed = calculatePrint3dCost({
    pieces, printMinutes, laborMinutes, ...rateSnapshot,
    filaments: filaments.map(({ consumedGrams, spoolGrams, spoolCostCents }) => ({ consumedGrams, spoolGrams, spoolCostCents })),
    supplies: supplies.map(({ quantity, unitCostCents }) => ({ quantity, unitCostCents })),
  });
  if (costFields.some((field) => recomputed[field] !== costSnapshot[field])) {
    throw new TypeError('A memória de cálculo não corresponde aos parâmetros da ficha.');
  }
  return {
    schema: 'mercado-do-vale.print3d-recipe-draft.v1',
    status: 'rascunho',
    productId,
    productName,
    sku,
    revision,
    ...(sourceUrl ? { sourceUrl } : {}),
    suggestedPrivateFolder: `producao-3d/produtos/${sku}/revisoes/${revision}`,
    printSummary: { material_gramas: materialGrams, tempo_impressao_minutos: printMinutes, source: inputSource },
    productionDetails: {
      printer: printerName,
      profile: printerProfile,
      material_includes_supports_and_purge: input.materialIncludesSupportsAndPurge,
      notes: productionNotes,
    },
    piecesPerBatch: pieces,
    laborMinutes,
    filaments,
    supplies,
    rateSnapshot,
    costSnapshot,
  };
}

export function validatePrint3dRecipeDraft(draft) {
  if (!draft || draft.schema !== 'mercado-do-vale.print3d-recipe-draft.v1' || draft.status !== 'rascunho') {
    throw new TypeError('Formato de ficha 3D não reconhecido.');
  }
  return buildPrint3dRecipeDraft({
    productId: draft.productId,
    productName: draft.productName,
    sku: draft.sku,
    revision: draft.revision,
    sourceUrl: draft.sourceUrl,
    materialGrams: draft.printSummary?.material_gramas,
    printMinutes: draft.printSummary?.tempo_impressao_minutos,
    inputSource: draft.printSummary?.source,
    printerName: draft.productionDetails?.printer,
    printerProfile: draft.productionDetails?.profile,
    materialIncludesSupportsAndPurge: draft.productionDetails?.material_includes_supports_and_purge,
    productionNotes: draft.productionDetails?.notes,
    pieces: draft.piecesPerBatch,
    laborMinutes: draft.laborMinutes,
    filaments: draft.filaments,
    supplies: draft.supplies,
    rates: draft.rateSnapshot,
    cost: draft.costSnapshot,
  });
}
