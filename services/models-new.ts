import { supabase } from './supabase';
import type { Model, ModelInput, ModelWithDetails } from '../types/model-architecture';
import { modelEANsService } from './model-eans';

/**
 * MODEL SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

// TEMPORARY: Hardcoded company_id until we implement auth
const TEMP_COMPANY_ID = 'mercado-do-vale';

/**
 * Get company_id from companies table by slug
 */
async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', TEMP_COMPANY_ID)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

/**
 * Generate URL-friendly slug from model name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * List all models
 */
async function list(): Promise<Model[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch models: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        company_id: row.company_id,
        name: row.name,
        slug: row.slug,
        brand_id: row.brand_id,
        category_id: row.category_id,
        description: row.description,

        // Especificações Técnicas
        processor: row.processor,
        chipset: row.chipset,
        battery_mah: row.battery_mah,
        display: row.display,
        main_camera_mpx: row.main_camera_mpx,
        selfie_camera_mpx: row.selfie_camera_mpx,
        nfc: row.nfc,
        network: row.network,
        resistencia: row.resistencia,
        antutu: row.antutu,
        custom_specs: row.custom_specs,

        // Logística
        weight_kg: row.weight_kg,
        width_cm: row.width_cm,
        height_cm: row.height_cm,
        depth_cm: row.depth_cm,

        // Campos antigos (compatibilidade)
        template_values: row.template_values,
        default_category_id: row.default_category_id,
        default_description: row.default_description,

        created_at: row.created_at,
        updated_at: row.updated_at
    }));
}

/**
 * Get model by ID
 */
async function getById(id: string): Promise<Model | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch model: ${error.message}`);
    }

    return {
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        slug: data.slug,
        brand_id: data.brand_id,
        category_id: data.category_id,
        description: data.description,

        // Especificações Técnicas
        processor: data.processor,
        chipset: data.chipset,
        battery_mah: data.battery_mah,
        display: data.display,
        main_camera_mpx: data.main_camera_mpx,
        selfie_camera_mpx: data.selfie_camera_mpx,
        nfc: data.nfc,
        network: data.network,
        resistencia: data.resistencia,
        antutu: data.antutu,
        custom_specs: data.custom_specs,

        // Logística
        weight_kg: data.weight_kg,
        width_cm: data.width_cm,
        height_cm: data.height_cm,
        depth_cm: data.depth_cm,

        // Campos antigos (compatibilidade)
        template_values: data.template_values,
        default_category_id: data.default_category_id,
        default_description: data.default_description,

        created_at: data.created_at,
        updated_at: data.updated_at
    };
}

/**
 * Get models by brand ID
 */
async function listByBrand(brandId: string): Promise<Model[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .eq('brand_id', brandId)
        .order('name');

    if (error) throw new Error(`Failed to fetch models by brand: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        brand_id: row.brand_id,
        active: true,
        created: row.created_at,
        updated: row.updated_at,
        // Template fields
        category_id: row.category_id,
        description: row.description,
        template_values: row.template_values
    }));
}

/**
 * Create new model
 */
