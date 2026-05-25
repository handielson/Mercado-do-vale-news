function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterModelsForSearch(models, searchTerm, selectedValue = '') {
  const term = normalizeSearch(searchTerm);
  const selected = normalizeSearch(selectedValue);

  if (!term || term === selected) {
    return models;
  }

  const tokens = term.split(/\s+/).filter(Boolean);
  return models.filter((model) => {
    const haystack = normalizeSearch(`${model?.name || ''} ${model?.slug || ''}`);
    return tokens.every((token) => haystack.includes(token));
  });
}
