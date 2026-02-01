
import { Unit, UnitInput } from '../types/unit';
import { UnitStatus } from '../utils/field-standards';
import { unitSchema, unitStatusUpdateSchema } from '../schemas/unit';
import { pb } from './pb';

/**
 * UNIT SERVICE
 * Hybrid service layer for inventory unit management
 * Supports both mock data (dev mode) and PocketBase (production)
 */

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Mock data for development
let mockUnits: Unit[] = [
    {
        id: 'unit-1',
        product_id: 'mock-1', // iPhone 13
        imei_1: '123456789012345',
        imei_2: '123456789012346',
        serial_number: 'APPLE-SN-001',
        status: UnitStatus.AVAILABLE,
        cost_price: 350000, // R$ 3.500,00
        created: new Date('2024-01-15').toISOString(),
        updated: new Date('2024-01-15').toISOString()
    },
    {
        id: 'unit-2',
        product_id: 'mock-1', // iPhone 13
        imei_1: '223456789012345',
        imei_2: '223456789012346',
        serial_number: 'APPLE-SN-002',
        status: UnitStatus.AVAILABLE,
        cost_price: 350000,
        created: new Date('2024-01-16').toISOString(),
        updated: new Date('2024-01-16').toISOString()
    },
    {
        id: 'unit-3',
        product_id: 'mock-1', // iPhone 13
        imei_1: '323456789012345',
        imei_2: '323456789012346',
        serial_number: 'APPLE-SN-003',
        status: UnitStatus.SOLD,
        cost_price: 350000,
        created: new Date('2024-01-10').toISOString(),
        updated: new Date('2024-01-20').toISOString()
    },
    {
        id: 'unit-4',
        product_id: 'mock-1', // iPhone 13
        imei_1: '423456789012345',
        serial_number: 'APPLE-SN-004',
        status: UnitStatus.RESERVED,
        cost_price: 350000,
        created: new Date('2024-01-17').toISOString(),
        updated: new Date('2024-01-25').toISOString()
    },
    {
        id: 'unit-5',
        product_id: 'mock-2', // Capa Silicone
        imei_1: '999999999999999', // Accessories might have fake IMEIs
        status: UnitStatus.AVAILABLE,
        created: new Date('2024-01-18').toISOString(),
        updated: new Date('2024-01-18').toISOString()
    }
];

/**
 * Simulate network delay
 */
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * List units by product
 */
async function listByProduct(productId: string): Promise<Unit[]> {
    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Fetching units for product ${productId}`);
        await delay();
        return mockUnits.filter(unit => unit.product_id === productId);
    }

    try {
        const records = await pb.collection('units').getFullList({
            filter: `product_id = "${productId}"`,
            sort: '-created'
        });
        return records as unknown as Unit[];
    } catch (error) {
        console.error('Error fetching units:', error);
        throw new Error('Erro ao carregar unidades');
    }
}

/**
 * Get unit by ID
 */
async function getById(id: string): Promise<Unit> {
    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Fetching unit ${id}`);
        await delay();
        const unit = mockUnits.find(u => u.id === id);
        if (!unit) {
            throw new Error('Unidade não encontrada');
        }
        return unit;
    }

    try {
        const record = await pb.collection('units').getOne(id);
        return record as unknown as Unit;
    } catch (error) {
        console.error('Error fetching unit:', error);
        throw new Error('Erro ao carregar unidade');
    }
}

/**
 * Create new unit
 */
async function create(data: UnitInput): Promise<Unit> {
    // Validate with Zod
    const validatedData = unitSchema.parse(data);

    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Creating unit', validatedData);
        await delay();

        const newUnit: Unit = {
            id: `unit-${Date.now()}`,
            ...validatedData,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        mockUnits.push(newUnit);
        return newUnit;
    }

    try {
        const record = await pb.collection('units').create(validatedData);
        return record as unknown as Unit;
    } catch (error) {
        console.error('Error creating unit:', error);
        throw new Error('Erro ao criar unidade');
    }
}

/**
 * Update unit status
 */
async function updateStatus(id: string, status: UnitStatus): Promise<Unit> {
    // Validate status
    const validatedData = unitStatusUpdateSchema.parse({ status });

    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Updating unit ${id} status to ${status}`);
        await delay();

        const unitIndex = mockUnits.findIndex(u => u.id === id);
        if (unitIndex === -1) {
            throw new Error('Unidade não encontrada');
        }

        mockUnits[unitIndex] = {
            ...mockUnits[unitIndex],
            status: validatedData.status,
            updated: new Date().toISOString()
        };

        return mockUnits[unitIndex];
    }

    try {
        const record = await pb.collection('units').update(id, { status: validatedData.status });
        return record as unknown as Unit;
    } catch (error) {
        console.error('Error updating unit status:', error);
        throw new Error('Erro ao atualizar status da unidade');
    }
}

/**
 * Delete unit
 */
async function deleteUnit(id: string): Promise<void> {
    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Deleting unit ${id}`);
        await delay();

        const unitIndex = mockUnits.findIndex(u => u.id === id);
        if (unitIndex === -1) {
            throw new Error('Unidade não encontrada');
        }

        mockUnits.splice(unitIndex, 1);
        return;
    }

    try {
        await pb.collection('units').delete(id);
    } catch (error) {
        console.error('Error deleting unit:', error);
        throw new Error('Erro ao deletar unidade');
    }
}

/**
 * Get unit statistics by product
 */
async function getStatsByProduct(productId: string): Promise<{
    total: number;
    available: number;
    reserved: number;
    sold: number;
    rma: number;
}> {
    const units = await listByProduct(productId);

    return {
        total: units.length,
        available: units.filter(u => u.status === UnitStatus.AVAILABLE).length,
        reserved: units.filter(u => u.status === UnitStatus.RESERVED).length,
        sold: units.filter(u => u.status === UnitStatus.SOLD).length,
        rma: units.filter(u => u.status === UnitStatus.RMA).length
    };
}

export const unitService = {
    listByProduct,
    getById,
    create,
    updateStatus,
    delete: deleteUnit,
    getStatsByProduct
};
