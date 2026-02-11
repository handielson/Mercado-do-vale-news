// ============================================================================
// Types: Model EAN
// Descrição: Tipos para múltiplos EANs por modelo
// ============================================================================

export interface ModelEAN {
    id: string;
    model_id: string;
    ean: string; // 13 dígitos
    country_code?: string; // BR, CN, IN, etc.
    is_primary: boolean;
    created_at: string;
}

export interface ModelEANInput {
    model_id: string;
    ean: string;
    country_code?: string;
    is_primary?: boolean;
}

// ============================================================================
// Types: Model Variant
// Descrição: Combinação Modelo + Versão + Cor
// ============================================================================

export interface ModelVariant {
    id: string;
    model_id: string;
    version_id: string;
    color_id: string;
    created_at: string;
    updated_at: string;

    // Relações (quando expandidas)
    model?: Model;
    version?: Version;
    color?: Color;
    images?: ModelVariantImage[];
}

export interface ModelVariantInput {
    model_id: string;
    version_id: string;
    color_id: string;
}

export interface ModelVariantWithDetails extends ModelVariant {
    model: Model;
    version: Version;
    color: Color;
    images: ModelVariantImage[];
    image_count: number;
}

// ============================================================================
// Types: Model Variant Image
// Descrição: Galeria de imagens por variante
// ============================================================================

export interface ModelVariantImage {
    id: string;
    variant_id: string;
    image_url: string;
    display_order: number;
    is_primary: boolean;
    created_at: string;
}

export interface ModelVariantImageInput {
    variant_id: string;
    image_url: string;
    display_order?: number;
    is_primary?: boolean;
}

export interface ImageUploadResult {
    success: boolean;
    image_url?: string;
    error?: string;
}

// ============================================================================
// Types: Model (Atualizado)
// Descrição: Modelo expandido com especificações como colunas
// ============================================================================

export interface Model {
    id: string;
    company_id: string;
    brand_id: string;
    category_id: string;
    name: string;

    // Especificações Técnicas (novas colunas)
    processor?: string;
    chipset?: string;
    battery_mah?: number;
    display?: number; // Decimal(3,2)
    main_camera_mpx?: string;
    selfie_camera_mpx?: string;
    nfc?: string; // "Sim" | "Não"
    network?: string; // "4G" | "5G"
    resistencia?: string; // Ex: "IP68"
    antutu?: string;
    custom_specs?: Record<string, any>; // JSONB para campos raros

    // Logística
    weight_kg?: number; // Decimal(6,3)
    width_cm?: number; // Decimal(6,2)
    height_cm?: number; // Decimal(6,2)
    depth_cm?: number; // Decimal(6,2)

    // Campos antigos (manter para compatibilidade)
    template_values?: Record<string, any>;
    default_category_id?: string;
    default_description?: string;

    created_at: string;
    updated_at: string;

    // Relações (quando expandidas)
    brand?: Brand;
    category?: Category;
    eans?: ModelEAN[];
    variants?: ModelVariant[];
}

export interface ModelInput {
    company_id?: string; // Opcional - preenchido automaticamente pelo serviço
    brand_id: string;
    category_id: string;
    name: string;
    description?: string;

    // Especificações
    processor?: string;
    chipset?: string;
    battery_mah?: number;
    display?: number;
    main_camera_mpx?: string;
    selfie_camera_mpx?: string;
    nfc?: string;
    network?: string;
    resistencia?: string;
    antutu?: string;
    custom_specs?: Record<string, any>;

    // Logística
    weight_kg?: number;
    width_cm?: number;
    height_cm?: number;
    depth_cm?: number;
}

export interface ModelWithDetails extends Model {
    brand: Brand;
    category: Category;
    eans: ModelEAN[];
    variants: ModelVariantWithDetails[];
    primary_ean?: ModelEAN;
}

// ============================================================================
// Types: Product (Atualizado)
// Descrição: Produto simplificado - apenas dados únicos
// ============================================================================

export interface Product {
    id: string;
    company_id: string;
    model_id: string;
    variant_id?: string; // 🆕 Referência à variante
    ean?: string; // 🆕 EAN específico desta unidade

    // Identificadores Únicos
    imei1?: string;
    imei2?: string;
    serial?: string;

    // Variações
    color_id?: string;
    storage_id?: string;
    ram_id?: string;

    // Campos Específicos da Unidade
    battery_health?: number; // 0-100%

    // Observações
    public_notes?: string;
    internal_notes?: string;

    // Preço e Status
    price: number;
    status: 'active' | 'sold' | 'reserved' | 'inactive';

    created_at: string;
    updated_at: string;

    // Relações (quando expandidas)
    model?: Model;
    variant?: ModelVariant;
    color?: Color;
    storage?: Storage;
    ram?: RAM;
}

export interface ProductInput {
    company_id: string;
    model_id: string;
    variant_id?: string;
    ean?: string;

    imei1?: string;
    imei2?: string;
    serial?: string;

    color_id?: string;
    storage_id?: string;
    ram_id?: string;

    battery_health?: number;

    public_notes?: string;
    internal_notes?: string;

    price: number;
    status?: 'active' | 'sold' | 'reserved' | 'inactive';
}

export interface ProductWithDetails extends Product {
    model: ModelWithDetails;
    variant?: ModelVariantWithDetails;
    color?: Color;
    storage?: Storage;
    ram?: RAM;
    images: ModelVariantImage[]; // Imagens da variante
}

// ============================================================================
// Types: Helpers
// ============================================================================

export interface VariantSearchParams {
    model_id: string;
    version_id: string;
    color_id: string;
}

export interface EANSearchResult {
    found: boolean;
    model?: ModelWithDetails;
    ean_record?: ModelEAN;
}

export interface VariantImageUploadParams {
    variant_id: string;
    files: File[];
    onProgress?: (progress: number) => void;
}

export interface VariantImageReorderParams {
    variant_id: string;
    image_ids: string[]; // Array ordenado de IDs
}

// ============================================================================
// Types: Version (referência)
// ============================================================================

export interface Version {
    id: string;
    company_id: string;
    name: string; // "Global", "Indiana", "Chinesa", etc.
    created_at: string;
}

// ============================================================================
// Types: Existing (referências)
// ============================================================================

export interface Brand {
    id: string;
    company_id: string;
    name: string;
    created_at: string;
}

export interface Category {
    id: string;
    company_id: string;
    name: string;
    created_at: string;
}

export interface Color {
    id: string;
    company_id: string;
    name: string;
    hex_code?: string;
    created_at: string;
}

export interface Storage {
    id: string;
    company_id: string;
    capacity: string; // "64GB", "128GB", etc.
    created_at: string;
}

export interface RAM {
    id: string;
    company_id: string;
    capacity: string; // "4GB", "8GB", etc.
    created_at: string;
}
