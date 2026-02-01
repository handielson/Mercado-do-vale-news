
import { UnitStatus } from '../utils/field-standards';

/**
 * Unit Interface
 * Represents a single inventory unit with IMEI tracking and condition
 * Part of the Antigravity Protocol for inventory traceability
 */
export interface Unit {
    id: string;

    // Product Relationship
    product_id: string;

    // Traceability (IMEI is the key for tracking)
    imei_1: string;                    // Primary IMEI (obrigatório para celulares)
    imei_2?: string;                   // Secondary IMEI (dual SIM devices)
    serial_number?: string;            // Serial number (optional)

    // Condition & Health
    condition: 'new' | 'used' | 'open_box';
    battery_health?: number;           // 0-100 (obrigatório se usado)

    // Status using Enum (NO magic strings)
    status: UnitStatus;

    // Financial (optional - specific cost for this unit)
    cost_price?: number;               // Custo de aquisição (centavos)

    // Timestamps
    created: string;
    updated: string;
}

/**
 * UnitInput Interface
 * Data required to create or update a unit
 */
export interface UnitInput {
    product_id: string;
    imei_1?: string;
    imei_2?: string;
    serial_number?: string;
    condition: 'new' | 'used' | 'open_box';
    battery_health?: number;
    status: UnitStatus;
    cost_price?: number;
}
