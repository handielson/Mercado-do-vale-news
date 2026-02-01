
/**
 * STORAGE TYPES
 * Interface definitions for Storage entity (capacities like 64GB, 128GB, etc.)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Brand and Color types
 * - Includes active flag for soft delete
 * - Used for both storage and RAM capacities
 */

export interface Storage {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created: string;
    updated: string;
}

export interface StorageInput {
    name: string;
    active?: boolean;
}
