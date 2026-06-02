export type BulkImportAction = 'create' | 'update' | 'upsert' | 'skip' | '';
export type BulkImportPlannedAction = 'create' | 'update' | 'skip' | 'error';
export type BulkImportUpdateMode = 'filled_only' | 'replace_except_images';

export interface BulkImportIssue {
    code: string;
    message: string;
    debug?: Record<string, any>;
}

export interface BulkProductRow {
    ean?: string;
    action?: BulkImportAction;
    sku?: string;
    name?: string;
    model_id?: string;
    model_name?: string;
    category_id?: string;
    category_name?: string;
    brand?: string;
    specs?: Record<string, any>;
    imei1?: string;
    imei2?: string;
    serial?: string;
    [key: string]: any;
}

export interface BulkProductValidation {
    row: number;
    sku?: string;
    valid: boolean;
    errors: Array<string | BulkImportIssue>;
    warnings: Array<string | BulkImportIssue>;
    existingProduct?: any;
}

export interface BulkImportPlanItem {
    row: number;
    sku: string;
    action: BulkImportPlannedAction;
    rowData: BulkProductRow;
    existingProduct?: any;
    payload: any;
    validation: BulkProductValidation;
    debug: Record<string, any>;
}

export interface BulkImportPlan {
    total: number;
    create: number;
    update: number;
    skip: number;
    error: number;
    items: BulkImportPlanItem[];
}

export interface BulkProductPreview {
    row: number;
    baseProduct: any;
    uniqueFields: Record<string, any>;
    finalProduct: any;
    validation: BulkProductValidation;
}

export interface BulkUploadResult {
    total: number;
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
}

export interface PendingProduct {
    id: string;
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
