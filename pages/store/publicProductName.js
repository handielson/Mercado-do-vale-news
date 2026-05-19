const COMMON_COLOR_WORDS = [
  'azul',
  'preto',
  'preta',
  'branco',
  'branca',
  'cinza',
  'grafite',
  'prata',
  'dourado',
  'ouro',
  'verde',
  'vermelho',
  'vermelha',
  'rosa',
  'roxo',
  'roxa',
  'lilas',
  'lilás',
  'amarelo',
  'amarela',
  'transparente',
  'incolor',
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactProductName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripKnownValue(name, value) {
  const cleanValue = compactProductName(value);
  if (!cleanValue) return name;

  const pattern = new RegExp(
    String.raw`(?:\s*(?:[-–—|,/()]|\bcor\s*:?)\s*)?${escapeRegExp(cleanValue)}\s*$`,
    'i',
  );
  return compactProductName(name.replace(pattern, ''));
}

export function getPublicProductName(product) {
  const modelName = compactProductName(product?.model);
  let name = compactProductName(product?.name || modelName || 'Produto');

  const specs = product?.specs || {};
  name = stripKnownValue(name, specs.color);
  name = stripKnownValue(name, specs.ram);
  name = stripKnownValue(name, specs.storage);

  name = name
    .replace(/\s+cor\s*:?\s*$/i, '')
    .replace(/\s+cor\s*:?\s*[-–—|,/()]?\s*$/i, '')
    .replace(/\b(?:ram\s*)?\d+\s*(?:gb|g)\s*\/\s*\d+\s*(?:gb|g)?\b/gi, '')
    .replace(/\b\d+\s*\/\s*\d+\b/gi, '')
    .replace(/\b\d+\s*(?:gb|g)\s*(?:ram)?\b/gi, '')
    .replace(/\bram\s*$/i, '')
    .replace(/\s*(?:[-–—|,/])\s*$/g, '');

  for (const color of COMMON_COLOR_WORDS) {
    name = compactProductName(name).replace(/\s*(?:[-–—|,/]|\bram\b)\s*$/gi, '');
    name = name.replace(new RegExp(String.raw`\s*(?:[-–—|,/]|\bcor\s*:?)?\s*${escapeRegExp(color)}\s*$`, 'i'), '');
  }

  name = compactProductName(name).replace(/\s*(?:[-–—|,/]|\bram\b)\s*$/gi, '').trim();
  return name || modelName || compactProductName(product?.name) || 'Produto';
}
