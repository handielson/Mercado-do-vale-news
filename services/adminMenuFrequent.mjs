// "Mais usados" do menu do admin: conta as páginas abertas (histórico de navegação do admin)
// e devolve os itens do menu mais visitados por esta pessoa.

/** Item do menu que corresponde a um caminho (o mais específico vence, como o item ativo do menu). */
export function menuItemForPath(pathname, items) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  let best = null;
  for (const item of items) {
    const to = item.to;
    if (path === to || (to !== '/admin' && path.startsWith(`${to}/`))) {
      if (!best || to.length > best.to.length) best = item;
    }
  }
  return best;
}

/**
 * @param rows linhas do histórico ({ pathname, created_at, customer_id, user_id })
 * @param items itens do menu ({ to, label, ... })
 * @param options.customerId / options.userId: conta só as visitas desta pessoa (se houver alguma dela)
 * @param options.limit quantos itens devolver
 */
export function computeFrequentMenuItems(rows, items, { customerId = null, userId = null, limit = 6 } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const mine = list.filter(row => (customerId && row.customer_id === customerId) || (userId && row.user_id === userId));
  const source = mine.length ? mine : list;
  const stats = new Map();
  for (const row of source) {
    const item = menuItemForPath(row.pathname, items);
    if (!item) continue;
    const time = Date.parse(row.created_at || '') || 0;
    const current = stats.get(item.to) || { item, count: 0, last: 0 };
    current.count += 1;
    current.last = Math.max(current.last, time);
    stats.set(item.to, current);
  }
  return [...stats.values()]
    .sort((left, right) => right.count - left.count || right.last - left.last)
    .slice(0, limit)
    .map(entry => entry.item);
}
