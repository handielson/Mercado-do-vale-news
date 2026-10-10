import type { Category } from '../types/category';

interface CategorySelectOption {
    id: string;
    path: string;
    depth: number;
}

interface CategorySelectGroup {
    id: string;
    name: string;
    options: CategorySelectOption[];
}

/** Presentation only: category IDs and parent relationships remain owned by the VPS. */
export function buildCategorySelectGroups(
    categories: Pick<Category, 'id' | 'name' | 'parent_id' | 'sort_order'>[]
): CategorySelectGroup[] {
    const ordered = [...categories].sort((a, b) =>
        (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }) ||
        a.id.localeCompare(b.id)
    );
    const byId = new Map(ordered.map(category => [category.id, category]));
    const children = new Map<string, typeof ordered>();
    const roots: typeof ordered = [];
    for (const category of ordered) {
        if (!category.parent_id || !byId.has(category.parent_id) || category.parent_id === category.id) {
            roots.push(category);
        } else {
            const siblings = children.get(category.parent_id) || [];
            siblings.push(category);
            children.set(category.parent_id, siblings);
        }
    }
    const visited = new Set<string>();
    const groups: CategorySelectGroup[] = [];
    const addGroup = (root: (typeof ordered)[number]) => {
        if (visited.has(root.id)) return;
        const group: CategorySelectGroup = { id: root.id, name: root.name, options: [] };
        const walk = (category: (typeof ordered)[number], trail: string[]) => {
            if (visited.has(category.id)) return;
            visited.add(category.id);
            const path = [...trail, category.name];
            group.options.push({ id: category.id, path: path.join(' › '), depth: trail.length });
            for (const child of children.get(category.id) || []) walk(child, path);
        };
        walk(root, []);
        groups.push(group);
    };
    roots.forEach(addGroup);
    // Preserve visibility of malformed legacy relationships without changing data.
    ordered.forEach(addGroup);
    return groups;
}
