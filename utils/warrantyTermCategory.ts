// Categorias que recebem termo de garantia no PDV (aparelhos: celulares, smartphones e tablets).
// O produto entra se a categoria dele OU uma categoria acima dela (pai, avô...) estiver na lista:
// assim "Smartphones" dentro de "Celulares" e subcategorias novas continuam reconhecidas.
export const WARRANTY_TERM_CATEGORY_KEYS = new Set([
    'smartphones-e-tablet',
    'smartphones-e-tablets',
    'smartphone-e-tablet',
    'smartphone-e-tablets',
    'smartphone',
    'smartphones',
    'celular',
    'celulares',
]);

export function normalizeWarrantyCategoryKey(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function isWarrantyTermCategoryValue(value: unknown): boolean {
    return WARRANTY_TERM_CATEGORY_KEYS.has(normalizeWarrantyCategoryKey(value));
}

type CategoryNode = { id?: string | null; name?: string | null; slug?: string | null; parent_id?: string | null } | null | undefined;

export async function isWarrantyTermCategoryTree(
    categoryId: string | null | undefined,
    getById: (id: string) => Promise<CategoryNode>,
    maxDepth = 6,
): Promise<boolean> {
    const seen = new Set<string>();
    let id = categoryId ? String(categoryId) : '';
    for (let depth = 0; id && depth < maxDepth && !seen.has(id); depth++) {
        seen.add(id);
        const category = await getById(id);
        if (!category) return false;
        if (isWarrantyTermCategoryValue(category.slug) || isWarrantyTermCategoryValue(category.name)) return true;
        id = category.parent_id ? String(category.parent_id) : '';
    }
    return false;
}
