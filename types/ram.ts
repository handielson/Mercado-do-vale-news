
/**
 * RAM TYPES
 * Interface definitions for RAM entity (memory capacities like 4GB, 8GB, etc.)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Brand, Color, and Storage types
 * - Includes active flag for soft delete
 * - Used for RAM memory capacities
 */

export interface Ram {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created: string;
    updated: string;
}

export interface RamInput {
    name: string;
    active?: boolean;
}
