/**
 * Script de Teste - Migração de Dados
 * 
 * Este script demonstra todos os cenários de migração:
 * - Campos faltantes
 * - Dados inválidos
 * - Dados divergentes
 * - Relacionamentos quebrados
 * 
 * Execute: node test-migration.js
 */

import {
    adaptCustomer,
    adaptProduct,
    adaptCustomerBatch,
    adaptProductBatch,
    generateMigrationReport,
    MigrationConfig
} from './services/legacyAdapters.js'

// ============================================================================
// DADOS DE TESTE - Simulando sistema antigo
// ============================================================================

const testCustomers = [
    // ✅ CASO 1: Cliente perfeito (todos os campos)
    {
        id: 'customer-001',
        name: 'João Silva',
        cpf_cnpj: '12345678900',
        phone: '11999999999',
        email: 'joao@email.com',
        address_street: 'Rua ABC',
        address_number: '123',
        address_complement: 'Apto 45',
        address_neighborhood: 'Centro',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip_code: '01000-000',
        customer_type: 'PF',
        is_wholesale: false,
        wholesale_approved: false,
        created_at: '2024-01-01T00:00:00Z'
    },

    // ⚠️ CASO 2: Cliente sem telefone (campo opcional)
    {
        id: 'customer-002',
        name: 'Maria Santos',
        cpf_cnpj: '98765432100',
        phone: null,  // ← FALTANDO
        email: 'maria@email.com',
        address_street: null,
        address_number: null,
        address_complement: null,
        address_neighborhood: null,
        address_city: null,
        address_state: null,
        address_zip_code: null,
        customer_type: 'PF',
        is_wholesale: false,
        wholesale_approved: false,
        created_at: '2024-01-02T00:00:00Z'
    },

    // ❌ CASO 3: Cliente sem CPF (campo obrigatório)
    {
        id: 'customer-003',
        name: 'Pedro Costa',
        cpf_cnpj: null,  // ← OBRIGATÓRIO FALTANDO!
        phone: '11888888888',
        email: 'pedro@email.com',
        address_street: 'Rua XYZ',
        address_number: '456',
        address_complement: null,
        address_neighborhood: 'Jardins',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip_code: '02000-000',
        customer_type: 'PF',
        is_wholesale: false,
        wholesale_approved: false,
        created_at: '2024-01-03T00:00:00Z'
    },

    // ❌ CASO 4: CPF inválido (muito curto)
    {
        id: 'customer-004',
        name: 'Ana Oliveira',
        cpf_cnpj: '123',  // ← INVÁLIDO!
        phone: '11777777777',
        email: 'ana@email.com',
        address_street: null,
        address_number: null,
        address_complement: null,
        address_neighborhood: null,
        address_city: null,
        address_state: null,
        address_zip_code: null,
        customer_type: 'PF',
        is_wholesale: false,
        wholesale_approved: false,
        created_at: '2024-01-04T00:00:00Z'
    },

    // ⚠️ CASO 5: Endereço parcial
    {
        id: 'customer-005',
        name: 'Carlos Souza',
        cpf_cnpj: '11122233344',
        phone: '11666666666',
        email: null,  // ← Email faltando
        address_street: 'Av. Paulista',
        address_number: '1000',
        address_complement: null,  // ← Faltando
        address_neighborhood: null,  // ← Faltando
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip_code: null,  // ← Faltando
        customer_type: 'PF',
        is_wholesale: true,
        wholesale_approved: true,
        created_at: '2024-01-05T00:00:00Z'
    }
]