async function create(input: ModelInput): Promise<Model> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    // Construir objeto apenas com campos que têm valor
    const insertData: any = {
        company_id: companyId,
        brand_id: input.brand_id,
        category_id: input.category_id,
        name: input.name,
        slug,
    };

    // Adicionar campos opcionais apenas se tiverem valor
    if (input.description !== undefined) insertData.description = input.description;

    // Especificações técnicas
    if (input.processor !== undefined) insertData.processor = input.processor;
    if (input.chipset !== undefined) insertData.chipset = input.chipset;
    if (input.battery_mah !== undefined) insertData.battery_mah = input.battery_mah;
    if (input.display !== undefined) insertData.display = input.display;
    if (input.main_camera_mpx !== undefined) insertData.main_camera_mpx = input.main_camera_mpx;
    if (input.selfie_camera_mpx !== undefined) insertData.selfie_camera_mpx = input.selfie_camera_mpx;
    if (input.nfc !== undefined) insertData.nfc = input.nfc;
    if (input.network !== undefined) insertData.network = input.network;
    if (input.resistencia !== undefined) insertData.resistencia = input.resistencia;
    if (input.antutu !== undefined) insertData.antutu = input.antutu;

    // Logística
    if (input.weight_kg !== undefined) insertData.weight_kg = input.weight_kg;
    if (input.width_cm !== undefined) insertData.width_cm = input.width_cm;
    if (input.height_cm !== undefined) insertData.height_cm = input.height_cm;
    if (input.depth_cm !== undefined) insertData.depth_cm = input.depth_cm;

    // Custom specs
    if (input.custom_specs !== undefined) insertData.custom_specs = input.custom_specs;

    // Log detalhado para debug
    console.log('💾 [modelsService.create] Inserting data:', insertData);

    // Verificar tamanho dos campos string
    const stringFields = ['processor', 'chipset', 'main_camera_mpx', 'selfie_camera_mpx',
        'nfc', 'network', 'resistencia', 'antutu'];
    stringFields.forEach(field => {
        if (insertData[field]) {
            const length = insertData[field].length;
            console.log(`📏 [${field}]: "${insertData[field]}" (${length} chars)`);
            if (length > 50) {
                console.warn(`⚠️ [${field}] EXCEDE 50 caracteres!`);
            }
        }
    });

    const { data, error } = await supabase
        .from('models')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error('❌ [modelsService.create] Error:', error);
        throw new Error(`Failed to create model: ${error.message}`);
    }

    console.log('✅ [modelsService.create] Model created successfully:', data.id);
    return data;
}

/**
 * Update existing model
 */
async function update(id: string, input: Partial<ModelInput>): Promise<Model> {
    const companyId = await getCompanyId();

    const updateData: any = {};

    // Campos básicos
    if (input.name) {
        updateData.name = input.name;
        updateData.slug = generateSlug(input.name);
    }
    if (input.brand_id) updateData.brand_id = input.brand_id;
    if (input.category_id) updateData.category_id = input.category_id;
    if (input.description !== undefined) updateData.description = input.description;

    // Especificações técnicas (permitir null para limpar)
    if (input.processor !== undefined) updateData.processor = input.processor;
    if (input.chipset !== undefined) updateData.chipset = input.chipset;
    if (input.battery_mah !== undefined) updateData.battery_mah = input.battery_mah;
    if (input.display !== undefined) updateData.display = input.display;
    if (input.main_camera_mpx !== undefined) updateData.main_camera_mpx = input.main_camera_mpx;
    if (input.selfie_camera_mpx !== undefined) updateData.selfie_camera_mpx = input.selfie_camera_mpx;
    if (input.nfc !== undefined) updateData.nfc = input.nfc;
    if (input.network !== undefined) updateData.network = input.network;
    if (input.resistencia !== undefined) updateData.resistencia = input.resistencia;
    if (input.antutu !== undefined) updateData.antutu = input.antutu;

    // Logística
    if (input.weight_kg !== undefined) updateData.weight_kg = input.weight_kg;
    if (input.width_cm !== undefined) updateData.width_cm = input.width_cm;
    if (input.height_cm !== undefined) updateData.height_cm = input.height_cm;
    if (input.depth_cm !== undefined) updateData.depth_cm = input.depth_cm;

    // Campos personalizados
    if (input.custom_specs !== undefined) updateData.custom_specs = input.custom_specs;

    const { data, error } = await supabase
        .from('models')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update model: ${error.message}`);

    return data;
}

/**
 * Delete model
 */
async function deleteModel(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete model: ${error.message}`);
}

/**
 * Get only active models
 */
async function listActive(): Promise<Model[]> {
    return list();
}

/**
 * Get active models by brand
 */
async function listActiveByBrand(brandId: string): Promise<Model[]> {
    return listByBrand(brandId);
}

export const modelService = {
    list,
    getById,
    listByBrand,
    create,
    update,
    delete: deleteModel,
    listActive,
    listActiveByBrand
};

// Compatibilidade com código que usa modelsService
export const modelsService = modelService;
