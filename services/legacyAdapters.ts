/**
 * Legacy Data Adapters - Mercado do Vale
 * 
 * Este módulo transforma dados do sistema antigo para o formato do novo sistema,
 * lidando com campos faltantes, valores nulos e diferenças de estrutura.
 * 
 * ESTRATÉGIAS DE MIGRAÇÃO:
 * 1. Mapeamento de campos (renomeação)
 * 2. Valores padrão para campos obrigatórios
 * 3. Transformação de tipos
 * 4. Validação de dados
 * 5. Logs de campos faltantes
 */

import { LegacyCustomer, LegacyProduct, LegacySale } from './legacyAPI'

// ============================================================================
// CONFIGURAÇÃO DE MAPEAMENTO
// ============================================================================

/**
 * Configuração de como lidar com campos faltantes
 */
export const MigrationConfig = {
    // Modo de migração
    mode: 'safe' as 'safe' | 'strict' | 'permissive',

    // Logging
    logMissingFields: true,
    logTransformations: true,

    // Validação
    validateBeforeInsert: true,
    skipInvalidRecords: false,

    // Valores padrão
    useDefaultValues: true
}

/**
 * Registro de problemas encontrados durante a migração
 */
export interface MigrationIssue {
    recordId: string
    recordType: 'customer' | 'product' | 'sale'
    field: string
    issue: 'missing' | 'invalid' | 'transformed'
    originalValue?: any
    newValue?: any
    message: string
}

export const migrationIssues: MigrationIssue[] = []

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Registra um problema de migração
 */
function logIssue(issue: MigrationIssue) {
    if (MigrationConfig.logMissingFields) {
        migrationIssues.push(issue)
        console.warn(`[Migration Issue] ${issue.recordType} ${issue.recordId}: ${issue.message}`)
    }
}

/**
 * Retorna valor ou padrão se nulo/undefined
 */
function getOrDefault<T>(value: T | null | undefined, defaultValue: T, recordId: string, field: string, recordType: 'customer' | 'product' | 'sale'): T {
    if (value === null || value === undefined || value === '') {
        if (MigrationConfig.useDefaultValues) {
            logIssue({
                recordId,
                recordType,
                field,
                issue: 'missing',
                originalValue: value,
                newValue: defaultValue,
                message: `Campo "${field}" ausente, usando valor padrão: ${defaultValue}`
            })
            return defaultValue
        }
    }
    return value ?? defaultValue
}

/**
 * Valida CPF/CNPJ
 */
function validateDocument(doc: string): boolean {
    const cleaned = doc.replace(/\D/g, '')
    return cleaned.length === 11 || cleaned.length === 14
}

/**
 * Formata telefone
 */
function formatPhone(phone: string | null | undefined): string {
    if (!phone) return ''
    return phone.replace(/\D/g, '')
}

// ============================================================================
// CUSTOMER ADAPTER
// ============================================================================

export interface NewCustomer {
    // Campos obrigatórios
    name: string
    document: string // CPF ou CNPJ
    documentType: 'CPF' | 'CNPJ'

    // Campos opcionais
    phone?: string
    email?: string

    // Endereço
    address?: {
        street?: string
        number?: string
        complement?: string
        neighborhood?: string
        city?: string
        state?: string
        zipCode?: string
    }

    // Tipo de cliente
    customerType: 'RETAIL' | 'WHOLESALE'
    wholesaleApproved?: boolean

    // Metadados
    legacyId: string // ID do sistema antigo
    migratedAt: string
    notes?: string
}

/**
 * Transforma cliente do sistema antigo para o novo
 */
export function adaptCustomer(legacy: LegacyCustomer): NewCustomer | null {
    try {
        // Validar campos obrigatórios
        if (!legacy.name || !legacy.cpf_cnpj) {
            logIssue({
                recordId: legacy.id,
                recordType: 'customer',
                field: 'name/cpf_cnpj',
                issue: 'invalid',
                message: 'Cliente sem nome ou documento - IGNORADO'
            })
            return null
        }

        // Validar documento
        if (!validateDocument(legacy.cpf_cnpj)) {
            logIssue({
                recordId: legacy.id,
                recordType: 'customer',
                field: 'cpf_cnpj',
                issue: 'invalid',
                originalValue: legacy.cpf_cnpj,
                message: 'Documento inválido'
            })

            if (MigrationConfig.mode === 'strict') {
                return null
            }
        }

        // Determinar tipo de documento
        const cleanDoc = legacy.cpf_cnpj.replace(/\D/g, '')
        const documentType = cleanDoc.length === 11 ? 'CPF' : 'CNPJ'

        // Montar endereço (todos os campos opcionais)
        const address = {
            street: legacy.address_street || undefined,
            number: legacy.address_number || undefined,
            complement: legacy.address_complement || undefined,
            neighborhood: legacy.address_neighborhood || undefined,
            city: legacy.address_city || undefined,
            state: legacy.address_state || undefined,
            zipCode: legacy.address_zip_code || undefined
        }

        // Verificar se tem algum campo de endereço preenchido
        const hasAddress = Object.values(address).some(v => v !== undefined)

        return {
            name: legacy.name.trim(),
            document: cleanDoc,
            documentType,
            phone: formatPhone(legacy.phone) || undefined,
            email: legacy.email || undefined,
            address: hasAddress ? address : undefined,
            customerType: legacy.is_wholesale ? 'WHOLESALE' : 'RETAIL',
            wholesaleApproved: legacy.wholesale_approved || false,
            legacyId: legacy.id,
            migratedAt: new Date().toISOString(),
            notes: `Migrado do sistema antigo em ${new Date().toLocaleDateString('pt-BR')}`
        }
    } catch (error) {
        logIssue({
            recordId: legacy.id,
            recordType: 'customer',
            field: 'general',
            issue: 'invalid',
            message: `Erro ao transformar cliente: ${error}`
        })
        return null
    }
}

