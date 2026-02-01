
/**
 * VERSION TYPES
 * Interface definitions for Version entity (product versions like iOS 17, Android 14, etc.)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as other resource types
 * - Includes active flag for soft delete
 * - Used for software/firmware versions
 */

export interface Version {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created: string;
    updated: string;
}

export interface VersionInput {
    name: string;
    active?: boolean;
}
