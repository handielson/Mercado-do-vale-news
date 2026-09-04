export type SmartphonePhotoIntakeStatus =
  | 'uploaded'
  | 'analyzing'
  | 'waiting_model_registration'
  | 'waiting_price_confirmation'
  | 'review_required'
  | 'ready_to_finalize'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS: Record<SmartphonePhotoIntakeStatus, string> = {
  uploaded: 'Imagem recebida',
  analyzing: 'Analisando imagem',
  waiting_model_registration: 'Esperando cadastrar modelo',
  waiting_price_confirmation: 'Esperando confirmar preços',
  review_required: 'Revisar leitura',
  ready_to_finalize: 'Pronto para salvar',
  completed: 'Disponível para venda',
  failed: 'Erro na leitura',
  cancelled: 'Cancelado',
};

export interface SmartphonePhotoIntakeIssue {
  field?: string;
  code?: string;
  message: string;
}
export interface SmartphonePhotoIntake {
  id: string;
  company_id?: string | null;
  batch_id?: string | null;
  status: SmartphonePhotoIntakeStatus;
  photo_private_path?: string | null;
  photo_sha256?: string | null;
  ai_model?: string | null;
  detected_brand?: string | null;
  detected_model?: string | null;
  detected_color?: string | null;
  detected_ram?: string | null;
  detected_storage?: string | null;
  detected_serial?: string | null;
  detected_imei_1?: string | null;
  detected_imei_2?: string | null;
  detected_ean?: string | null;
  detected_product_code?: string | null;
  matched_brand_id?: string | null;
  matched_model_id?: string | null;
  matched_color_id?: string | null;
  matched_product_id?: string | null;
  price_cost?: number | null;
  price_retail?: number | null;
  price_reseller?: number | null;
  price_wholesale?: number | null;
  prices_confirmed?: boolean | number;
  review_confirmed?: boolean | number;
  review_confirmed_at?: string | null;
  extracted_data?: Record<string, unknown> | null;
  validation_errors?: SmartphonePhotoIntakeIssue[] | null;
  validation_warnings?: SmartphonePhotoIntakeIssue[] | null;
  ai_input_tokens?: number | null;
  ai_output_tokens?: number | null;
  ai_cost_usd?: number | null;
  retry_count?: number | null;
  error_message?: string | null;
  unit_id?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SmartphoneBrandPriceMargin {
  id?: string;
  company_id?: string | null;
  brand_id: string;
  brand_name?: string | null;
  retail_margin_cents: number;
  reseller_margin_cents: number;
  wholesale_margin_cents: number;
  active: boolean | number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SmartphonePhotoIntakeUpdate {
  detected_brand?: string | null;
  detected_model?: string | null;
  detected_color?: string | null;
  detected_ram?: string | null;
  detected_storage?: string | null;
  detected_serial?: string | null;
  detected_imei_1?: string | null;
  detected_imei_2?: string | null;
  detected_ean?: string | null;
  detected_product_code?: string | null;
  matched_brand_id?: string | null;
  matched_model_id?: string | null;
  matched_color_id?: string | null;
  price_cost?: number | null;
  price_retail?: number | null;
  price_reseller?: number | null;
  price_wholesale?: number | null;
  prices_confirmed?: boolean;
  review_confirmed?: boolean;
}

export interface SmartphonePhotoIntakePriceConfirmation {
  price_cost: number;
  price_retail: number;
  price_reseller: number;
  price_wholesale: number;
}

export interface SmartphonePhotoIntakeGroupPriceResult {
  intake: SmartphonePhotoIntake;
  updated_count: number;
}