// ============================================================================
// PRODUCT ADAPTER
// ============================================================================

export interface NewProduct {
    // Campos obrigatórios
    name: string // Modelo + Versão
    category: string

    // Identificação
    imei?: string
    serial?: string

    // Especificações
    brand?: string
    model: string
    version?: string
    ram?: string
    storage?: string
    color?: string

    // Preços
    costPrice: number
    sellPrice: number

    // Status
    status: 'AVAILABLE' | 'SOLD' | 'RESERVED' | 'DEFECTIVE'
    condition: 'NEW' | 'USED' | 'REFURBISHED'
    quantity: number

    // Extras
    batteryHealth?: number
    notes?: string

    // Metadados
    legacyId: string
    migratedAt: string
}

/**
 * Mapeia status do sistema antigo para o novo
 */
function mapProductStatus(legacyStatus: string): 'AVAILABLE' | 'SOLD' | 'RESERVED' | 'DEFECTIVE' {
    const statusMap: Record<string, 'AVAILABLE' | 'SOLD' | 'RESERVED' | 'DEFECTIVE'> = {
        'DISPONIVEL': 'AVAILABLE',
        'VENDIDO': 'SOLD',
        'RESERVADO': 'RESERVED',
        'DEFEITO': 'DEFECTIVE',
        'MANUTENCAO': 'DEFECTIVE'
    }

    return statusMap[legacyStatus.toUpperCase()] || 'AVAILABLE'
}

/**
 * Mapeia condição do produto
 */
function mapProductCondition(legacyCondition: string): 'NEW' | 'USED' | 'REFURBISHED' {
    const conditionMap: Record<string, 'NEW' | 'USED' | 'REFURBISHED'> = {
        'NEW': 'NEW',
        'USED': 'USED',
        'SHOWCASE': 'USED',
        'RECONDICIONADO': 'REFURBISHED'
    }

    return conditionMap[legacyCondition.toUpperCase()] || 'USED'
}

/**
 * Transforma produto do sistema antigo para o novo
 */
export function adaptProduct(legacy: LegacyProduct): NewProduct | null {
    try {
        // Validar campos obrigatórios
        if (!legacy.model) {
            logIssue({
                recordId: legacy.id,
                recordType: 'product',
                field: 'model',
                issue: 'invalid',
                message: 'Produto sem modelo - IGNORADO'
            })
            return null
        }

        // Montar nome do produto
        const name = [legacy.model, legacy.version].filter(Boolean).join(' ')

        // Mapear categoria
        const categoryMap: Record<string, string> = {
            'Celulares': 'PHONE',
            'TABLET': 'TABLET',
            'Tablets': 'TABLET',
            'Receptor': 'RECEIVER',
            'Outros para Receptores': 'RECEIVER_ACCESSORY'
        }

        const category = categoryMap[legacy.device_type] || 'OTHER'

        // Preço de venda (override tem prioridade)
        const sellPrice = legacy.sell_price_override || legacy.sell_price_suggested || 0

        if (sellPrice <= 0) {
            logIssue({
                recordId: legacy.id,
                recordType: 'product',
                field: 'sell_price',
                issue: 'invalid',
                originalValue: sellPrice,
                message: 'Preço de venda inválido ou zero'
            })
        }

        return {
            name,
            category,
            imei: legacy.imei1 || undefined,
            serial: legacy.serial || undefined,
            model: legacy.model,
            version: legacy.version || undefined,
            ram: legacy.ram || undefined,
            storage: legacy.storage || undefined,
            color: legacy.color || undefined,
            costPrice: legacy.buy_price || 0,
            sellPrice,
            status: mapProductStatus(legacy.status),
            condition: mapProductCondition(legacy.condition),
            quantity: legacy.quantity || 1,
            batteryHealth: legacy.battery_health || undefined,
            notes: legacy.notes || undefined,
            legacyId: legacy.id,
            migratedAt: new Date().toISOString()
        }
    } catch (error) {
        logIssue({
            recordId: legacy.id,
            recordType: 'product',
            field: 'general',
            issue: 'invalid',
            message: `Erro ao transformar produto: ${error}`
        })
        return null
    }
}

// ============================================================================
// SALE ADAPTER
// ============================================================================

