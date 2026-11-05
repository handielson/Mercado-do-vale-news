// Stubs dos serviços usados pela tela Entrada nos testes de navegador (dados vêm de window.fixtures).
export const serviceStubs = {
    models: `export const modelService = { list: async () => window.fixtures.models, listActive: async () => window.fixtures.models, getById: async id => window.fixtures.models.find(m => m.id === id) || null, create: async () => null };`,
    categories: `export const categoryService = { getById: async id => window.fixtures.categories[id] || null, list: async () => Object.values(window.fixtures.categories) };`,
    'model-color-images': `export const modelColorImagesService = { getByModel: async id => window.fixtures.modelColors.filter(r => r.model_id === id) };`,
    colors: `export const colorService = { list: async () => window.fixtures.colors, listActive: async () => window.fixtures.colors, refreshActive: async () => window.fixtures.colors }; export const getColorHex = () => undefined; export const COLOR_MAP = {};`,
    products: `export const productService = { getById: async id => window.fixtures.products?.[id] || null }; export default productService;`,
    stockLocationService: `const s = { listLocations: async () => window.fixtures.locations }; export const stockLocationService = s; export default s;`,
};

/**
 * Stubs da página de cadastro por foto (aba Foto). Fila em window.fixtures.photoIntakes;
 * chamadas registradas em window.photoCalls.{list,finalize}.
 */
export const photoServiceStubs = {
    smartphonePhotoIntakeService: `const log = (k, v) => { window.photoCalls ||= {}; (window.photoCalls[k] ||= []).push(v); };
export const smartphonePhotoIntakeService = {
    list: async () => { log('list', true); return JSON.parse(JSON.stringify(window.fixtures.photoIntakes || [])); },
    listMargins: async () => [], listColorMappings: async () => [],
    finalize: async (id, input) => { log('finalize', { id, input }); const it = window.fixtures.photoIntakes.find(i => i.id === id); return { ...it, status: 'completed' }; },
    loadProtectedPhoto: async () => new Blob(['x'], { type: 'image/png' }),
    update: async (id, input) => ({ ...window.fixtures.photoIntakes.find(i => i.id === id), ...input }),
};`,
    brands: `export const brandService = { listActive: async () => window.fixtures.brands || [] };`,
    photoIntakeCatalogLists: `export async function loadPhotoIntakeCatalogLists() { return { brands: window.fixtures.brands || [], rams: ['8GB'], storages: ['256GB'] }; }`,
    smartphonePriceGroups: `export const smartphonePriceGroups = {
    reference: async () => window.fixtures.priceReference,
    list: async () => ({ enabled: true, groups: [{ id: 'g1', cost_average_in_stock: null, last_purchase_cost: null }], unresolved: [] }),
};`,
    vpsClient: `export const vpsClient = { get: async () => ({}), put: async () => ({}), post: async () => ({}) };`,
    'versions-vps': `export const versionService = { listActive: async () => [{ id: 'v1', name: 'Global', active: true }], create: async () => null };`,
    units: `export const unitService = {};`,
    barcodeScanner: `export const decodeImageFile = async () => []; export const imageDataFrom = () => null; export const loadBarcodeDecoder = async () => null;`,
};

const photoPrices = { price_cost: 80000, price_retail: 120000, price_reseller: 110000, price_wholesale: 100000 };
const photoBase = {
    company_id: 'co1', detected_brand: 'Xiaomi', detected_model: 'Redmi 15', detected_ram: '8GB', detected_storage: '256GB',
    detected_version: 'Global', matched_brand_id: 'b1', matched_model_id: 'm1', prices_confirmed: 1, review_confirmed: 1,
    validation_errors: [], validation_warnings: [], ...photoPrices,
};

export const photoFixtures = {
    brands: [{ id: 'b1', name: 'Xiaomi', active: true }],
    priceReference: { controlled: true, established: true, group_id: 'g1', prices: { price_retail: 120000, price_reseller: 110000, price_wholesale: 100000 } },
    photoIntakes: [
        { ...photoBase, id: 'pi-ready', status: 'ready_to_finalize', detected_color: 'Verde', matched_color_id: 'k1', detected_imei_1: '863715061138763', detected_imei_2: '863715061138771', created_at: '2026-11-05T10:00:00Z' },
        { ...photoBase, id: 'pi-done', status: 'completed', detected_color: 'Preto', matched_color_id: 'k2', detected_imei_1: '356938035643809', created_at: '2026-11-04T10:00:00Z', completed_at: '2026-11-04T11:00:00Z' },
    ],
};

export const defaultFixtures = {
    models: [
        { id: 'm3', name: 'Poco X8', category_id: 'c1', active: true },
        { id: 'm4', name: 'Sem Categoria Boa', category_id: 'cX', active: true },
        { id: 'm1', name: 'Redmi 15', category_id: 'c1', active: true },
        { id: 'm2', name: 'Capa Silicone', category_id: 'c2', active: true },
    ],
    categories: { c1: { id: 'c1', name: 'Celulares' }, c2: { id: 'c2', name: 'Acessórios' } },
    colors: [{ id: 'k1', name: 'Verde', active: true }, { id: 'k2', name: 'Preto', active: true }, { id: 'k3', name: 'Rosa', active: true }],
    modelColors: [
        { id: 'r1', model_id: 'm1', color_id: 'k1', images: ['a.jpg'] },
        { id: 'r2', model_id: 'm1', color_id: 'k2', images: ['b.jpg'] },
    ],
    products: {
        p1: { id: 'p1', name: 'Redmi 15', model_id: 'm1', category_id: 'c1', specs: { ram: '8GB', storage: '256GB', color: 'Verde' } },
        p3: { id: 'p3', name: 'Redmi Pai', model_id: 'm1', category_id: 'c1', specs: {} },
        p4: { id: 'p4', name: 'Capa Silicone', model_id: 'm2', category_id: 'c2', specs: { ram: '8GB', storage: '256GB', color: 'Preto' } },
        p5: { id: 'p5', name: 'Sem Categoria Boa', model_id: 'm4', category_id: 'cX', specs: { ram: '8GB', storage: '256GB', color: 'Preto' } },
        p2: { id: 'p2', name: 'Poco X8', model_id: 'm3', category_id: 'c1', specs: { ram: '12GB', storage: '512GB', color: 'Preto', version: 'India', condition: 'seminovo' } },
    },
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
