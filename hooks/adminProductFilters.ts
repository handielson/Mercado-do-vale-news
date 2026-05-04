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

export function filterAdminProducts(products: Product[], filters: ProductFiltersState): Product[] {
    let filtered = [...products];

    if (filters.search.trim() !== '') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(product => {
            const nameMatch = (product.name || '').toLowerCase().includes(searchLower);
            const skuMatch = (product.sku || '').toLowerCase().includes(searchLower);
            const eanMatch = (product.eans || []).some(ean => ean?.toLowerCase().includes(searchLower));
            const blingMatch = product.bling_id?.toString().includes(searchLower);

            return nameMatch || skuMatch || eanMatch || blingMatch;
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
