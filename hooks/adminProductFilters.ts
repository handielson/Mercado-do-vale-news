import { Product } from '../types/product';
import { ProductFiltersState } from '../components/products/ProductFilters';
import { isArchivedProductRecord } from '../utils/localProductVisibility';

export function mergeProductsById(current: Product[], incoming: Product[]): Product[] {
    const byId = new Map(current.map(product => [product.id, product]));
    const appended: Product[] = [];

    for (const product of incoming) {
        if (byId.has(product.id)) {
            byId.set(product.id, { ...byId.get(product.id)!, ...product });
        } else {
            byId.set(product.id, product);
            appended.push(product);
        }
    }

    return current.map(product => byId.get(product.id) || product).concat(appended);
}

function normalizeSearchValue(value: unknown): string {
    return String(value ?? '').toLowerCase();
}

function normalizeCommercialValue(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCapacityValue(value: unknown): string {
    return normalizeCommercialValue(value).replace(/\s+/g, '').replace(/gib\b/g, 'gb');
}

function getSerializedCommercialKey(product: Product): string | null {
    const specs = product.specs || {};
    const modelId = normalizeCommercialValue(product.model_id);
    const sku = normalizeCommercialValue(product.sku);
    const ram = normalizeCapacityValue(specs.ram);
    const storage = normalizeCapacityValue(specs.storage || specs.armazenamento);
    const color = normalizeCommercialValue(specs.color || specs.cor);
    const version = normalizeCommercialValue(specs.version || specs.versao);

    // RAM + armazenamento + cor caracterizam as variacoes de celulares e
    // tablets. Esta trava impede agrupar por engano produtos comuns que
    // reutilizem um SKU (por exemplo, trilhos ou acessorios).
    if (!modelId || !sku || !ram || !storage || !color) return null;

    const eans = (product.eans || []).map(normalizeCommercialValue).filter(Boolean).sort().join(',');
    const blingId = normalizeCommercialValue(product.bling_id);
    return [modelId, sku, ram, storage, color, version, eans, blingId].join('|');
}

export function groupEquivalentSerializedProducts(products: Product[]): Product[] {
    const groups = new Map<string, Product[]>();
    const standalone: Product[] = [];

    for (const product of products) {
        const key = getSerializedCommercialKey(product);
        if (!key) {
            standalone.push(product);
            continue;
        }
        const group = groups.get(key) || [];
        group.push(product);
        groups.set(key, group);
    }

    const grouped = [...groups.values()].map(group => {
        if (group.length === 1) return group[0];

        const canonical = [...group].sort((a, b) => {
            const unitDelta = Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
            if (unitDelta !== 0) return unitDelta;
            return new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime();
        })[0];
        const images = group.flatMap(product => product.images || []).filter((url, index, all) => url && all.indexOf(url) === index);
        const availableUnits = group.flatMap(product => (product as any).available_units || []);

        return {
            ...canonical,
            images: images.length > 0 ? images : canonical.images,
            stock_quantity: group.reduce((total, product) => total + Number(product.stock_quantity || 0), 0),
            equivalent_product_ids: group.map(product => product.id),
            ...(availableUnits.length > 0 ? { available_units: availableUnits } : {}),
        };
    });

    return [...standalone, ...grouped];
}

function collectSerializedSearchValues(product: Product): string[] {
    const specs = product.specs || {};
    const values: unknown[] = [
        specs.imei1,
        specs.imei_1,
        specs.imei,
        specs.imei2,
        specs.imei_2,
        specs.serial,
        specs.serial_number,
        (product as any).imei1,
        (product as any).imei_1,
        (product as any).imei2,
        (product as any).imei_2,
        (product as any).serial,
        (product as any).serial_number,
    ];

    const units = [
        ...((product as any).units || []),
        ...((product as any).available_units || []),
    ];

    for (const unit of units) {
        values.push(
            unit?.imei1,
            unit?.imei_1,
            unit?.imei,
            unit?.imei2,
            unit?.imei_2,
            unit?.serial,
            unit?.serial_number,
        );
    }

    return values.map(normalizeSearchValue).filter(Boolean);
}

export function filterAdminProducts(products: Product[], filters: ProductFiltersState): Product[] {
    let filtered = products.filter(product => !isArchivedProductRecord(product));

    if (filters.search.trim() !== '') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(product => {
            const nameMatch = normalizeSearchValue(product.name).includes(searchLower);
            const skuMatch = normalizeSearchValue(product.sku).includes(searchLower);
            const eanMatch = (product.eans || []).some(ean => normalizeSearchValue(ean).includes(searchLower));
            const blingMatch = product.bling_id?.toString().includes(searchLower);
            const serializedMatch = collectSerializedSearchValues(product)
                .some(value => value.includes(searchLower));

            return nameMatch || skuMatch || eanMatch || blingMatch || serializedMatch;
        });
    }

    if (filters.status !== 'all') {
        filtered = filtered.filter(product => product.status === filters.status);
    }

    if (filters.imageStatus === 'with_image') {
        filtered = filtered.filter(product => product.images && product.images.length > 0);
    } else if (filters.imageStatus === 'without_image') {
        filtered = filtered.filter(product => !product.images || product.images.length === 0);
    }

    if (filters.parentVisibility === 'hide_parents') {
        filtered = filtered.filter(product => !product.is_parent);
    } else if (filters.parentVisibility === 'only_parents') {
        filtered = filtered.filter(product => product.is_parent);
    }

    if (filters.brand && filters.brand !== 'all') {
        const target = filters.brand.toLowerCase();
        filtered = filtered.filter(product => (product.brand || '').toLowerCase() === target);
    }

    if (filters.categoryId && filters.categoryId !== 'all') {
        filtered = filtered.filter(product => product.category_id === filters.categoryId);
    }

    if (filters.shopeeStatus === 'synced') {
        filtered = filtered.filter(product => {
            const id = (product as any).shopee_item_id;
            return id != null && String(id).trim() !== '' && Number(id) > 0;
        });
    } else if (filters.shopeeStatus === 'not_synced') {
        filtered = filtered.filter(product => {
            const id = (product as any).shopee_item_id;
            return !id || String(id).trim() === '' || Number(id) <= 0;
        });
    }

    if (filters.videoStatus === 'with_video') {
        filtered = filtered.filter(product => !!((product as any).video_url || '').trim());
    } else if (filters.videoStatus === 'without_video') {
        filtered = filtered.filter(product => !((product as any).video_url || '').trim());
    }

    filtered = groupEquivalentSerializedProducts(filtered);

    filtered.sort((a, b) => {
        switch (filters.sortBy) {
            case 'newest':
                return new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
            case 'oldest':
                return new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime();
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    return filtered;
}
