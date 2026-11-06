// entry-location-groups-v1: o Local da Entrada mostra o depósito de cada local, agrupado.
// Depósito padrão primeiro; dentro dele, o local padrão no topo e o resto em ordem natural
// ("Caixa 2" antes de "Caixa 10"). Locais de depósito desativado ficam fora.

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
export const NO_DEPOSIT_LABEL = 'Sem depósito';

const byDefaultThenName = (a, b) =>
  Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || collator.compare(String(a.name || ''), String(b.name || ''));

/**
 * @param {Array<{id:string,name:string,deposit_id?:string|null,is_default?:boolean,is_active?:boolean}>} locations
 * @param {Array<{id:string,name:string,is_default?:boolean,is_active?:boolean}>|null} deposits null quando a lista de depósitos não carregou
 * @returns {Array<{depositId:string|null,label:string|null,locations:Array}>}
 */
export function groupEntryLocations(locations, deposits) {
  const active = (locations || []).filter(l => l && l.is_active !== false);
  if (!Array.isArray(deposits)) return active.length ? [{ depositId: null, label: null, locations: [...active].sort(byDefaultThenName) }] : [];
  const depositById = new Map(deposits.map(d => [d.id, d]));
  const groups = new Map();
  for (const location of active) {
    const deposit = depositById.get(location.deposit_id);
    if (deposit && deposit.is_active === false) continue;
    const key = deposit ? deposit.id : null;
    if (!groups.has(key)) groups.set(key, { depositId: key, label: deposit ? String(deposit.name || '').trim() || NO_DEPOSIT_LABEL : NO_DEPOSIT_LABEL, deposit, locations: [] });
    groups.get(key).locations.push(location);
  }
  return [...groups.values()]
    .sort((a, b) => {
      if (!a.deposit !== !b.deposit) return a.deposit ? -1 : 1;
      return byDefaultThenName({ is_default: a.deposit?.is_default, name: a.label }, { is_default: b.deposit?.is_default, name: b.label });
    })
    .map(({ depositId, label, locations: list }) => ({ depositId, label, locations: list.sort(byDefaultThenName) }));
}

/** Local padrão para pré-seleção: o padrão do depósito padrão; senão o primeiro local marcado como padrão. */
export function defaultEntryLocationId(groups) {
  const all = (groups || []).flatMap(g => g.locations);
  return (groups?.[0]?.locations.find(l => l.is_default) || all.find(l => l.is_default))?.id || '';
}
