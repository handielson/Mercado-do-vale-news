/**
 * Teste de Migração - Clientes Reais
 * 
 * Este script busca clientes do sistema antigo e testa a migração
 */

import { legacyAPI } from './services/legacyAPI'
import {
    adaptCustomerBatch,
    generateMigrationReport,
    MigrationConfig
} from './services/legacyAdapters'

async function testCustomerMigration() {
    console.log('🔄 Buscando clientes do sistema antigo...\n')

    try {
        // Buscar clientes reais
        const legacyCustomers = await legacyAPI.getCustomers()

        console.log(`📊 Total de clientes encontrados: ${legacyCustomers.length}\n`)
        console.log('='.repeat(80))

        // Configurar modo SAFE
        MigrationConfig.mode = 'safe'

        // Processar migração
        console.log('\n🔄 Processando migração...\n')
        const result = adaptCustomerBatch(legacyCustomers)

        // Resultados
        console.log('📈 RESULTADOS:\n')
        console.log(`✅ Migrados com sucesso: ${result.success.length}`)
        console.log(`❌ Rejeitados: ${result.failed.length}`)
        console.log(`⚠️  Problemas encontrados: ${result.issues.length}`)

        // Estatísticas
        const withPhone = result.success.filter(c => c.phone).length
        const withEmail = result.success.filter(c => c.email).length
        const withAddress = result.success.filter(c => c.address).length
        const wholesale = result.success.filter(c => c.customerType === 'WHOLESALE').length

        console.log('\n📊 ESTATÍSTICAS DOS MIGRADOS:\n')
        console.log(`📱 Com telefone: ${withPhone}/${result.success.length}`)
        console.log(`📧 Com email: ${withEmail}/${result.success.length}`)
        console.log(`📍 Com endereço: ${withAddress}/${result.success.length}`)
        console.log(`🏢 Atacadistas: ${wholesale}/${result.success.length}`)

        // Primeiros 10 clientes migrados
        console.log('\n✅ PRIMEIROS 10 CLIENTES MIGRADOS:\n')
        result.success.slice(0, 10).forEach((customer, i) => {
            console.log(`${i + 1}. ${customer.name}`)
            console.log(`   Documento: ${customer.document} (${customer.documentType})`)
            console.log(`   Telefone: ${customer.phone || '❌ Não informado'}`)
            console.log(`   Email: ${customer.email || '❌ Não informado'}`)
            console.log(`   Tipo: ${customer.customerType}`)
            console.log('')
        })

        // Clientes rejeitados
        if (result.failed.length > 0) {
            console.log('❌ CLIENTES REJEITADOS:\n')
            result.failed.forEach((customer, i) => {
                console.log(`${i + 1}. ${customer.name || 'SEM NOME'} (ID: ${customer.id})`)
            })
            console.log('')
        }

        // Problemas por tipo
        const issuesByType = result.issues.reduce((acc, issue) => {
            acc[issue.issue] = (acc[issue.issue] || 0) + 1
            return acc
        }, {})

        console.log('⚠️  PROBLEMAS POR TIPO:\n')
        Object.entries(issuesByType).forEach(([type, count]) => {
            console.log(`${type}: ${count}`)
        })

        // Problemas por campo
        const issuesByField = result.issues.reduce((acc, issue) => {
            acc[issue.field] = (acc[issue.field] || 0) + 1
            return acc
        }, {})

        console.log('\n⚠️  PROBLEMAS POR CAMPO:\n')
        Object.entries(issuesByField).forEach(([field, count]) => {
            console.log(`${field}: ${count}`)
        })

        // Relatório detalhado
        console.log('\n📝 RELATÓRIO DETALHADO:\n')
        const report = generateMigrationReport()

        // Mostrar alguns problemas de exemplo
        console.log('Exemplos de problemas encontrados:')
        result.issues.slice(0, 5).forEach((issue, i) => {
            console.log(`\n${i + 1}. ${issue.message}`)
            console.log(`   Registro: ${issue.recordId}`)
            console.log(`   Campo: ${issue.field}`)
            console.log(`   Tipo: ${issue.issue}`)
        })

        // Exportar para JSON
        console.log('\n💾 EXPORTANDO DADOS...\n')

        const fs = await import('fs')

        // Exportar clientes migrados
        fs.writeFileSync(
            'migrated-customers.json',
            JSON.stringify(result.success, null, 2)
        )
        console.log('✅ Clientes migrados salvos em: migrated-customers.json')

        // Exportar clientes rejeitados
        if (result.failed.length > 0) {
            fs.writeFileSync(
                'failed-customers.json',
                JSON.stringify(result.failed, null, 2)
            )
            console.log('❌ Clientes rejeitados salvos em: failed-customers.json')
        }

        // Exportar relatório
        fs.writeFileSync(
            'migration-report.json',
            JSON.stringify(report, null, 2)
        )
        console.log('📊 Relatório completo salvo em: migration-report.json')

        console.log('\n' + '='.repeat(80))
        console.log('\n✅ TESTE CONCLUÍDO!\n')

        // Resumo final
        console.log('📋 RESUMO FINAL:\n')
        console.log(`Total de clientes: ${legacyCustomers.length}`)
        console.log(`Taxa de sucesso: ${((result.success.length / legacyCustomers.length) * 100).toFixed(1)}%`)
        console.log(`Taxa de rejeição: ${((result.failed.length / legacyCustomers.length) * 100).toFixed(1)}%`)

        if (result.success.length === legacyCustomers.length) {
            console.log('\n🎉 PERFEITO! Todos os clientes foram migrados com sucesso!')
        } else if (result.failed.length === 0) {
            console.log('\n✅ ÓTIMO! Todos os clientes foram migrados (alguns com warnings)')
        } else {
            console.log('\n⚠️  ATENÇÃO! Alguns clientes foram rejeitados. Revise o relatório.')
        }

    } catch (error) {
        console.error('❌ Erro ao testar migração:', error)
    }
}

// Executar teste
testCustomerMigration()
