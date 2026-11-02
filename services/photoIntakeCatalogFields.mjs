// Campos do cadastro por foto que já existem no catálogo (marca, modelo, RAM, armazenamento)
// são escolhidos de lista. Aqui fica a comparação entre o que a IA leu e o que está cadastrado.

function stripAccents(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texto comparável: sem acento, espaço ou pontuação, em maiúsculas. */
export function normalizeCatalogText(value) {
  return stripAccents(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** Memória comparável: "8 GB", "8gb" e "8" viram "8GB"; "1 TB" vira "1TB". */
export function normalizeMemoryText(value) {
  const text = normalizeCatalogText(value);
  if (/^\d+$/.test(text)) return `${text}GB`;
  return text;
}

/**
 * Procura a opção cadastrada que corresponde ao valor lido.
 * @param {string[]} options rótulos cadastrados
 * @param {string} value valor lido/atual
 * @param {'text' | 'memory'} kind
 * @returns {string | null} o rótulo cadastrado, ou null quando não existe
 */
export function findCatalogOption(options, value, kind = 'text') {
  const normalize = kind === 'memory' ? normalizeMemoryText : normalizeCatalogText;
  const target = normalize(value);
  if (!target) return null;
  return (Array.isArray(options) ? options : []).find(option => normalize(option) === target) ?? null;
}
