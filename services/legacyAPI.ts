/**
 * Legacy API Service - Mercado do Vale (Sistema Antigo)
 * 
 * Este service permite acessar dados do sistema antigo (MV-Gestao)
 * atraves da API da VPS.
 * 
 * Use este service para:
 * - Migrar dados do sistema antigo
 * - Sincronizar informações durante período de transição
 * - Consultar histórico de vendas/clientes
 * 
 * As tabelas legadas devem estar espelhadas no banco local da VPS.
 */

import { vpsClient } from './vpsClient'

// ============================================================================
// TYPES - Estrutura de dados do sistema antigo
// ============================================================================

export interface LegacyCustomer {
    id: string
    name: string
    cpf: string
    cpf_cnpj?: string  // Alias do campo cpf no sistema antigo
    whatsapp?: string
    phone?: string     // Alias do campo whatsapp
    email?: string
    birth_date?: string
    type: string  // "Atacado", "Varejo", etc.
    is_wholesale?: boolean
    wholesale_status?: string  // "APPROVED", "PENDING", etc.
    wholesale_approved?: boolean
    registration_date?: string
    updated_at?: string
    // Campos de endereço como propriedades diretas (formato alternativo)
    address_street?: string
    address_number?: string
    address_complement?: string
    address_neighborhood?: string
    address_city?: string
    address_state?: string
    address_zip_code?: string
    address?: {
        street?: string
        number?: string
        complement?: string
        neighborhood?: string
        city?: string
        state?: string
        zipCode?: string
    }
    social_media?: {
        instagram?: string
        facebook?: string
        youtube?: string
        website?: string
    }
}

export interface LegacyProduct {
    id: string
    name?: string          // Nome do produto (campo alternativo)
    code?: string          // Código do produto (campo alternativo)
    price?: number         // Preço de venda (campo alternativo)
    stock?: number         // Estoque (campo alternativo a quantity)
    device_type: string
    imei1: string
    imei2?: string
    serial?: string
    brand_id: string
    model: string
    version?: string
    ram: string
    storage: string
    color: string
    buy_price: number
    sell_price_suggested: number
    sell_price_override?: number
    status: string
    quantity: number
    condition: 'NEW' | 'USED' | 'SHOWCASE'
    battery_health?: number
    notes?: string
    entry_date: string
    updated_at: string
    image?: string
}

export interface LegacyBrand {
    id: string
    name: string
    profit_rule_type: 'PERCENTAGE' | 'FIXED'
    profit_rule_value: number
    created_at: string
}

export interface LegacyCategory {
    id: string
    name: string
    display_order: number
    active: boolean
    created_at: string
}

export interface LegacySale {
    id: string
    customer_id: string
    date: string           // coluna real no banco (ISO datetime)
    sale_date?: string     // alias para compatibilidade
    total: number          // coluna real no banco
    total_amount?: number  // alias para compatibilidade
    payment_method: string
    installments?: number
    notes?: string
    net_value?: number
    discount_amount?: number
    fee_amount?: number
    customer?: LegacyCustomer
    items?: LegacySaleItem[]
}

export interface LegacySaleItem {
    itemId: string         // ID do telefone/produto no sistema legado
    type: string           // "PHONE", "GIFT", "ACCESSORY", etc.
    description: string    // Nome do produto
    price: number          // Valor de venda (reais)
    cost: number           // Custo (reais)
    quantity: number
    // Aliases para compatibilidade com o restante do código
    phone_id?: string
    unit_price?: number
    subtotal?: number
    sale_id?: string
}

// ============================================================================
// LEGACY API SERVICE
// ============================================================================

type LegacyResource = 'customers' | 'phones' | 'brands' | 'categories' | 'sales'

interface LegacyRowsResponse<T> {
    rows?: T[]
}

function byId<T extends { id?: string }>(rows: T[], id: string): T | null {
    return rows.find(row => String(row.id || '') === String(id)) || null
}

function parseLegacyItems(value: unknown): LegacySaleItem[] {
    if (Array.isArray(value)) return value as LegacySaleItem[]
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }
    return []
}

