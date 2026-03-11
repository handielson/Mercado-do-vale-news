import { supabase } from './supabase';

// Cache structure: "mercado-do-vale::[model_id]::[colorName]" -> imageUrl
const memoryCache: Record<string, string | null> = {};
const pendingPromises: Record<string, Promise<string | null>> = {};

export async function getModelImageWithCache(modelId: string, colorName?: string): Promise<string | null> {
    const slug = 'mercado-do-vale';
    const cacheKey = `${slug}::${modelId}::${colorName || 'none'}`;

    if (memoryCache[cacheKey] !== undefined) {
        return memoryCache[cacheKey];
    }

    if (pendingPromises[cacheKey]) {
        return pendingPromises[cacheKey];
    }

    const promise = (async () => {
        try {
            const { data: company } = await supabase
                .from('companies')
                .select('id')
                .eq('slug', slug)
                .single();

            if (!company?.id) return null;

            let imageUrl: string | null = null;
            
            // Tenta buscar pela cor do produto primeiro
            if (colorName) {
                const { data: colorData } = await supabase
                    .from('colors')
                    .select('id')
                    .eq('company_id', company.id)
                    .ilike('name', colorName)
                    .maybeSingle();

                if (colorData?.id) {
                    const { data } = await supabase
                        .from('model_color_images')
                        .select('images')
                        .eq('company_id', company.id)
                        .eq('model_id', modelId)
                        .eq('color_id', colorData.id)
                        .maybeSingle();
                    if (data?.images?.length) imageUrl = data.images[0];
                }
            }

            // Fallback: qualquer foto do modelo, se não achou pela cor
            if (!imageUrl) {
                const { data } = await supabase
                    .from('model_color_images')
                    .select('images')
                    .eq('company_id', company.id)
                    .eq('model_id', modelId)
                    .maybeSingle();
                if (data?.images?.length) imageUrl = data.images[0];
            }

            memoryCache[cacheKey] = imageUrl;
            return imageUrl;
        } catch (error) {
            console.error('Failed to fetch model image in cache list:', error);
            // If error, don't cache forever "null", deleting it allows retries later
            delete pendingPromises[cacheKey];
            return null;
        }
    })();

    pendingPromises[cacheKey] = promise;
    return promise;
}
