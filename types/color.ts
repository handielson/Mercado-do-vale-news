
/**
 * COLOR TYPES
 * Interface definitions for Color entity
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Brand types
 * - Includes active flag for soft delete
 * - Optional hex_code for visual preview
 */

export interface Color {
    id: string;
    name: string;
    slug: string;
    hex_code?: string;  // Optional hexadecimal color code for preview
    active: boolean;
    created: string;
    updated: string;
}

export interface ColorInput {
    name: string;
    hex_code?: string;
    active?: boolean;
}
