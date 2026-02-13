
/**
 * VERSION TYPES
 * Interface definitions for Version entity (regional variants like Global, China, USA, etc.)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Brand, Color, Ram, and Storage types
 * - Includes active flag for soft delete
 * - Used for product regional variants
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
