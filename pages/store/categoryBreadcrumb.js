/**
 * Reconstroi o caminho completo de uma categoria, da raiz ate a categoria
 * diretamente associada ao produto. Cadastros incompletos e ciclos sao
 * tratados sem impedir a exibicao da pagina publica.
 */
export function buildCategoryBreadcrumb(categories, categoryId) {
    const targetId = String(categoryId || '').trim();
    if (!targetId || !Array.isArray(categories) || categories.length === 0) return [];

    const categoriesById = new Map(
        categories
            .filter(category => category?.id && category?.name)
            .map(category => [String(category.id), category])
    );
    const path = [];
    const visited = new Set();
    let current = categoriesById.get(targetId);

    while (current) {
        const currentId = String(current.id);
        if (visited.has(currentId)) break;

        visited.add(currentId);
        path.unshift(current);

        const parentId = String(current.parent_id || '').trim();
        current = parentId ? categoriesById.get(parentId) : undefined;
    }

    return path;
}
