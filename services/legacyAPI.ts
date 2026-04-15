/**
 * Legacy API Service - Mercado do Vale (Sistema Antigo)
 * 
 * Este service permite acessar dados do sistema antigo (MV-Gestao)
 * através da API REST do Supabase.
 * 
 * Use este service para:
 * - Migrar dados do sistema antigo
 * - Sincronizar informações durante período de transição
 * - Consultar histórico de vendas/clientes
 * 
 * IMPORTANTE: Quando a migração estiver completa, revogue a API key
 * no Supabase Dashboard para desconectar o acesso.
 */

const LEGACY_SUPABASE_URL = 'https://tcxpdehmnoxvjtjdnzhw.supabase.co'
const LEGACY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjeHBkZWhtbm94dmp0amRuemh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzcyNDYsImV4cCI6MjA4MDIxMzI0Nn0.sEfWbWBYeEulmq_2BodRkPcy7lyyuElp-OzWTmpnIzg'

const headers = {
    'apikey': LEGACY_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${LEGACY_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
}

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

export class LegacyAPI {
    private baseUrl = `${LEGACY_SUPABASE_URL}/rest/v1`

    /**
     * Método genérico para fazer requisições
     */
    private async request<T>(endpoint: string): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, { headers })

            if (!response.ok) {
                throw new Error(`Legacy API Error: ${response.statusText}`)
            }

            return await response.json()
        } catch (error) {
            console.error('❌ Legacy API Request Failed:', error)
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
        return this.request<LegacyCustomer[]>('/customers?select=*')
    }

    /**
     * Buscar cliente por ID
     */
    async getCustomerById(id: string): Promise<LegacyCustomer | null> {
        const data = await this.request<LegacyCustomer[]>(`/customers?id=eq.${id}&select=*`)
        return data[0] || null
    }

    /**
     * Buscar cliente por CPF/CNPJ
     */
    async getCustomerByCpfCnpj(cpfCnpj: string): Promise<LegacyCustomer | null> {
        const data = await this.request<LegacyCustomer[]>(`/customers?cpf=eq.${cpfCnpj}&select=*`)
        return data[0] || null
    }

    /**
     * Buscar clientes atacadistas
     */
    async getWholesaleCustomers(): Promise<LegacyCustomer[]> {
        return this.request<LegacyCustomer[]>('/customers?is_wholesale=eq.true&select=*')
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
        const { includeImages = false, limit, offset } = options || {}

        // Excluir imagens por padrão para melhor performance
        const select = includeImages
            ? '*'
            : 'id,device_type,imei1,imei2,serial,brand_id,model,version,ram,storage,color,buy_price,sell_price_suggested,sell_price_override,status,quantity,condition,battery_health,notes,entry_date,updated_at'

        let endpoint = `/phones?select=${select}&order=entry_date.desc`

        if (limit) endpoint += `&limit=${limit}`
        if (offset) endpoint += `&offset=${offset}`

        return this.request<LegacyProduct[]>(endpoint)
    }

    /**
     * Buscar produtos com informações de marca
     */
    async getProductsWithBrand(): Promise<(LegacyProduct & { brand: LegacyBrand })[]> {
        return this.request(`/phones?select=*,brand:brands(*)&order=entry_date.desc`)
    }

    /**
     * Buscar produtos por categoria
     */
    async getProductsByCategory(category: string): Promise<LegacyProduct[]> {
        return this.request<LegacyProduct[]>(`/phones?device_type=eq.${category}&select=*`)
    }

    /**
     * Buscar produtos disponíveis
     */
    async getAvailableProducts(): Promise<LegacyProduct[]> {
        return this.request<LegacyProduct[]>(`/phones?status=eq.DISPONIVEL&select=*`)
    }

    /**
     * Buscar produto por IMEI
     */
    async getProductByImei(imei: string): Promise<LegacyProduct | null> {
        const data = await this.request<LegacyProduct[]>(`/phones?imei1=eq.${imei}&select=*`)
        return data[0] || null
    }

    /**
     * Buscar produto por ID
     */
    async getProductById(id: string): Promise<LegacyProduct | null> {
        const data = await this.request<LegacyProduct[]>(`/phones?id=eq.${id}&select=*`)
        return data[0] || null
    }

    // ==========================================================================
    // MARCAS (BRANDS)
    // ==========================================================================

    /**
     * Buscar todas as marcas
     */
    async getBrands(): Promise<LegacyBrand[]> {
        return this.request<LegacyBrand[]>('/brands?select=*')
    }

    /**
     * Buscar marca por ID
     */
    async getBrandById(id: string): Promise<LegacyBrand | null> {
        const data = await this.request<LegacyBrand[]>(`/brands?id=eq.${id}&select=*`)
        return data[0] || null
    }

    // ==========================================================================
    // CATEGORIAS (CATEGORIES)
    // ==========================================================================

    /**
     * Buscar todas as categorias
     */
    async getCategories(): Promise<LegacyCategory[]> {
        return this.request<LegacyCategory[]>('/categories?select=*&order=display_order')
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

        let endpoint = '/sales?select=*&order=date.desc'
        if (startDate) endpoint += `&date=gte.${startDate}`
        if (endDate)   endpoint += `&date=lte.${endDate}`
        if (limit)     endpoint += `&limit=${limit}`

        const sales = await this.request<LegacySale[]>(endpoint)
        if (!sales.length) return sales

        // Buscar clientes em paralelo (items já estão embutidos como JSONB)
        const customerIds = [...new Set(sales.map(s => s.customer_id).filter(Boolean))]
        const customers   = customerIds.length
            ? await this.request<LegacyCustomer[]>(
                `/customers?id=in.(${customerIds.join(',')})&select=*`
              )
            : []

        const customerMap = new Map(customers.map(c => [c.id, c]))

        // Normaliza cada venda: garante aliases e normaliza itens JSONB
        return sales.map(s => ({
            ...s,
            sale_date:    s.date,
            total_amount: s.total,
            customer:     customerMap.get(s.customer_id),
            items: ((s.items as unknown as LegacySaleItem[]) || []).map(item => ({
                ...item,
                phone_id:   item.itemId,
                unit_price: item.price,
                subtotal:   item.price * item.quantity,
                sale_id:    s.id,
            })),
        }))
    }

    /**
     * Buscar vendas de um cliente
     */
    async getSalesByCustomer(customerId: string): Promise<LegacySale[]> {
        return this.request<LegacySale[]>(
            `/sales?customer_id=eq.${customerId}&select=*&order=date.desc`
        )
    }

    /**
     * Buscar venda por ID
     */
    async getSaleById(id: string): Promise<LegacySale | null> {
        const sales = await this.request<LegacySale[]>(`/sales?id=eq.${id}&select=*`)
        if (!sales.length) return null
        const sale = sales[0]
        const customers = await this.request<LegacyCustomer[]>(
            `/customers?id=eq.${sale.customer_id}&select=*`
        )
        return { ...sale, sale_date: sale.date, total_amount: sale.total, customer: customers[0] }
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
