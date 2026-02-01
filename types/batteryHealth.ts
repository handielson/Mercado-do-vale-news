
/**
 * BATTERY HEALTH TYPES
 * Interface definitions for BatteryHealth entity (battery condition percentages)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as other resource types
 * - Includes active flag for soft delete
 * - Used for battery health percentages (100%, 95%, 90%, etc.)
 */

export interface BatteryHealth {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created: string;
    updated: string;
}

export interface BatteryHealthInput {
    name: string;
    active?: boolean;
}
