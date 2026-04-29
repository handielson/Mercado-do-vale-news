/**
 * Warranty Document Service
 * Handles CRUD operations for warranty documents
 */

import { supabase } from './supabase';
import { WarrantyDocument, WarrantyDocumentInput } from '../types/warrantyDocument';

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


export const warrantyDocumentService = {
    /**
     * Create a new warranty document. Aceita `id` pré-gerado pra que o número
     * do termo (numero_documento) possa ser renderizado no template antes do save.
     */
    async create(input: WarrantyDocumentInput): Promise<WarrantyDocument> {
        const companyId = await getCompanyId();

        const payload: Record<string, any> = {
            company_id: companyId,
            sale_id: input.sale_id ?? null,
            order_id: input.order_id ?? null,
            customer_id: input.customer_id ?? null,
            serialized_unit_id: input.serialized_unit_id ?? null,
            delivery_type: input.delivery_type ?? null,
            customer_signature: input.customer_signature,
            warranty_content: input.warranty_content,
        };
        if (input.id) payload.id = input.id;

        const { data, error } = await supabase
            .from('warranty_documents')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Error creating warranty document:', error);
            throw new Error('Erro ao criar documento de garantia');
        }

        return data as WarrantyDocument;
    },

    /**
     * Lista todos os documentos de uma venda (1 por aparelho serializado).
     */
    async listBySaleId(saleId: string): Promise<WarrantyDocument[]> {
        const companyId = await getCompanyId();
        const { data, error } = await supabase
            .from('warranty_documents')
            .select('*')
            .eq('company_id', companyId)
            .eq('sale_id', saleId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('Error listing warranty documents by sale_id:', error);
            throw new Error('Erro ao listar documentos de garantia');
        }
        return (data || []) as WarrantyDocument[];
    },

    /**
     * Get warranty document by order ID (pedidos online)
     */
    async getByOrderId(orderId: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('warranty_documents')
            .select('*')
            .eq('company_id', companyId)
            .eq('order_id', orderId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching warranty document by order_id:', error);
            throw new Error('Erro ao buscar documento de garantia');
        }

        return data as WarrantyDocument | null;
    },

    /**
     * Get warranty document by sale ID
     */
    async getBySaleId(saleId: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('warranty_documents')
            .select('*')
            .eq('company_id', companyId)
            .eq('sale_id', saleId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            console.error('Error fetching warranty document:', error);
            throw new Error('Erro ao buscar documento de garantia');
        }

        return data as WarrantyDocument;
    },

    /**
     * Get warranty document by ID
     */
    async getById(id: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('warranty_documents')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            console.error('Error fetching warranty document:', error);
            throw new Error('Erro ao buscar documento de garantia');
        }

        return data as WarrantyDocument;
    },

    /**
     * List all warranty documents
     */
    async list(): Promise<WarrantyDocument[]> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('warranty_documents')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error listing warranty documents:', error);
            throw new Error('Erro ao listar documentos de garantia');
        }

        return (data || []) as WarrantyDocument[];
    },

    /**
     * Update warranty document
     */
    async update(id: string, input: Partial<WarrantyDocumentInput>): Promise<WarrantyDocument> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('warranty_documents')
            .update({
                ...input,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating warranty document:', error);
            throw new Error('Erro ao atualizar documento de garantia');
        }

        return data as WarrantyDocument;
    },

    /**
     * Delete warranty document
     */
    async remove(id: string): Promise<void> {
        const companyId = await getCompanyId();

        const { error } = await supabase
            .from('warranty_documents')
            .delete()
            .eq('company_id', companyId)
            .eq('id', id);

        if (error) {
            console.error('Error deleting warranty document:', error);
            throw new Error('Erro ao excluir documento de garantia');
        }
    }
};

// Re-export getByOrderId for convenience
export const { getByOrderId: getWarrantyByOrderId } = warrantyDocumentService;
