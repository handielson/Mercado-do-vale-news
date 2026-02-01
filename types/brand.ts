
/**
 * BRAND TYPES
 * Interface definitions for Brand entity
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Category types
 * - Includes active flag for soft delete
 * - Prepared for future logo upload
 */

export interface Brand {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    logo_url?: string;
    created: string;
    updated: string;
}

export interface BrandInput {
    name: string;
    active?: boolean;
    logo_url?: string;
}
