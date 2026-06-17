import { Product } from '../types/product';
import { ProductFiltersState } from '../components/products/ProductFilters';

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
    let filtered = [...products];

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
