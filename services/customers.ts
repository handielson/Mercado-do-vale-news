import { vpsClient } from './vpsClient';
import { Customer, CustomerInput, CustomerFilters } from '../types/customer';
import { telegramBotService } from './telegramBot';
import { capitalizeName } from '../utils/customerFormUtils';
import { normalizeBrazilianPhone } from '../utils/cpfCnpjValidation';

/**
 * Customer Service
 * 
 * Customer data now uses the VPS/MySQL operational store.
 * Auth flows use the VPS auth context.
 */

import { getCompanyId as resolveCompanyId } from './companyContext';

interface TableDataResponse<T> {
    rows?: T[];
    total?: number;
    limit?: number;
    offset?: number;
}

function toVpsCustomerType(value: unknown): 'CUSTOMER' | 'RESELLER' | 'ADMIN' | undefined {
    const normalized = String(value || '').trim().toLowerCase();
    switch (normalized) {
        case 'admin':
            return 'ADMIN';
        case 'customer':
        case 'retail':
        case 'varejo':
            return 'CUSTOMER';
        case 'reseller':
        case 'resale':
        case 'wholesale':
        case 'revenda':
        case 'atacado':
            return 'RESELLER';
        default:
            return undefined;
    }
}

function fromVpsCustomerType(value: unknown): Customer['customer_type'] {
    const normalized = String(value || '').trim().toLowerCase();
    switch (normalized) {
        case 'admin':
            return 'ADMIN';
        case 'customer':
            return 'retail';
        case 'reseller':
            return 'resale';
        case 'retail':
        case 'resale':
        case 'wholesale':
            return normalized as Customer['customer_type'];
        default:
            return undefined;
    }
}

function parseJsonField<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export function normalizeCustomerFromVps(row: Customer): Customer {
    const active = row.is_active as unknown;
    const deliveryWorker = row.is_delivery_worker as unknown;
    const walkInCustomer = row.is_walk_in_customer as unknown;
    return {
        ...row,
        name: capitalizeName(String(row.name || '')),
        address: parseJsonField(row.address, undefined as any),
        custom_data: parseJsonField(row.custom_data, undefined as any),
        customer_type: fromVpsCustomerType(row.customer_type),
        is_active: active === true || active === 1 || active === '1',
        is_delivery_worker: deliveryWorker === true || deliveryWorker === 1 || deliveryWorker === '1',
        is_walk_in_customer: walkInCustomer === true || walkInCustomer === 1 || walkInCustomer === '1',
    };
}

function serializeCustomerPayload<T extends Partial<CustomerInput>>(input: T): T {
    const payload = { ...input } as Record<string, unknown>;

    if ('name' in payload) {
        payload.name = capitalizeName(String(payload.name || ''));
    }

    if ('phone' in payload) {
        const rawPhone = String(payload.phone || '').trim();
        const normalizedPhone = rawPhone ? normalizeBrazilianPhone(rawPhone) : '';
        if (rawPhone && !normalizedPhone) {
            throw new Error('Informe um telefone valido com DDD');
        }
        payload.phone = normalizedPhone || null;
    }

    for (const key of ['address', 'custom_data']) {
        if (payload[key] && typeof payload[key] === 'object') {
            payload[key] = JSON.stringify(payload[key]);
        }
    }

    if ('customer_type' in payload) {
        payload.customer_type = toVpsCustomerType(payload.customer_type);
        if (!payload.customer_type) delete payload.customer_type;
    }

    return payload as T;
}

function onlyDigits(value: unknown): string {
    return String(value || '').replace(/\D/g, '');
}

