/**
 * Helpers para comparação e deduplicação de tags de cross-sell.
 * A regra de match é case-insensitive e accent-insensitive — "Xiaomi" === "xiaomi" === "XIAOMI".
 */

export function normalizeTag(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
}

/**
 * Garante que a tag esteja na lista — não adiciona se já existe (ignorando
 * caixa/acentos). Preserva a grafia original das tags já presentes.
 */
export function ensureTag(existing: string[] | undefined | null, newTag: string): string[] {
    const list: string[] = Array.isArray(existing)
        ? existing.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];
    const trimmed = (newTag || '').trim();
    if (!trimmed) return list;
    const norm = normalizeTag(trimmed);
    if (list.some(t => normalizeTag(t) === norm)) return list;
    return [...list, trimmed];
}

/** Aceita também specs.tags_venda como string JSON ou null. */
export function parseTagsVenda(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    }
    if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                : [];
        } catch { /* fall through */ }
    }
    return [];
}
