export type SignedWarrantyStatus = 'received' | 'processing' | 'available' | 'error' | 'replaced';
export type SignedWarrantySource = 'sale_screen' | 'synology_direct';

export interface SignedWarrantyDocument {
  id: string;
  sale_id?: string | null;
  customer_id?: string | null;
  sale_code?: string | null;
  status: SignedWarrantyStatus;
  source: SignedWarrantySource;
  original_file_name: string;
  image_size_bytes?: number | null;
  created_at: string;
  processed_at?: string | null;
  discarded_at?: string | null;
  discard_message?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  version_number: number;
  is_active: boolean;
}

export interface SignedWarrantySnapshot {
  active: SignedWarrantyDocument | null;
  history: SignedWarrantyDocument[];
  pending: SignedWarrantyDocument[];
}
