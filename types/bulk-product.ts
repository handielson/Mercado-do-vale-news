export interface BulkProductRow {
    ean: string;
    imei1?: string;
    imei2?: string;
    serial?: string;
    [key: string]: any; // Campos customizados dinâmicos
}

export interface BulkProductValidation {
    row: number;
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface BulkProductPreview {
    row: number;
    baseProduct: any; // Product type
    uniqueFields: Record<string, any>;
    finalProduct: any; // ProductInput type
    validation: BulkProductValidation;
}

export interface BulkUploadResult {
    total: number;
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
}

export interface PendingProduct {
    id: string; // Temporary ID for queue management
    ean: string;
    baseProductName: string;
    baseProductImage?: string;
    uniqueFields: Record<string, any>;
    timestamp: number;
}

export interface BulkRegistrationState {
    pendingProducts: PendingProduct[];
    savedProducts: PendingProduct[];
    currentProduct: Partial<PendingProduct> | null;
    isLoading: boolean;
    isSaving: boolean;
}
