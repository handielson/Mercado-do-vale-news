const CATALOG_PREFERENCE_HANDOFF_MESSAGE = [
  'Obrigado pelas informações 😊 Não consegui identificar com segurança, de forma automática, qual opção combina melhor com todas as suas preferências.',
  'Vou chamar um de nossos atendentes para te orientar e encontrar a alternativa mais adequada para você. Só um momento, por favor.',
].join('\n\n');

const PHONE_LIST_FOLLOWUP_MESSAGE = [
  'Oi 😊 Conseguiu dar uma olhadinha na lista?',
  'Se estiver procurando algo específico, como câmera, tela, NFC, memória, marca ou faixa de preço, pode me falar que eu filtro as opções disponíveis para você.',
].join('\n');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.,+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePreferenceState(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const constraints = input.constraints && typeof input.constraints === 'object' ? input.constraints : {};
  return {
    active: input.active === true,
    family: String(input.family || 'smartphone'),
    awaiting: String(input.awaiting || ''),
    constraints: {
      budgetMaxCents: Number(constraints.budgetMaxCents || 0) || null,
      brand: String(constraints.brand || '').trim() || null,
      nfc: typeof constraints.nfc === 'boolean' ? constraints.nfc : null,
      ramMinGb: Number(constraints.ramMinGb || 0) || null,
      storageMinGb: Number(constraints.storageMinGb || 0) || null,
      cameraQuality: constraints.cameraQuality === 'good' ? 'good' : null,
      cameraMinMp: Number(constraints.cameraMinMp || 0) || null,
      screenQuality: constraints.screenQuality === 'good' ? 'good' : null,
      screenType: String(constraints.screenType || '').trim() || null,
      refreshRateMinHz: Number(constraints.refreshRateMinHz || 0) || null,
    },
    sourceMessages: Array.isArray(input.sourceMessages)
      ? input.sourceMessages.map((item) => String(item || '').trim()).filter(Boolean).slice(-10)
      : [],
    updatedAt: input.updatedAt || null,
  };
}

