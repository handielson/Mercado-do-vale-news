import { supabase } from './supabase';

// Cache em memória: "mercado-do-vale::[model_id]::[colorName]" -> imageUrl
const memoryCache: Record<string, string | null> = {};
const pendingPromises: Record<string, Promise<string | null>> = {};

// Company_id cacheado no módulo (evita 1 query extra por chamada)
let _cachedCompanyId: string | null = null;

async function getCompanyId(): Promise<string | null> {
    if (_cachedCompanyId) return _cachedCompanyId;
    const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', 'mercado-do-vale')
        .single();
    _cachedCompanyId = data?.id ?? null;
    return _cachedCompanyId;
}

/**
 * Pré-carrega imagens de todos os modelos da lista em UMA única query.
 * Deve ser chamado após carregar a lista de produtos para evitar N+1 por card.
 */
export async function prefetchModelImages(modelIds: string[]): Promise<void> {
    const unique = [...new Set(modelIds)];
    if (unique.length === 0) return;

    // Só busca os model_ids que ainda não estão no cache
    const missing = unique.filter(
        (id) => memoryCache[`mercado-do-vale::${id}::none`] === undefined
    );
    if (missing.length === 0) return;

    const companyId = await getCompanyId();
    if (!companyId) return;

    try {
        // UMA query para todos os modelos que faltam
        const { data } = await supabase
            .from('model_color_images')
            .select('model_id, images')
            .eq('company_id', companyId)
            .in('model_id', missing);

        // Mapa: model_id -> primeira imagem disponível
        const imageByModel: Record<string, string | null> = {};
        for (const row of data ?? []) {
            if (!imageByModel[row.model_id] && row.images?.length) {
                imageByModel[row.model_id] = row.images[0];
            }
        }

        // Preenche cache para todos (incluindo os que não têm imagem → null)
        for (const id of missing) {
            const key = `mercado-do-vale::${id}::none`;
            if (memoryCache[key] === undefined) {
                memoryCache[key] = imageByModel[id] ?? null;
            }
        }
    } catch (error) {
        console.error('[modelImageCache] prefetch falhou:', error);
    }
}

export async function getModelImageWithCache(modelId: string, colorName?: string): Promise<string | null> {
    const cacheKey = `mercado-do-vale::${modelId}::${colorName || 'none'}`;

    if (memoryCache[cacheKey] !== undefined) {
        return memoryCache[cacheKey];
    }

    if (pendingPromises[cacheKey]) {
        return pendingPromises[cacheKey];
    }

    const promise = (async () => {
        try {
            const companyId = await getCompanyId();
            if (!companyId) return null;

            let imageUrl: string | null = null;

            // Tenta buscar pela cor primeiro
            if (colorName) {
                const { data: colorData } = await supabase
                    .from('colors')
                    .select('id')
                    .eq('company_id', companyId)
                    .ilike('name', colorName)
                    .maybeSingle();

                if (colorData?.id) {
                    const { data } = await supabase
                        .from('model_color_images')
                        .select('images')
                        .eq('company_id', companyId)
                        .eq('model_id', modelId)
                        .eq('color_id', colorData.id)
                        .maybeSingle();
                    if (data?.images?.length) imageUrl = data.images[0];
                }
            }

            // Fallback: qualquer foto do modelo
            if (!imageUrl) {
                const fallbackKey = `mercado-do-vale::${modelId}::none`;
                // Aproveita cache do prefetch se disponível
                if (memoryCache[fallbackKey] !== undefined) {
                    imageUrl = memoryCache[fallbackKey];
                } else {
                    const { data } = await supabase
                        .from('model_color_images')
                        .select('images')
                        .eq('company_id', companyId)
                        .eq('model_id', modelId)
                        .maybeSingle();
                    if (data?.images?.length) imageUrl = data.images[0];
                }
            }

            memoryCache[cacheKey] = imageUrl;
            return imageUrl;
        } catch (error) {
            console.error('Failed to fetch model image in cache list:', error);
            delete pendingPromises[cacheKey];
            return null;
        }
    })();

    pendingPromises[cacheKey] = promise;
    return promise;
}
