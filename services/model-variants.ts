import { supabase } from './supabase';
import type {
    ModelVariant,
    ModelVariantInput,
    ModelVariantWithDetails,
    ModelVariantImage,
    ModelVariantImageInput,
    VariantSearchParams,
    ImageUploadResult
} from '../types/model-architecture';

/**
 * Service: Model Variants
 * Gerencia variantes de modelos (Modelo + Versão + Cor) e suas imagens
 */
export const modelVariantsService = {
    /**
     * Busca ou cria variante
     */
    async getOrCreate(params: VariantSearchParams): Promise<ModelVariant> {
        // Tentar buscar variante existente
        const { data: existing } = await supabase
            .from('model_variants')
            .select('*')
            .eq('model_id', params.model_id)
            .eq('version_id', params.version_id)
            .eq('color_id', params.color_id)
            .single();

        if (existing) return existing;

        // Criar nova variante
        const { data, error } = await supabase
            .from('model_variants')
            .insert({
                model_id: params.model_id,
                version_id: params.version_id,
                color_id: params.color_id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Busca variante com todos os detalhes
     */
    async getWithDetails(variantId: string): Promise<ModelVariantWithDetails | null> {
        const { data, error } = await supabase
            .from('model_variants')
            .select(`
        *,
        model:models (
          id,
          name,
          brand:brands(id, name),
          category:categories(id, name),
          processor,
          chipset,
          battery_mah,
          display,
          main_camera_mpx,
          selfie_camera_mpx,
          nfc,
          network,
          resistencia,
          antutu,
          custom_specs
        ),
        version:versions (id, name),
        color:colors (id, name, hex_code),
        images:model_variant_images (
          id,
          image_url,
          display_order,
          is_primary,
          created_at
        )
      `)
            .eq('id', variantId)
            .single();

        if (error) return null;

        return {
            ...data,
            image_count: data.images?.length || 0
        } as ModelVariantWithDetails;
    },

    /**
     * Lista variantes de um modelo
     */
    async getByModelId(modelId: string): Promise<ModelVariantWithDetails[]> {
        const { data, error } = await supabase
            .from('model_variants')
            .select(`
        *,
        model:models (id, name),
        version:versions (id, name),
        color:colors (id, name, hex_code),
        images:model_variant_images (id, image_url, display_order, is_primary)
      `)
            .eq('model_id', modelId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(v => ({
            ...v,
            image_count: v.images?.length || 0
        })) as ModelVariantWithDetails[];
    },

    /**
     * Remove variante
     */
    async remove(variantId: string): Promise<void> {
        const { error } = await supabase
            .from('model_variants')
            .delete()
            .eq('id', variantId);

        if (error) throw error;
    },

    // ========================================================================
    // IMAGENS
    // ========================================================================

    /**
     * Lista imagens de uma variante
     */
    async getImages(variantId: string): Promise<ModelVariantImage[]> {
        const { data, error } = await supabase
            .from('model_variant_images')
            .select('*')
            .eq('variant_id', variantId)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    /**
     * Adiciona imagem a uma variante
     */
    async addImage(input: ModelVariantImageInput): Promise<ModelVariantImage> {
        const { data, error } = await supabase
            .from('model_variant_images')
            .insert({
                variant_id: input.variant_id,
                image_url: input.image_url,
                display_order: input.display_order || 0,
                is_primary: input.is_primary || false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Upload de imagem para Supabase Storage
     */
    async uploadImage(
        variantId: string,
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<ImageUploadResult> {
        try {
            // Gerar nome único
            const fileExt = file.name.split('.').pop();
            const fileName = `${variantId}/${Date.now()}.${fileExt}`;

            // Upload para storage
            const { data, error } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Obter URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(data.path);

            return {
                success: true,
                image_url: publicUrl
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao fazer upload'
            };
        }
    },

    /**
     * Reordena imagens
     */
    async reorderImages(variantId: string, imageIds: string[]): Promise<void> {
        // Atualizar display_order de cada imagem
        const updates = imageIds.map((id, index) =>
            supabase
                .from('model_variant_images')
                .update({ display_order: index })
                .eq('id', id)
                .eq('variant_id', variantId)
        );

        await Promise.all(updates);
    },

    /**
     * Define imagem como principal
     */
    async setPrimaryImage(imageId: string): Promise<void> {
        await supabase
            .from('model_variant_images')
            .update({ is_primary: true })
            .eq('id', imageId);
    },

    /**
     * Remove imagem
     */
    async removeImage(imageId: string): Promise<void> {
        // Buscar URL da imagem
        const { data: image } = await supabase
            .from('model_variant_images')
            .select('image_url')
            .eq('id', imageId)
            .single();

        if (image) {
            // Extrair path do storage da URL
            const path = image.image_url.split('/product-images/')[1];

            if (path) {
                // Deletar do storage
                await supabase.storage
                    .from('product-images')
                    .remove([path]);
            }
        }

        // Deletar registro do banco
        await supabase
            .from('model_variant_images')
            .delete()
            .eq('id', imageId);
    }
};
