import { supabase } from './supabase';
import type { ModelEAN, ModelEANInput, EANSearchResult } from '../types/model-architecture';

/**
 * Service: Model EANs
 * Gerencia múltiplos códigos EAN por modelo (variações regionais)
 */
export const modelEANsService = {
    /**
     * Busca modelo por EAN
     */
    async getByEAN(ean: string): Promise<EANSearchResult> {
        const { data, error } = await supabase
            .from('model_eans')
            .select(`
        *,
        model:models (
          id,
          name,
          company_id,
          brand_id,
          category_id,
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
          custom_specs,
          brand:brands(id, name),
          category:categories(id, name)
        )
      `)
            .eq('ean', ean)
            .single();

        if (error || !data) {
            return { found: false };
        }

        return {
            found: true,
            model: data.model as any,
            ean_record: data as ModelEAN
        };
    },

    /**
     * Lista todos os EANs de um modelo
     */
    async getByModelId(modelId: string): Promise<ModelEAN[]> {
        const { data, error } = await supabase
            .from('model_eans')
            .select('*')
            .eq('model_id', modelId)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    /**
     * Adiciona novo EAN a um modelo
     */
    async add(input: ModelEANInput): Promise<ModelEAN> {
        // Validar EAN (13 dígitos)
        if (input.ean.length !== 13) {
            throw new Error('EAN deve ter exatamente 13 dígitos');
        }

        const { data, error } = await supabase
            .from('model_eans')
            .insert({
                model_id: input.model_id,
                ean: input.ean,
                country_code: input.country_code,
                is_primary: input.is_primary || false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Atualiza EAN existente
     */
    async update(id: string, updates: Partial<ModelEANInput>): Promise<ModelEAN> {
        const { data, error } = await supabase
            .from('model_eans')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Define EAN como principal
     */
    async setPrimary(id: string): Promise<void> {
        await this.update(id, { is_primary: true });
    },

    /**
     * Remove EAN
     */
    async remove(id: string): Promise<void> {
        const { error } = await supabase
            .from('model_eans')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Valida código EAN-13 (algoritmo de checksum)
     */
    validateEAN13(ean: string): boolean {
        if (ean.length !== 13) return false;

        const digits = ean.split('').map(Number);
        const checksum = digits.pop();

        const sum = digits.reduce((acc, digit, i) => {
            return acc + digit * (i % 2 === 0 ? 1 : 3);
        }, 0);

        const calculatedChecksum = (10 - (sum % 10)) % 10;
        return calculatedChecksum === checksum;
    },

    /**
     * Busca EAN duplicado
     */
    async checkDuplicate(ean: string): Promise<boolean> {
        const { data } = await supabase
            .from('model_eans')
            .select('id')
            .eq('ean', ean)
            .single();

        return !!data;
    }
};
