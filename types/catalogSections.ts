export type SectionType = 'recent' | 'featured' | 'bestsellers' | 'promotions' | 'new' | 'custom';
export type LayoutStyle = 'grid' | 'carousel' | 'list';
export type SortBy = 'created_at' | 'sales_count' | 'price' | 'name' | 'updated_at';
export type SortDirection = 'asc' | 'desc';

export interface CatalogSection {
    id: string;
    user_id: string;

    // Identificação
    section_type: SectionType;
    title: string;
    subtitle?: string;

    // Configuração
    is_enabled: boolean;
    display_order: number;
    max_products: number;

    // Estilo
    layout_style: LayoutStyle;
    show_view_all: boolean;
    view_all_url?: string;

    // Filtros (para seções customizadas)
    filter_categories?: string[];
    filter_brands?: string[];
    filter_min_price?: number;
    filter_max_price?: number;
    filter_tags?: string[];

    // Ordenação
    sort_by: SortBy;
    sort_direction: SortDirection;

    // Timestamps
    created_at: string;
    updated_at: string;
}

export interface CreateSectionData {
    section_type: SectionType;
    title: string;
    subtitle?: string;
    is_enabled?: boolean;
    display_order?: number;
    max_products?: number;
    layout_style?: LayoutStyle;
    show_view_all?: boolean;
    view_all_url?: string;
    filter_categories?: string[];
    filter_brands?: string[];
    filter_min_price?: number;
    filter_max_price?: number;
    filter_tags?: string[];
    sort_by?: SortBy;
    sort_direction?: SortDirection;
}

export interface UpdateSectionData extends Partial<CreateSectionData> {
    id: string;
}

// Seções pré-definidas com configurações padrão
export const SECTION_PRESETS: Record<SectionType, Partial<CreateSectionData>> = {
    recent: {
        title: 'Mais Recentes',
        subtitle: 'Produtos adicionados recentemente',
        section_type: 'recent',
        max_products: 8,
        sort_by: 'created_at',
        sort_direction: 'desc',
        layout_style: 'grid'
    },
    featured: {
        title: 'Destaques',
        subtitle: 'Produtos em destaque',
        section_type: 'featured',
        max_products: 6,
        sort_by: 'created_at',
        sort_direction: 'desc',
        layout_style: 'grid'
    },
    bestsellers: {
        title: 'Mais Vendidos',
        subtitle: 'Os produtos mais populares',
        section_type: 'bestsellers',
        max_products: 10,
        sort_by: 'sales_count',
        sort_direction: 'desc',
        layout_style: 'grid'
    },
    promotions: {
        title: 'Promoções',
        subtitle: 'Produtos com desconto',
        section_type: 'promotions',
        max_products: 12,
        sort_by: 'discount_percentage',
        sort_direction: 'desc',
        layout_style: 'grid'
    },
    new: {
        title: 'Novidades',
        subtitle: 'Produtos novos na loja',
        section_type: 'new',
        max_products: 8,
        sort_by: 'created_at',
        sort_direction: 'desc',
        layout_style: 'grid'
    },
    custom: {
        title: 'Seção Personalizada',
        section_type: 'custom',
        max_products: 8,
        sort_by: 'created_at',
        sort_direction: 'desc',
        layout_style: 'grid'
    }
};

// Labels para exibição
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
    recent: 'Mais Recentes',
    featured: 'Destaques',
    bestsellers: 'Mais Vendidos',
    promotions: 'Promoções',
    new: 'Novidades',
    custom: 'Personalizada'
};

export const LAYOUT_STYLE_LABELS: Record<LayoutStyle, string> = {
    grid: 'Grade',
    carousel: 'Carrossel',
    list: 'Lista'
};

export const SORT_BY_LABELS: Record<SortBy, string> = {
    created_at: 'Data de Criação',
    sales_count: 'Mais Vendidos',
    price: 'Preço',
    name: 'Nome',
    updated_at: 'Última Atualização'
};
