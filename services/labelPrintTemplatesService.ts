import { vpsClient } from './vpsClient';

export interface LabelPrintTemplate {
  id: string;
  label: string;
  width: number;
  height: number;
  fontStore: number;
  fontName: number;
  fontPrice: number;
  fontPriceCurrency: number;
  barcodeWidth: number;
  barcodeHeight: number;
  barcodeFont: number;
  padding: number;
}

export interface LabelTemplatesResponse {
  templates: LabelPrintTemplate[];
  updated_at: string | null;
}

export const labelPrintTemplatesService = {
  get(): Promise<LabelTemplatesResponse> {
    return vpsClient.get<LabelTemplatesResponse>('/admin/label-templates');
  },

  save(templates: LabelPrintTemplate[]): Promise<LabelTemplatesResponse> {
    return vpsClient.patch<LabelTemplatesResponse>('/admin/label-templates', { templates });
  },
};
