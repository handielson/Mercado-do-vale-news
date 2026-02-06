// ============================================================================
// TESTE DE MIGRAÇÃO DE CLIENTES - Console do Navegador
// ============================================================================
// Cole este código no console do navegador (F12) com o projeto rodando

(async function testCustomerMigration() {
    console.log('%c🔄 TESTE DE MIGRAÇÃO DE CLIENTES', 'font-size: 20px; font-weight: bold; color: #4CAF50')
    console.log('='.repeat(80))

    try {
        // Importar módulos
        const { legacyAPI } = await import('./services/legacyAPI.js')
        const {
            adaptCustomerBatch,
            generateMigrationReport,
            MigrationConfig
        } = await import('./services/legacyAdapters.js')

        console.log('\n📡 Buscando clientes do sistema antigo...')

        // Buscar clientes
        const legacyCustomers = await legacyAPI.getCustomers()

        console.log(`\n✅ ${legacyCustomers.length} clientes encontrados!`)
        console.log('\n' + '='.repeat(80))

        // Configurar modo SAFE
        MigrationConfig.mode = 'safe'

        // Processar migração
        console.log('\n🔄 Processando migração em modo SAFE...\n')
        const result = adaptCustomerBatch(legacyCustomers)

        // ========================================================================
        // RESULTADOS
        // ========================================================================

        console.log('%c📈 RESULTADOS:', 'font-size: 16px; font-weight: bold; color: #2196F3')
        console.log('')
        console.log(`%c✅ Migrados com sucesso: ${result.success.length}/${legacyCustomers.length}`, 'color: #4CAF50; font-weight: bold')
        console.log(`%c❌ Rejeitados: ${result.failed.length}/${legacyCustomers.length}`, 'color: #f44336; font-weight: bold')
        console.log(`%c⚠️  Problemas encontrados: ${result.issues.length}`, 'color: #FF9800; font-weight: bold')

        // ========================================================================
        // ESTATÍSTICAS
        // ========================================================================

        const withPhone = result.success.filter(c => c.phone).length
        const withEmail = result.success.filter(c => c.email).length
        const withAddress = result.success.filter(c => c.address).length
        const wholesale = result.success.filter(c => c.customerType === 'WHOLESALE').length

        console.log('\n%c📊 ESTATÍSTICAS DOS MIGRADOS:', 'font-size: 16px; font-weight: bold; color: #2196F3')
        console.log('')
        console.log(`📱 Com telefone: ${withPhone}/${result.success.length} (${((withPhone / result.success.length) * 100).toFixed(1)}%)`)
        console.log(`📧 Com email: ${withEmail}/${result.success.length} (${((withEmail / result.success.length) * 100).toFixed(1)}%)`)
        console.log(`📍 Com endereço: ${withAddress}/${result.success.length} (${((withAddress / result.success.length) * 100).toFixed(1)}%)`)
        console.log(`🏢 Atacadistas: ${wholesale}/${result.success.length} (${((wholesale / result.success.length) * 100).toFixed(1)}%)`)

        // ========================================================================
        // PRIMEIROS 10 CLIENTES
        // ========================================================================

        console.log('\n%c✅ PRIMEIROS 10 CLIENTES MIGRADOS:', 'font-size: 16px; font-weight: bold; color: #4CAF50')
        console.log('')

        result.success.slice(0, 10).forEach((customer, i) => {
            console.log(`%c${i + 1}. ${customer.name}`, 'font-weight: bold')
            console.log(`   Documento: ${customer.document} (${customer.documentType})`)
            console.log(`   Telefone: ${customer.phone || '❌ Não informado'}`)
            console.log(`   Email: ${customer.email || '❌ Não informado'}`)
            console.log(`   Tipo: ${customer.customerType === 'WHOLESALE' ? '🏢 Atacado' : '🛒 Varejo'}`)
            console.log('')
        })

        // ========================================================================
        // CLIENTES REJEITADOS
        // ========================================================================

        if (result.failed.length > 0) {
            console.log('%c❌ CLIENTES REJEITADOS:', 'font-size: 16px; font-weight: bold; color: #f44336')
            console.log('')

            result.failed.forEach((customer, i) => {
                console.log(`%c${i + 1}. ${customer.name || 'SEM NOME'} (ID: ${customer.id})`, 'color: #f44336')
                console.log(`   CPF/CNPJ: ${customer.cpf_cnpj || '❌ AUSENTE'}`)
            })
            console.log('')
        }

        // ========================================================================
        // PROBLEMAS POR TIPO
        // ========================================================================

        const issuesByType = result.issues.reduce((acc, issue) => {
            acc[issue.issue] = (acc[issue.issue] || 0) + 1
            return acc
        }, {})

        console.log('%c⚠️  PROBLEMAS POR TIPO:', 'font-size: 16px; font-weight: bold; color: #FF9800')
        console.log('')
        Object.entries(issuesByType).forEach(([type, count]) => {
            const emoji = type === 'missing' ? '❌' : type === 'invalid' ? '⚠️' : 'ℹ️'
            console.log(`${emoji} ${type}: ${count}`)
        })

        // ========================================================================
        // PROBLEMAS POR CAMPO
        // ========================================================================

        const issuesByField = result.issues.reduce((acc, issue) => {
            acc[issue.field] = (acc[issue.field] || 0) + 1
            return acc
        }, {})

        console.log('\n%c⚠️  PROBLEMAS POR CAMPO:', 'font-size: 16px; font-weight: bold; color: #FF9800')
        console.log('')
        Object.entries(issuesByField)
            .sort((a, b) => b[1] - a[1]) // Ordenar por quantidade
            .forEach(([field, count]) => {
                console.log(`📌 ${field}: ${count}`)
            })

        // ========================================================================
        // EXEMPLOS DE PROBLEMAS
        // ========================================================================

        console.log('\n%c📝 EXEMPLOS DE PROBLEMAS:', 'font-size: 16px; font-weight: bold; color: #FF9800')
        console.log('')

        result.issues.slice(0, 5).forEach((issue, i) => {
            console.log(`${i + 1}. ${issue.message}`)
            console.log(`   Registro: ${issue.recordId}`)
            console.log(`   Campo: ${issue.field}`)
            console.log(`   Tipo: ${issue.issue}`)
            console.log('')
        })

        // ========================================================================
        // RESUMO FINAL
        // ========================================================================

        console.log('='.repeat(80))
        console.log('\n%c📋 RESUMO FINAL:', 'font-size: 18px; font-weight: bold; color: #2196F3')
        console.log('')
        console.log(`Total de clientes: ${legacyCustomers.length}`)
        console.log(`%cTaxa de sucesso: ${((result.success.length / legacyCustomers.length) * 100).toFixed(1)}%`, 'color: #4CAF50; font-weight: bold; font-size: 14px')
        console.log(`%cTaxa de rejeição: ${((result.failed.length / legacyCustomers.length) * 100).toFixed(1)}%`, 'color: #f44336; font-weight: bold; font-size: 14px')

        if (result.success.length === legacyCustomers.length) {
            console.log('\n%c🎉 PERFEITO! Todos os clientes foram migrados com sucesso!', 'color: #4CAF50; font-weight: bold; font-size: 16px')
        } else if (result.failed.length === 0) {
            console.log('\n%c✅ ÓTIMO! Todos os clientes foram migrados (alguns com warnings)', 'color: #4CAF50; font-weight: bold; font-size: 16px')
        } else {
            console.log('\n%c⚠️  ATENÇÃO! Alguns clientes foram rejeitados. Revise os detalhes acima.', 'color: #FF9800; font-weight: bold; font-size: 16px')
        }

        // ========================================================================
        // DADOS DISPONÍVEIS
        // ========================================================================

        console.log('\n' + '='.repeat(80))
        console.log('\n%c💾 DADOS DISPONÍVEIS NO CONSOLE:', 'font-size: 16px; font-weight: bold; color: #9C27B0')
        console.log('')
        console.log('Use estas variáveis para explorar os dados:')
        console.log('• window.migrationResult - Resultado completo')
        console.log('• window.migratedCustomers - Clientes migrados')
        console.log('• window.failedCustomers - Clientes rejeitados')
        console.log('• window.migrationIssues - Lista de problemas')
        console.log('')
        console.log('Exemplo: console.table(window.migratedCustomers.slice(0, 10))')

        // Salvar no window para acesso
        window.migrationResult = result
        window.migratedCustomers = result.success
        window.failedCustomers = result.failed
        window.migrationIssues = result.issues

        console.log('\n%c✅ TESTE CONCLUÍDO!', 'font-size: 20px; font-weight: bold; color: #4CAF50')
        console.log('='.repeat(80))

        return result

    } catch (error) {
        console.error('%c❌ ERRO AO TESTAR MIGRAÇÃO:', 'font-size: 16px; font-weight: bold; color: #f44336')
        console.error(error)
    }
})()