function byCreatedAtDesc(a: Customer, b: Customer): number {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

function normalizeCustomerName(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function isWalkInCustomerCandidate(customer: Customer, companyId: string): boolean {
    return customer.company_id === companyId &&
        (customer.is_walk_in_customer === true || normalizeCustomerName(customer.name) === 'cliente balcao');
}

class CustomerService {
    private cache: Customer[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    private async getCompanyId(): Promise<string> {
        return resolveCompanyId();
    }

    /**
     * Check if cache is valid
     */
    private isCacheValid(): boolean {
        return this.cache !== null &&
            (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    private async loadAllCustomers(): Promise<Customer[]> {
        if (this.isCacheValid()) return this.cache!;

        const rows: Customer[] = [];
        const pageSize = 200;

        for (let offset = 0; ; offset += pageSize) {
            const data = await vpsClient.get<TableDataResponse<Customer>>(
                `/table-data/customers?limit=${pageSize}&offset=${offset}`
            );
            const pageRows = Array.isArray(data.rows) ? data.rows.map(normalizeCustomerFromVps) : [];
            rows.push(...pageRows);
            if (pageRows.length < pageSize) break;
        }

        this.cache = rows;
        this.cacheTimestamp = Date.now();
        return rows;
    }

    private applyFilters(rows: Customer[], companyId: string, filters?: CustomerFilters): Customer[] {
        const search = filters?.search?.trim().toLowerCase();
        const searchDigits = onlyDigits(search);

        return rows
            .filter(customer => customer.company_id === companyId)
            .filter(customer => {
                if (!search) return true;
                const textMatch = [customer.name, customer.cpf_cnpj, customer.phone, customer.email]
                    .some(value => String(value || '').toLowerCase().includes(search));
                const digitMatch = !!searchDigits && [customer.cpf_cnpj, customer.phone]
                    .some(value => onlyDigits(value).includes(searchDigits));
                return textMatch || digitMatch;
            })
            .filter(customer => filters?.is_active === undefined || customer.is_active === filters.is_active)
            .filter(customer => filters?.is_delivery_worker === undefined || customer.is_delivery_worker === filters.is_delivery_worker)
            .filter(customer => filters?.is_walk_in_customer === undefined || customer.is_walk_in_customer === filters.is_walk_in_customer)
            .filter(customer => !filters?.created_after || String(customer.created_at || '') >= filters.created_after!)
            .filter(customer => !filters?.created_before || String(customer.created_at || '') <= filters.created_before!)
            .sort(byCreatedAtDesc);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * List all customers with optional filters
     */
    async list(filters?: CustomerFilters): Promise<Customer[]> {
        const companyId = await this.getCompanyId();
        return this.applyFilters(await this.loadAllCustomers(), companyId, filters);
    }

    /**
     * Get customer by ID
     */
    async getById(id: string): Promise<Customer | null> {
        const customers = await this.loadAllCustomers();
        return customers.find(customer => String(customer.id) === String(id)) || null;
    }

    /**
     * Get customer by linked VPS Auth user ID
     */
    async getByUserId(userId: string): Promise<Customer | null> {
        const customers = await this.loadAllCustomers();
        return customers.find(customer => String(customer.user_id) === String(userId)) || null;
    }

    /**
     * Get customer by CPF/CNPJ
     */
    async getByCpfCnpj(cpfCnpj: string): Promise<Customer | null> {
        const companyId = await this.getCompanyId();
        const customers = await this.loadAllCustomers();
        return customers.find(customer =>
            customer.company_id === companyId &&
            onlyDigits(customer.cpf_cnpj) === onlyDigits(cpfCnpj)
        ) || null;
    }

    /**
     * Select the existing counter customer used for quick in-store sales.
     * This intentionally never creates records, avoiding duplicated "Cliente Balcão" rows.
     */
    async getWalkInCustomer(): Promise<Customer> {
        const companyId = await this.getCompanyId();
        const customer = (await this.loadAllCustomers())
            .find(candidate => isWalkInCustomerCandidate(candidate, companyId));

        if (!customer) {
            throw new Error('Cliente Balcão não encontrado no cadastro. Reative ou cadastre esse cliente antes de usar venda rápida.');
        }

        return {
            ...customer,
            is_walk_in_customer: true,
            custom_data: {
                ...(customer.custom_data || {}),
                walk_in_customer: true,
                no_benefits: true,
                no_coins: true,
            },
        };
    }

    /**
     * Helper to generate a unique referral code based on ID
     */
    private generateReferralCode(id: string): string {
        // Generate a simple MV-XXXXX code using the first 5 chars of the UUID
        const hash = id.replace(/-/g, '').substring(0, 5).toUpperCase();
        return `MV-${hash}`;
    }

    /**
     * Create new customer
     */
    async create(input: CustomerInput): Promise<Customer> {
        const companyId = await this.getCompanyId();

        // Generate UUID first so we can use it for the referral code
        const newId = crypto.randomUUID();
        const referralCode = this.generateReferralCode(newId);

        const data = normalizeCustomerFromVps(await vpsClient.post<Customer>('/table-data/customers', {
            id: newId,
            company_id: companyId,
            referral_code: referralCode,
            ...serializeCustomerPayload(input)
        }));

        this.clearCache();

        // Disparo assíncrono para o Telegram (Falha silenciosamente para não travar a UI)
        try {
            telegramBotService.notifyNewCustomer({
                nome_cliente: data.name,
                telefone_cliente: data.phone || 'Não informado',
                tipo_cliente: data.customer_type || 'Varejo'
            });
        } catch (e) {
            console.error('Falha ao disparar notification Telegram de cliente novo', e);
        }

        vpsClient.post('/whatsapp/automation/customer-registered', {
            customer_id: data.id,
            source: 'admin',
        }).catch(error => {
            console.error('[whatsapp-automation] Falha ao disparar cadastro admin', error);
        });
        return data;
    }

    /**
     * Update existing customer
     */
    async update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
        const data = normalizeCustomerFromVps(await vpsClient.patch<Customer>(
            `/table-data/customers/${encodeURIComponent(id)}?pk=id`,
            serializeCustomerPayload(input)
        ));

        this.clearCache();
        return data;
    }

    /**
     * Delete customer (soft delete by setting is_active = false)
     */
    async softDelete(id: string): Promise<void> {
        await this.update(id, { is_active: false });
    }

    /**
     * Delete customer (hard delete from database)
     */
    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/customers/${encodeURIComponent(id)}?pk=id`);
        this.clearCache();
    }

    /**
     * Search customers by name
     */
    async search(query: string): Promise<Customer[]> {
        return this.list({ search: query });
    }

    /**
     * Get active customers count
     */
    async getActiveCount(): Promise<number> {
        const companyId = await this.getCompanyId();
        return (await this.loadAllCustomers())
            .filter(customer => customer.company_id === companyId && customer.is_active)
            .length;
    }
}

export const customerService = new CustomerService();