function parseMoneyToCents(raw) {
  let text = String(raw || '').trim().replace(/\s+/g, '');
  if (!text) return null;
  if (text.includes('.') && text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function extractBudgetMaxCents(text, currentState) {
  const explicit = text.match(/(?:ate|maximo|max|abaixo de|menos de|por volta de|na faixa de|orcamento(?: de)?|r\$)\s*(?:r\$\s*)?([\d.,]+)/i);
  if (explicit) return parseMoneyToCents(explicit[1]);
  if ((currentState.awaiting === 'budget' || currentState.active === true) && /^\s*(?:r\$\s*)?[\d.,]+\s*$/i.test(text)) {
    return parseMoneyToCents(text.replace(/r\$/i, ''));
  }
  return null;
}

function extractCatalogPreferences(message, previousState = {}, availableBrands = []) {
  const current = normalizePreferenceState(previousState);
  const raw = String(message || '').trim();
  const text = normalizeText(raw);
  const patch = {};

  const cameraMentioned = /\b(camera|cameras|foto|fotos|fotografia|selfie)\b/.test(text);
  if (cameraMentioned && /\b(boa|bom|melhor|qualidade|otima|top)\b/.test(text)) patch.cameraQuality = 'good';
  const cameraMp = text.match(/(?:camera[^0-9]{0,20})?(\d{2,3})\s*mp\b/);
  if (cameraMp) patch.cameraMinMp = Number(cameraMp[1]);

  const screenMentioned = /\b(tela|display)\b/.test(text);
  if (screenMentioned && /\b(boa|bom|melhor|qualidade|otima|top)\b/.test(text)) patch.screenQuality = 'good';
  const screenType = text.match(/\b(amoled|oled|ips|lcd)\b/);
  if (screenType) patch.screenType = screenType[1];
  const refreshRate = text.match(/\b(60|90|120|144)\s*hz\b/);
  if (refreshRate) patch.refreshRateMinHz = Number(refreshRate[1]);

  if (/\b(sem|nao quero|dispenso)\s+nfc\b/.test(text)) patch.nfc = false;
  else if (/\bnfc\b/.test(text)) patch.nfc = true;

  const ram = text.match(/\b(\d{1,2})\s*(?:gb|g)\s*(?:de\s*)?ram\b|\bram\s*(?:de\s*)?(\d{1,2})\s*(?:gb|g)\b/);
  if (ram) patch.ramMinGb = Number(ram[1] || ram[2]);
  const storage = text.match(/\b(\d{2,4})\s*(?:gb|g)\s*(?:de\s*)?(?:armazenamento|memoria|espaco|storage)\b|\b(?:armazenamento|memoria|espaco|storage)\s*(?:de\s*)?(\d{2,4})\s*(?:gb|g)\b/);
  if (storage) patch.storageMinGb = Number(storage[1] || storage[2]);

  const normalizedBrands = (Array.isArray(availableBrands) ? availableBrands : [])
    .map((brand) => ({ original: String(brand || '').trim(), normalized: normalizeText(brand) }))
    .filter((brand) => brand.original && brand.normalized);
  const matchedBrand = normalizedBrands.find((brand) => new RegExp(`(?:^|\\s)${brand.normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`).test(text));
  if (matchedBrand) patch.brand = matchedBrand.original;

  const budgetMaxCents = extractBudgetMaxCents(raw, current);
  if (budgetMaxCents) patch.budgetMaxCents = budgetMaxCents;

  const recognized = Object.keys(patch).length > 0;
  const next = normalizePreferenceState({
    ...current,
    active: current.active || recognized,
    family: 'smartphone',
    awaiting: '',
    constraints: { ...current.constraints, ...patch },
    sourceMessages: recognized ? [...current.sourceMessages, raw].slice(-10) : current.sourceMessages,
    updatedAt: recognized ? new Date().toISOString() : current.updatedAt,
  });
  if ((next.constraints.cameraQuality || next.constraints.screenQuality) && !next.constraints.budgetMaxCents) {
    next.awaiting = 'budget';
  }
  return { state: next, recognized, patch };
}

function parseSpecObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function combinedSpecs(product) {
  return { ...parseSpecObject(product?.custom_fields), ...parseSpecObject(product?.specs) };
}

function firstNumber(...values) {
  for (const value of values) {
    const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return 0;
}

function booleanSpec(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (['sim', 'true', 'yes', '1', 'possui'].some((word) => text === word || text.startsWith(`${word} `))) return true;
  if (['nao', 'false', 'no', '0', 'sem'].some((word) => text === word || text.startsWith(`${word} `))) return false;
  return null;
}

function getProductPriceCents(product) {
  const raw = product?.price_promo || product?.price_retail || product?.price || 0;
  return Math.max(0, Math.round(Number(raw) || 0));
}

function cameraScore(product) {
  const specs = combinedSpecs(product);
  const mainMp = firstNumber(specs.cam_principal_mpx, specs.camera_principal_mpx, specs.camera_principal, specs.main_camera_mpx, specs.main_camera_mp, specs.camera);
  const selfieMp = firstNumber(specs.cam_selfie_mpx, specs.camera_frontal_mpx, specs.camera_frontal, specs.selfie_camera_mpx, specs.selfie_camera_mp, specs.selfie);
  const video = normalizeText([specs.resolucao_video_celular, specs.video_resolution, specs.video].filter(Boolean).join(' '));
  const stabilizer = normalizeText([specs.ois, specs.estabilizacao, specs.camera_stabilization].filter(Boolean).join(' '));
  const lenses = normalizeText([specs.camera_ultrawide, specs.ultrawide, specs.lentes_camera, specs.secondary_cameras].filter(Boolean).join(' '));
  let score = 0;
  if (mainMp >= 48) score += 1;
  if (mainMp >= 100) score += 1;
  if (selfieMp >= 8) score += 1;
  if (/4k|2160/.test(video)) score += 2;
  else if (/full hd|1080/.test(video)) score += 1;
  if (/\b(sim|true|ois|optica|optico)\b/.test(stabilizer)) score += 2;
  if (lenses && !/\b(nao|false|sem)\b/.test(lenses)) score += 1;
  return { score, mainMp, selfieMp };
}

function screenScore(product) {
  const specs = combinedSpecs(product);
  const type = normalizeText([specs.tipo_de_display, specs.tipo_de_tela, specs.display, specs.display_type, specs.screen_type].filter(Boolean).join(' '));
  const resolution = normalizeText([specs.resolucao_tela, specs.display_resolution, specs.screen_resolution].filter(Boolean).join(' '));
  const refreshRate = firstNumber(specs.fps_do_display, specs.celular_fps_display, specs.refresh_rate, specs.screen_refresh_rate);
  let score = 0;
  if (/amoled|oled/.test(type)) score += 2;
  if (refreshRate >= 90) score += 1;
  if (refreshRate >= 120) score += 1;
  if (/full hd|fhd|1080|2k|1440/.test(resolution)) score += 1;
  return { score, type, refreshRate };
}

function filterProductsByPreferences(products, preferenceState = {}) {
  const state = normalizePreferenceState(preferenceState);
  const constraints = state.constraints;
  const matches = (Array.isArray(products) ? products : []).filter((product) => {
    if (String(product?.status || 'active') !== 'active') return false;
    if (Number(product?.stock_quantity || 0) <= 0) return false;
    if (Number(product?.is_parent || 0) === 1) return false;
    const specs = combinedSpecs(product);
    if (constraints.budgetMaxCents && getProductPriceCents(product) > constraints.budgetMaxCents) return false;
    if (constraints.brand && normalizeText(product?.brand) !== normalizeText(constraints.brand)) return false;
    if (constraints.nfc != null && booleanSpec(specs.nfc) !== constraints.nfc) return false;
    if (constraints.ramMinGb && firstNumber(specs.ram, specs.memoria_ram, specs.memory_ram) < constraints.ramMinGb) return false;
    if (constraints.storageMinGb && firstNumber(specs.storage, specs.armazenamento, specs.memoria, specs.capacity) < constraints.storageMinGb) return false;
    const camera = cameraScore(product);
    if (constraints.cameraQuality === 'good' && camera.score < 3) return false;
    if (constraints.cameraMinMp && camera.mainMp < constraints.cameraMinMp) return false;
    const screen = screenScore(product);
    if (constraints.screenQuality === 'good' && screen.score < 2) return false;
    if (constraints.screenType && !screen.type.includes(normalizeText(constraints.screenType))) return false;
    if (constraints.refreshRateMinHz && screen.refreshRate < constraints.refreshRateMinHz) return false;
    return true;
  });
  return matches.sort((a, b) => {
    const scoreA = cameraScore(a).score + screenScore(a).score;
    const scoreB = cameraScore(b).score + screenScore(b).score;
    return scoreB - scoreA || getProductPriceCents(a) - getProductPriceCents(b);
  });
}

function hasActionablePreferences(state = {}) {
  const constraints = normalizePreferenceState(state).constraints;
  return Object.values(constraints).some((value) => value !== null && value !== '' && value !== false);
}

module.exports = {
  CATALOG_PREFERENCE_HANDOFF_MESSAGE,
  PHONE_LIST_FOLLOWUP_MESSAGE,
  normalizePreferenceState,
  extractCatalogPreferences,
  filterProductsByPreferences,
  hasActionablePreferences,
  cameraScore,
  screenScore,
  getProductPriceCents,
};