export class LegacyAPI {
    private async requestRows<T>(resource: LegacyResource, params: Record<string, string | number | boolean | undefined> = {}): Promise<T[]> {
        try {
            const qs = new URLSearchParams()
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null && value !== '') {
                    qs.set(key, String(value))
                }
            }
            const query = qs.toString() ? `?${qs.toString()}` : ''
            const data = await vpsClient.get<LegacyRowsResponse<T> | T[]>(`/legacy/${resource}${query}`)
            return Array.isArray(data) ? data : (data.rows || [])
        } catch (error) {
            console.error('[legacyAPI] request failed:', error)
            throw error
        }
    }
    // ==========================================================================
    // CLIENTES (CUSTOMERS)
    // ==========================================================================

    /**
     * Buscar todos os clientes
     */
    async getCustomers(): Promise<LegacyCustomer[]> {
        return this.requestRows<LegacyCustomer>('customers', { order: 'name.asc', limit: 5000 })
    }

    /**
     * Buscar cliente por ID
     */
    async getCustomerById(id: string): Promise<LegacyCustomer | null> {
        return byId(await this.requestRows<LegacyCustomer>('customers', { id, limit: 1 }), id)
    }

    /**
     * Buscar cliente por CPF/CNPJ
     */
    async getCustomerByCpfCnpj(cpfCnpj: string): Promise<LegacyCustomer | null> {
        const data = await this.requestRows<LegacyCustomer>('customers', { cpf: cpfCnpj, limit: 1 })
        return data[0] || null
    }

    /**
     * Buscar clientes atacadistas
     */
    async getWholesaleCustomers(): Promise<LegacyCustomer[]> {
        return (await this.getCustomers()).filter(customer => Boolean(customer.is_wholesale))
    }

    // ==========================================================================
    // PRODUTOS (PHONES)
    // ==========================================================================

    /**
     * Buscar todos os produtos
     */
    async getProducts(options?: {
        includeImages?: boolean
        limit?: number
        offset?: number
    }): Promise<LegacyProduct[]> {
        const { limit, offset } = options || {}
        return this.requestRows<LegacyProduct>('phones', { order: 'entry_date.desc', limit: limit || 5000, offset })
    }
    /**
     * Buscar produtos com informações de marca
     */
    async getProductsWithBrand(): Promise<(LegacyProduct & { brand: LegacyBrand })[]> {
        const [products, brands] = await Promise.all([this.getProducts(), this.getBrands()])
        const brandMap = new Map(brands.map(brand => [brand.id, brand]))
        return products.map(product => ({ ...product, brand: brandMap.get(product.brand_id) as LegacyBrand }))
    }

    /**
     * Buscar produtos por categoria
     */
    async getProductsByCategory(category: string): Promise<LegacyProduct[]> {
        return (await this.getProducts()).filter(product => product.device_type === category)
    }

    /**
     * Buscar produtos disponíveis
     */
    async getAvailableProducts(): Promise<LegacyProduct[]> {
        return (await this.getProducts()).filter(product => product.status === 'DISPONIVEL')
    }

    /**
     * Buscar produto por IMEI
     */
    async getProductByImei(imei: string): Promise<LegacyProduct | null> {
        const data = await this.requestRows<LegacyProduct>('phones', { imei1: imei, limit: 1 })
        return data[0] || null
    }

    /**
     * Buscar produto por ID
     */
    async getProductById(id: string): Promise<LegacyProduct | null> {
        return byId(await this.requestRows<LegacyProduct>('phones', { id, limit: 1 }), id)
    }

    // ==========================================================================
    // MARCAS (BRANDS)
    // ==========================================================================

    /**
     * Buscar todas as marcas
     */
    async getBrands(): Promise<LegacyBrand[]> {
        return this.requestRows<LegacyBrand>('brands', { order: 'name.asc', limit: 5000 })
    }

    /**
     * Buscar marca por ID
     */
    async getBrandById(id: string): Promise<LegacyBrand | null> {
        return byId(await this.requestRows<LegacyBrand>('brands', { id, limit: 1 }), id)
    }

    // ==========================================================================
    // CATEGORIAS (CATEGORIES)
    // ==========================================================================

    /**
     * Buscar todas as categorias
     */
    async getCategories(): Promise<LegacyCategory[]> {
        return this.requestRows<LegacyCategory>('categories', { order: 'display_order.asc', limit: 5000 })
    }

    // ==========================================================================
    // VENDAS (SALES)
    // ==========================================================================

    /**
     * Buscar todas as vendas (items são JSONB embutidos na venda)
     */
    async getSales(options?: {
        startDate?: string
        endDate?: string
        limit?: number
    }): Promise<LegacySale[]> {
        const { startDate, endDate, limit } = options || {}
        const sales = await this.requestRows<LegacySale>('sales', {
            order: 'date.desc',
            startDate,
            endDate,
            limit: limit || 5000,
        })
        if (!sales.length) return sales

        const customerIds = [...new Set(sales.map(s => s.customer_id).filter(Boolean))]
        const customers = customerIds.length ? await this.getCustomers() : []
        const customerMap = new Map(customers.map(c => [c.id, c]))

        return sales.map(s => ({
            ...s,
            sale_date: s.date,
            total_amount: s.total,
            customer: customerMap.get(s.customer_id),
            items: parseLegacyItems(s.items).map(item => ({
                ...item,
                phone_id: item.itemId,
                unit_price: item.price,
                subtotal: item.price * item.quantity,
                sale_id: s.id,
            })),
        }))
    }
    /**
     * Buscar vendas de um cliente
     */
    async getSalesByCustomer(customerId: string): Promise<LegacySale[]> {
        return (await this.getSales()).filter(sale => String(sale.customer_id) === String(customerId))
    }

    /**
     * Buscar venda por ID
     */
    async getSaleById(id: string): Promise<LegacySale | null> {
        const sales = await this.requestRows<LegacySale>('sales', { id, limit: 1 })
        if (!sales.length) return null
        const sale = sales[0]
        const customer = sale.customer_id ? await this.getCustomerById(sale.customer_id) : null
        return { ...sale, sale_date: sale.date, total_amount: sale.total, customer: customer || undefined }
    }

    // ==========================================================================
    // ESTATÍSTICAS E RELATÓRIOS
    // ==========================================================================

    /**
     * Buscar estatísticas gerais
     */
    async getStats() {
        const [customers, products, sales] = await Promise.all([
            this.getCustomers(),
            this.getProducts({ limit: 1000 }),
            this.getSales({ limit: 1000 })
        ])

        return {
            totalCustomers: customers.length,
            totalProducts: products.length,
            totalSales: sales.length,
            availableProducts: products.filter(p => p.status === 'DISPONIVEL').length,
            wholesaleCustomers: customers.filter(c => c.is_wholesale).length
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const legacyAPI = new LegacyAPI()

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/*
import { legacyAPI } from '@/services/legacyAPI'

// Buscar todos os clientes
const customers = await legacyAPI.getCustomers()

// Buscar produtos disponíveis
const products = await legacyAPI.getAvailableProducts()

// Buscar vendas do mês
const sales = await legacyAPI.getSales({
  startDate: '2024-01-01',
  endDate: '2024-01-31'
})

// Buscar estatísticas
const stats = await legacyAPI.getStats()
*/