export interface NewSale {
    // Campos obrigatórios
    customerId: string // ID do cliente no novo sistema
    saleDate: string
    totalAmount: number

    // Pagamento
    paymentMethod: string
    status: 'COMPLETED' | 'PENDING' | 'CANCELLED'

    // Itens (simplificado)
    items: {
        productId: string // ID do produto no novo sistema
        quantity: number
        unitPrice: number
        subtotal: number
    }[]

    // Metadados
    legacyId: string
    legacyCustomerId: string // Para referência
    migratedAt: string
}

/**
 * Transforma venda do sistema antigo para o novo
 * NOTA: Requer mapeamento de IDs (clientes e produtos)
 */
export function adaptSale(
    legacy: LegacySale,
    customerIdMap: Map<string, string>, // legacyId -> newId
    productIdMap: Map<string, string>   // legacyId -> newId
): NewSale | null {
    try {
        // Validar campos obrigatórios
        if (!legacy.customer_id || !legacy.total_amount) {
            logIssue({
                recordId: legacy.id,
                recordType: 'sale',
                field: 'customer_id/total_amount',
                issue: 'invalid',
                message: 'Venda sem cliente ou valor - IGNORADA'
            })
            return null
        }

        // Mapear ID do cliente
        const newCustomerId = customerIdMap.get(legacy.customer_id)
        if (!newCustomerId) {
            logIssue({
                recordId: legacy.id,
                recordType: 'sale',
                field: 'customer_id',
                issue: 'missing',
                originalValue: legacy.customer_id,
                message: 'Cliente não encontrado no mapeamento - VENDA IGNORADA'
            })
            return null
        }

        // Mapear itens
        const items = (legacy.items || [])
            .map(item => {
                const newProductId = productIdMap.get(item.phone_id)
                if (!newProductId) {
                    logIssue({
                        recordId: legacy.id,
                        recordType: 'sale',
                        field: 'items',
                        issue: 'missing',
                        originalValue: item.phone_id,
                        message: `Produto ${item.phone_id} não encontrado no mapeamento`
                    })
                    return null
                }

                return {
                    productId: newProductId,
                    quantity: item.quantity || 1,
                    unitPrice: item.unit_price || 0,
                    subtotal: item.subtotal || 0
                }
            })
            .filter(Boolean) as NewSale['items']

        if (items.length === 0) {
            logIssue({
                recordId: legacy.id,
                recordType: 'sale',
                field: 'items',
                issue: 'invalid',
                message: 'Venda sem itens válidos - IGNORADA'
            })
            return null
        }

        return {
            customerId: newCustomerId,
            saleDate: legacy.sale_date,
            totalAmount: legacy.total_amount,
            paymentMethod: legacy.payment_method || 'DINHEIRO',
            status: 'COMPLETED', // Todas as vendas antigas são completas
            items,
            legacyId: legacy.id,
            legacyCustomerId: legacy.customer_id,
            migratedAt: new Date().toISOString()
        }
    } catch (error) {
        logIssue({
            recordId: legacy.id,
            recordType: 'sale',
            field: 'general',
            issue: 'invalid',
            message: `Erro ao transformar venda: ${error}`
        })
        return null
    }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Processa lote de clientes
 */
export function adaptCustomerBatch(legacyCustomers: LegacyCustomer[]): {
    success: NewCustomer[]
    failed: LegacyCustomer[]
    issues: MigrationIssue[]
} {
    const success: NewCustomer[] = []
    const failed: LegacyCustomer[] = []

    // Limpar issues anteriores
    migrationIssues.length = 0

    for (const legacy of legacyCustomers) {
        const adapted = adaptCustomer(legacy)
        if (adapted) {
            success.push(adapted)
        } else {
            failed.push(legacy)
        }
    }

    return {
        success,
        failed,
        issues: [...migrationIssues]
    }
}

/**
 * Processa lote de produtos
 */
export function adaptProductBatch(legacyProducts: LegacyProduct[]): {
    success: NewProduct[]
    failed: LegacyProduct[]
    issues: MigrationIssue[]
} {
    const success: NewProduct[] = []
    const failed: LegacyProduct[] = []

    migrationIssues.length = 0

    for (const legacy of legacyProducts) {
        const adapted = adaptProduct(legacy)
        if (adapted) {
            success.push(adapted)
        } else {
            failed.push(legacy)
        }
    }

    return {
        success,
        failed,
        issues: [...migrationIssues]
    }
}

// ============================================================================
// RELATÓRIO DE MIGRAÇÃO
// ============================================================================

/**
 * Gera relatório de migração
 */
export function generateMigrationReport() {
    const issuesByType = migrationIssues.reduce((acc, issue) => {
        const key = `${issue.recordType}_${issue.issue}`
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const issuesByField = migrationIssues.reduce((acc, issue) => {
        const key = `${issue.recordType}.${issue.field}`
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return {
        totalIssues: migrationIssues.length,
        issuesByType,
        issuesByField,
        issues: migrationIssues
    }
}

/**
 * Exporta relatório para JSON
 */
export function exportMigrationReport(): string {
    const report = generateMigrationReport()
    return JSON.stringify(report, null, 2)
}
