// Derived display only: balances/ledger remain the source of truth.
export function groupFilamentStock(items, stock) {
  const groups = new Map();
  const balances = new Map((stock?.balances || []).map(b => [b.filament_id, Number(b.quantity_grams)]));
  for (const f of items) {
    const material = f.material || f.name || 'Material pendente';
    const key = JSON.stringify([material.normalize('NFKC').trim().toLocaleLowerCase('pt-BR'), f.color.normalize('NFKC').trim().toLocaleLowerCase('pt-BR'), f.colorMode || 'single']);
    if (!groups.has(key)) groups.set(key,{key,material,color:f.color,...(f.colorMode === 'gradient' ? {colorNames:f.colorNames} : {}),quantity_grams:0,unknown:false,brands:new Set()});
    const group = groups.get(key);
    group.brands.add(f.brand || 'Marca pendente');
    if (!stock?.enabled || stock.unknown_ids?.includes(f.id)) group.unknown = true;
    else group.quantity_grams = (Math.round(group.quantity_grams * 1000) + Math.round((balances.get(f.id) || 0) * 1000)) / 1000;
  }
  return [...groups.values()].map(g => ({...g,brands:[...g.brands].sort(),quantity_grams:g.unknown ? null : g.quantity_grams})).sort((a,b) => `${a.material} ${a.color}`.localeCompare(`${b.material} ${b.color}`,'pt-BR'));
}
export function filamentEntryDate(movement) {
  if (movement.reason !== 'receipt') return '';
  return String(movement.note || '').match(/^Data de entrada: (\d{4}-\d{2}-\d{2}) \| /)?.[1] || String(movement.created_at || '').slice(0,10);
}

export function filamentColorStyle(color, colorNames, resolveHex) {
  const names = colorNames?.length ? colorNames : [color];
  const hexes = names.map(resolveHex);
  if (!hexes.length || hexes.some(hex => typeof hex !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex))) return undefined;
  return hexes.length > 1 ? {background:`linear-gradient(90deg, ${hexes.join(', ')})`} : {backgroundColor:hexes[0]};
}
