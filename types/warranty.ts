/**
 * Warranty Template Types
 * Reusable warranty terms with variable substitution
 */

/**
 * Warranty Template
 * Defines a reusable warranty term template
 */
export interface WarrantyTemplate {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    duration_days: number;
    terms: string; // Supports variables: {dias}, {produto}, {marca}, {data_compra}
    active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Warranty Template Input
 * Data required to create/update a warranty template
 */
export interface WarrantyTemplateInput {
    name: string;
    description?: string;
    duration_days: number;
    terms: string;
    active?: boolean;
}

/**
 * Variables available for warranty term substitution
 */
export interface WarrantyVariables {
    dias: number;
    produto: string;
    marca: string;
    data_compra: string;
    numero_nota?: string;
}
