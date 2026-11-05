// Stubs dos serviços usados pela tela Entrada nos testes de navegador (dados vêm de window.fixtures).
export const serviceStubs = {
    models: `export const modelService = { list: async () => window.fixtures.models, getById: async id => window.fixtures.models.find(m => m.id === id) || null };`,
    categories: `export const categoryService = { getById: async id => window.fixtures.categories[id] || null, list: async () => Object.values(window.fixtures.categories) };`,
    'model-color-images': `export const modelColorImagesService = { getByModel: async id => window.fixtures.modelColors.filter(r => r.model_id === id) };`,
    colors: `export const colorService = { list: async () => window.fixtures.colors, listActive: async () => window.fixtures.colors }; export const getColorHex = () => undefined; export const COLOR_MAP = {};`,
    stockLocationService: `const s = { listLocations: async () => window.fixtures.locations }; export const stockLocationService = s; export default s;`,
};

export const defaultFixtures = {
    models: [
        { id: 'm1', name: 'Redmi 15', category_id: 'c1', active: true },
        { id: 'm2', name: 'Capa Silicone', category_id: 'c2', active: true },
    ],
    categories: { c1: { id: 'c1', name: 'Celulares' }, c2: { id: 'c2', name: 'Acessórios' } },
    colors: [{ id: 'k1', name: 'Verde', active: true }, { id: 'k2', name: 'Preto', active: true }, { id: 'k3', name: 'Rosa', active: true }],
    modelColors: [
        { id: 'r1', model_id: 'm1', color_id: 'k1', images: ['a.jpg'] },
        { id: 'r2', model_id: 'm1', color_id: 'k2', images: ['b.jpg'] },
    ],
    locations: [{ id: 'l1', name: 'Prateleira A', code: 'A', is_default: false, is_active: true }, { id: 'l2', name: 'Vitrine', code: 'V', is_default: true, is_active: true }],
};

/** Plugin Vite que troca os serviços por stubs. */
export function stubPlugin(extra = {}) {
    const all = { ...serviceStubs, ...extra };
    return {
        name: 'entrada-service-stubs', enforce: 'pre',
        resolveId(id) {
            const m = /\/services\/([\w-]+)(?:\.ts)?$/.exec(id);
            if (m && all[m[1]]) return `\0stub-${m[1]}`;
        },
        load(id) { if (id.startsWith('\0stub-')) return all[id.slice(6)]; },
    };
}
