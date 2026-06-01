/**
 * Warranty Document Service
 * Handles CRUD operations for warranty documents
 */

import { WarrantyDocument, WarrantyDocumentInput } from '../types/warrantyDocument';
import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadWarrantyDocuments(pageSize = 200): Promise<WarrantyDocument[]> {
    let offset = 0;
    const rows: WarrantyDocument[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<WarrantyDocument>>(
            `/table-data/warranty_documents?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

function byOldestCreatedAt(a: WarrantyDocument, b: WarrantyDocument): number {
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

function byNewestCreatedAt(a: WarrantyDocument, b: WarrantyDocument): number {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

export const warrantyDocumentService = {
    /**
     * Create a new warranty document. Aceita `id` pre-gerado pra que o numero
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

        return vpsClient.post<WarrantyDocument>('/table-data/warranty_documents', payload);
    },

    /**
     * Lista todos os documentos de uma venda (1 por aparelho serializado).
     */
    async listBySaleId(saleId: string): Promise<WarrantyDocument[]> {
        const companyId = await getCompanyId();
        return (await loadWarrantyDocuments())
            .filter(document => document.company_id === companyId && document.sale_id === saleId)
            .sort(byOldestCreatedAt);
    },

    /**
     * Get warranty document by order ID (pedidos online)
     */
    async getByOrderId(orderId: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();
        const document = (await loadWarrantyDocuments())
            .filter(item => item.company_id === companyId && item.order_id === orderId)
            .sort(byNewestCreatedAt)[0];
        return document || null;
    },

    /**
     * Get warranty document by sale ID
     */
    async getBySaleId(saleId: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();
        const document = (await loadWarrantyDocuments())
            .filter(item => item.company_id === companyId && item.sale_id === saleId)
            .sort(byNewestCreatedAt)[0];
        return document || null;
    },

    /**
     * Get warranty document by ID
     */
    async getById(id: string): Promise<WarrantyDocument | null> {
        const companyId = await getCompanyId();
        const document = (await loadWarrantyDocuments())
            .find(item => item.company_id === companyId && item.id === id);
        return document || null;
    },

    /**
     * List all warranty documents
     */
    async list(): Promise<WarrantyDocument[]> {
        const companyId = await getCompanyId();
        return (await loadWarrantyDocuments())
            .filter(document => document.company_id === companyId)
            .sort(byNewestCreatedAt);
    },

    /**
     * Update warranty document
     */
    async update(id: string, input: Partial<WarrantyDocumentInput>): Promise<WarrantyDocument> {
        return vpsClient.patch<WarrantyDocument>(`/table-data/warranty_documents/${id}`, {
            ...input,
            updated_at: new Date().toISOString()
        });
    },

    /**
     * Delete warranty document
     */
    async remove(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/warranty_documents/${id}`);
    }
};

// Re-export getByOrderId for convenience
export const { getByOrderId: getWarrantyByOrderId } = warrantyDocumentService;
