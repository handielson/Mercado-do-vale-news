export const SALES_UNIT_PREFERENCE_KEY = 'products.sales-units.v1';
export const DEFAULT_SALES_UNITS = Object.freeze([
    'UN', 'PAR', 'KIT', 'CX', 'PCT', 'DZ', 'ROLO', 'M', 'M²', 'M³', 'KG', 'G', 'L', 'ML',
]);
export const SALES_UNIT_LABELS = {
    UN: 'Unidade', PAR: 'Par', KIT: 'Kit', CX: 'Caixa', PCT: 'Pacote',
    DZ: 'Dúzia', ROLO: 'Rolo', M: 'Metro', 'M²': 'Metro quadrado',
    'M³': 'Metro cúbico', KG: 'Quilograma', G: 'Grama', L: 'Litro', ML: 'Mililitro',
};
export function normalizeSalesUnit(value) {
    if (typeof value !== 'string') throw new Error('Informe uma unidade válida.');
    const unit = value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
    if (!unit || unit.length > 20 || /[<>\u0000-\u001f\u007f]/u.test(value))
        throw new Error('Informe uma unidade com até 20 caracteres, sem código HTML.');
    return unit;
}
export function salesUnitCatalog(saved) {
    if (saved != null && !Array.isArray(saved)) throw new Error('Cadastro de unidades inválido.');
    return [...new Set([...DEFAULT_SALES_UNITS, ...(saved || []).map(normalizeSalesUnit)])];
}