const testProducts = [
    // ✅ CASO 1: Produto perfeito
    {
        id: 'product-001',
        device_type: 'Celulares',
        imei1: '123456789012345',
        imei2: '123456789012346',
        serial: 'SN123456',
        brand_id: 'brand-001',
        model: 'Galaxy S23',
        version: 'Ultra',
        ram: '12GB',
        storage: '256GB',
        color: 'Preto',
        buy_price: 3000.00,
        sell_price_suggested: 4500.00,
        sell_price_override: 4200.00,
        status: 'DISPONIVEL',  // ← Será transformado
        quantity: 1,
        condition: 'NEW',
        battery_health: 100,
        notes: 'Produto novo na caixa',
        entry_date: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
    },

    // ⚠️ CASO 2: Produto sem IMEI (opcional)
    {
        id: 'product-002',
        device_type: 'TABLET',
        imei1: null,  // ← FALTANDO
        imei2: null,
        serial: 'SN789012',
        brand_id: 'brand-002',
        model: 'iPad Air',
        version: '5th Gen',
        ram: '8GB',
        storage: '128GB',
        color: 'Azul',
        buy_price: 2500.00,
        sell_price_suggested: 3500.00,
        sell_price_override: null,  // ← Usa suggested
        status: 'DISPONIVEL',
        quantity: 1,
        condition: 'SHOWCASE',  // ← Será transformado para USED
        battery_health: 95,
        notes: null,
        entry_date: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
    },

    // ❌ CASO 3: Produto sem modelo (obrigatório)
    {
        id: 'product-003',
        device_type: 'Celulares',
        imei1: '999888777666555',
        imei2: null,
        serial: null,
        brand_id: 'brand-001',
        model: null,  // ← OBRIGATÓRIO FALTANDO!
        version: 'Pro',
        ram: '8GB',
        storage: '128GB',
        color: 'Branco',
        buy_price: 2000.00,
        sell_price_suggested: 3000.00,
        sell_price_override: null,
        status: 'DISPONIVEL',
        quantity: 1,
        condition: 'NEW',
        battery_health: 100,
        notes: null,
        entry_date: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z'
    },

    // ⚠️ CASO 4: Preço zero (warning)
    {
        id: 'product-004',
        device_type: 'Receptor',
        imei1: null,
        imei2: null,
        serial: 'REC-001',
        brand_id: 'brand-003',
        model: 'Receptor Digital',
        version: 'HD',
        ram: null,
        storage: null,
        color: 'Preto',
        buy_price: 50.00,
        sell_price_suggested: 0,  // ← PREÇO ZERO!
        sell_price_override: null,
        status: 'DISPONIVEL',
        quantity: 5,
        condition: 'NEW',
        battery_health: null,
        notes: 'Lote promocional',
        entry_date: '2024-01-04T00:00:00Z',
        updated_at: '2024-01-04T00:00:00Z'
    }
]

// ============================================================================
// TESTES
// ============================================================================

console.log('🧪 INICIANDO TESTES DE MIGRAÇÃO\n')
console.log('='.repeat(80))

// ----------------------------------------------------------------------------
// TESTE 1: Modo SAFE (Padrão)
// ----------------------------------------------------------------------------

console.log('\n📊 TESTE 1: Modo SAFE (Padrão)\n')
MigrationConfig.mode = 'safe'

const result1 = adaptCustomerBatch(testCustomers)

console.log(`✅ Sucesso: ${result1.success.length}/${testCustomers.length}`)
console.log(`❌ Falhas: ${result1.failed.length}/${testCustomers.length}`)
console.log(`⚠️  Problemas: ${result1.issues.length}`)

console.log('\n📋 Clientes Migrados com Sucesso:')
result1.success.forEach((customer, i) => {
    console.log(`  ${i + 1}. ${customer.name} - ${customer.document}`)
    if (!customer.phone) console.log(`     ⚠️  Sem telefone`)
    if (!customer.address) console.log(`     ⚠️  Sem endereço`)
})

console.log('\n❌ Clientes Rejeitados:')
result1.failed.forEach((customer, i) => {
    console.log(`  ${i + 1}. ${customer.name} (ID: ${customer.id})`)
})

