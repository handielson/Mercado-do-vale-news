import type { CompanySettings } from '../types/companySettings';
import { vpsClient } from './vpsClient';

export interface CustomerWarrantyDocument {
  id: string;
  sale_id: string;
  serialized_unit_id?: string | null;
  warranty_content: string;
  created_at: string;
}

export const customerDocumentService = {
  async getSettings(): Promise<CompanySettings> {
    return vpsClient.get<CompanySettings>('/customer/document-settings');
  },

  async listWarrantyDocuments(saleId: string): Promise<CustomerWarrantyDocument[]> {
    const response = await vpsClient.get<{ documents?: CustomerWarrantyDocument[] }>(
      `/customer/sales/${encodeURIComponent(saleId)}/warranty-documents`,
    );
    return Array.isArray(response.documents) ? response.documents : [];
  },
};
