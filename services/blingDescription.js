export function resolveBlingDescription(item = {}) {
  const candidates = [
    item.descricaoComplementar,
    item.descricao,
    item.descricaoCurta,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}