console.log('\n⚠️  Problemas Encontrados:')
result1.issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.issue.toUpperCase()}] ${issue.recordType} ${issue.recordId}`)
    console.log(`     Campo: ${issue.field}`)
    console.log(`     ${issue.message}`)
})

// ----------------------------------------------------------------------------
// TESTE 2: Produtos
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80))
console.log('\n📦 TESTE 2: Migração de Produtos\n')

const result2 = adaptProductBatch(testProducts)

console.log(`✅ Sucesso: ${result2.success.length}/${testProducts.length}`)
console.log(`❌ Falhas: ${result2.failed.length}/${testProducts.length}`)
console.log(`⚠️  Problemas: ${result2.issues.length}`)

console.log('\n📋 Produtos Migrados:')
result2.success.forEach((product, i) => {
    console.log(`  ${i + 1}. ${product.name}`)
    console.log(`     Categoria: ${product.category}`)
    console.log(`     Status: ${product.status}`)
    console.log(`     Preço: R$ ${product.sellPrice.toFixed(2)}`)
    if (product.sellPrice === 0) console.log(`     ⚠️  PREÇO ZERO!`)
})

console.log('\n❌ Produtos Rejeitados:')
result2.failed.forEach((product, i) => {
    console.log(`  ${i + 1}. ${product.model || 'SEM MODELO'} (ID: ${product.id})`)
})

// ----------------------------------------------------------------------------
// TESTE 3: Modo STRICT
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80))
console.log('\n🔒 TESTE 3: Modo STRICT\n')

MigrationConfig.mode = 'strict'

const result3 = adaptCustomerBatch(testCustomers)

console.log(`✅ Sucesso: ${result3.success.length}/${testCustomers.length}`)
console.log(`❌ Falhas: ${result3.failed.length}/${testCustomers.length}`)

console.log('\n💡 Diferença do modo SAFE:')
console.log(`   SAFE rejeitou: ${result1.failed.length}`)
console.log(`   STRICT rejeitou: ${result3.failed.length}`)
console.log(`   Diferença: ${result3.failed.length - result1.failed.length} registros a mais`)

// ----------------------------------------------------------------------------
// TESTE 4: Relatório Completo
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80))
console.log('\n📊 RELATÓRIO FINAL DE MIGRAÇÃO\n')

const report = generateMigrationReport()

console.log(`Total de problemas: ${report.totalIssues}`)
console.log('\nPor tipo:')
Object.entries(report.issuesByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
})

console.log('\nPor campo:')
Object.entries(report.issuesByField).forEach(([field, count]) => {
    console.log(`  ${field}: ${count}`)
})

// ----------------------------------------------------------------------------
// TESTE 5: Exemplo Individual
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80))
console.log('\n🔍 TESTE 5: Transformação Individual\n')

const singleCustomer = testCustomers[0]
console.log('Cliente Original:')
console.log(JSON.stringify(singleCustomer, null, 2))

const adapted = adaptCustomer(singleCustomer)
console.log('\nCliente Transformado:')
console.log(JSON.stringify(adapted, null, 2))

// ----------------------------------------------------------------------------
// RESUMO
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80))
console.log('\n📈 RESUMO DOS TESTES\n')

console.log('Clientes:')
console.log(`  Total: ${testCustomers.length}`)
console.log(`  ✅ Migrados (SAFE): ${result1.success.length}`)
console.log(`  ❌ Rejeitados (SAFE): ${result1.failed.length}`)
console.log(`  ❌ Rejeitados (STRICT): ${result3.failed.length}`)

console.log('\nProdutos:')
console.log(`  Total: ${testProducts.length}`)
console.log(`  ✅ Migrados: ${result2.success.length}`)
console.log(`  ❌ Rejeitados: ${result2.failed.length}`)

console.log('\nProblemas:')
console.log(`  Total de issues: ${report.totalIssues}`)
console.log(`  Campos faltantes: ${report.issuesByType.customer_missing || 0}`)
console.log(`  Dados inválidos: ${report.issuesByType.customer_invalid || 0}`)
console.log(`  Transformações: ${report.issuesByType.product_transformed || 0}`)

console.log('\n✅ TESTES CONCLUÍDOS!\n')
console.log('='.repeat(80))
