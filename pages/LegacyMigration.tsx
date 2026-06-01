/**
 * Página de Migração de Dados - Legacy System
 * 
 * Permite visualizar clientes do sistema antigo (MV-Gestão),
 * pré-visualizar os dados transformados, editar se necessário
 * e importar 1 por 1 ou todos de uma vez para o novo sistema.
 */

import React, { useState, useEffect, useRef } from 'react'
import { legacyAPI, LegacyCustomer } from '../services/legacyAPI'
import { Database, Users, RefreshCw, Search, Filter, Zap, X, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { CustomerMigrationTable, CustomerMigrationStatus } from '../components/migration/CustomerMigrationTable'
import { CustomerMigrateModal, MigratedCustomerData } from '../components/migration/CustomerMigrateModal'
import { customerService } from '../services/customers'
import { vpsAuthService } from '../services/vpsAuthService'
import { welcomeMessageService, buildMessage, buildWhatsAppUrl, getDefaultPassword } from '../services/welcomeMessageService'
import { getWhatsAppSettings } from '../services/whatsappSettingsService'
import { getCompanyId } from '../services/companyContext'

type FilterStatus = 'all' | 'new' | 'partial' | 'migrated' | 'error'

// ─── Helper: Transforma dados legado → payload da VPS ─────────────────────────

function mapCustomerType(type: string, wholesaleStatus?: string): 'retail' | 'wholesale' | 'resale' {
    if (wholesaleStatus === 'APPROVED') return 'wholesale'
    const t = (type || '').toLowerCase()
    if (t === 'atacado' || t === 'wholesale') return 'wholesale'
    if (t === 'revenda' || t === 'resale') return 'resale'
    return 'retail'
}

function buildPayload(customer: LegacyCustomer, companyId: string) {
    const cpf = (customer.cpf || customer.cpf_cnpj || '').replace(/\D/g, '')
    const addr = {
        street: customer.address?.street || customer.address_street || '',
        number: customer.address?.number || customer.address_number || '',
        complement: customer.address?.complement || customer.address_complement || '',
        neighborhood: customer.address?.neighborhood || customer.address_neighborhood || '',
        city: customer.address?.city || customer.address_city || '',
        state: customer.address?.state || customer.address_state || '',
        zipCode: customer.address?.zipCode || customer.address_zip_code || '',
    }
    const hasAddress = addr.city || addr.street || addr.zipCode

    return {
        company_id: companyId,
        name: (customer.name || '').trim(),
        cpf_cnpj: cpf,
        phone: (customer.whatsapp || customer.phone || '').replace(/\D/g, '') || null,
        email: customer.email || null,
        birth_date: customer.birth_date || null,
        customer_type: mapCustomerType(customer.type, customer.wholesale_status),
        instagram: customer.social_media?.instagram || null,
        is_active: true,
        address: hasAddress ? addr : null,
    }
}

function onlyDigits(value: unknown): string {
    return String(value || '').replace(/\D/g, '')
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function LegacyMigrationPage() {
    const [loading, setLoading] = useState(false)
    const [migrating, setMigrating] = useState(false)
    const [customersWithStatus, setCustomersWithStatus] = useState<CustomerMigrationStatus[]>([])
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
    const [previewCustomer, setPreviewCustomer] = useState<{ customer: LegacyCustomer; isMigrated: boolean } | null>(null)

    // Estado da migração em lote
    const [batchProgress, setBatchProgress] = useState<{
        total: number
        done: number
        errors: number
        running: boolean
    } | null>(null)
    const abortRef = useRef(false)

    const createVpsLogin = async (customerId: string, name: string, cpfDigits: string, email?: string | null) => {
        const placeholderEmail = email || `${cpfDigits}@cliente.mercadodovale.com.br`
        const tempPassword = getDefaultPassword(cpfDigits)
        await vpsAuthService.createCustomerLogin({
            customer_id: customerId,
            email: placeholderEmail,
            cpf_cnpj: cpfDigits,
            password: tempPassword,
        })
        await customerService.update(customerId, {
            user_id: customerId,
            email: placeholderEmail,
            account_status: 'active',
            name,
        } as any)
    }

    // ── Carregar e verificar clientes ─────────────────────────────────────────

    const loadCustomers = async () => {
        setLoading(true)
        try {
            const legacyCustomers = await legacyAPI.getCustomers()

            const existingCustomers = await customerService.list()

            const existingMap = new Map(
                existingCustomers.map(c => [onlyDigits(c.cpf_cnpj), c])
            )

            const statuses: CustomerMigrationStatus[] = legacyCustomers.map(customer => {
                const cpf = onlyDigits(customer.cpf || customer.cpf_cnpj)

                if (!cpf || (cpf.length !== 11 && cpf.length !== 14)) {
                    return { customer, status: 'error' as const, errorMessage: 'Sem CPF/CNPJ válido' }
                }

                const existing = existingMap.get(cpf)

                if (!existing) return { customer, status: 'new' as const }

                const missingFields: string[] = []
                if (!existing.phone && customer.whatsapp) missingFields.push('telefone')
                if (!existing.email && customer.email) missingFields.push('email')
                if (!existing.address && (customer.address || customer.address_street)) missingFields.push('endereço')
                if (!existing.birth_date && customer.birth_date) missingFields.push('nascimento')

                if (missingFields.length > 0) {
                    return { customer, status: 'partial' as const, missingFields }
                }

                return { customer, status: 'migrated' as const }
            })

            setCustomersWithStatus(statuses)
        } catch (error) {
            console.error('Erro ao carregar clientes:', error)
            toast.error('Erro ao carregar clientes do sistema legado')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadCustomers() }, [])

    // ── Migrar / Atualizar cliente individual ─────────────────────────────────

    const handleMigrate = async (legacy: LegacyCustomer, edited: MigratedCustomerData) => {
        setMigrating(true)
        try {
            const companyId = await getCompanyId()
            if (!companyId) return

            const cleanCpf = onlyDigits(edited.cpf_cnpj)
            const existing = await customerService.getByCpfCnpj(cleanCpf)

            const payload: any = {
                company_id: companyId,
                name: edited.name.trim(),
                cpf_cnpj: cleanCpf,
                phone: edited.phone || null,
                email: edited.email || null,
                birth_date: edited.birth_date || null,
                customer_type: edited.customer_type,
                instagram: edited.instagram || null,
                admin_notes: edited.admin_notes || null,
                is_active: true,
            }

            const addr = edited.address
            if (addr.city || addr.street || addr.zipCode) {
                payload.address = addr
            }

            const persistedCustomer = existing
                ? await customerService.update(existing.id, { ...payload, company_id: undefined } as any)
                : await customerService.create(payload)

            // Cria o login na auth propria da VPS para a migracao individual.
            try {
                await createVpsLogin(persistedCustomer.id, edited.name.trim(), cleanCpf, payload.email)
            } catch (authErr) {
                console.warn('Erro ao criar login VPS individual', authErr)
            }

            // Tenta enviar o WhatsApp de boas-vindas
            try {
                const [welcomeTemplate, whatsappCfg] = await Promise.all([
                    welcomeMessageService.getTemplate(),
                    getWhatsAppSettings(),
                ])
                await sendWelcomeWhatsApp(legacy, cleanCpf, welcomeTemplate, whatsappCfg)
            } catch (zapErr) {
                console.warn('Erro ao enviar zap individual', zapErr)
            }

            toast.success(`✅ "${edited.name}" importado!`)
            setPreviewCustomer(null)
            setCustomersWithStatus(prev =>
                prev.map(item =>
                    item.customer.id === legacy.id
                        ? { ...item, status: 'migrated', missingFields: undefined }
                        : item
                )
            )
        } catch (err: any) {
            toast.error(`Erro: ${err.message}`)
        } finally {
            setMigrating(false)
        }
    }

    // ── Criar conta auth + enviar WhatsApp de boas-vindas ─────────────────────

    const sendWelcomeWhatsApp = async (
        customer: LegacyCustomer,
        cpfDigits: string,
        template: string,
        whatsappSettings: any
    ) => {
        const phone = (customer.whatsapp || customer.phone || '').replace(/\D/g, '')
        if (!phone) return

        // Monta objeto Customer mínimo para o buildMessage
        const customerObj: any = {
            name: customer.name,
            cpf_cnpj: cpfDigits,
            phone,
            referral_code: customer.referral_code || '',
        }

        const message = buildMessage(template, customerObj)

        // Tenta enviar via Evolution API (se configurada e ativa)
        if (whatsappSettings?.api_url && whatsappSettings?.api_key && whatsappSettings?.is_active) {
            try {
                await fetch(`${whatsappSettings.api_url}/message/sendText/${whatsappSettings.instance_name}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': whatsappSettings.api_key,
                    },
                    body: JSON.stringify({
                        number: phone.startsWith('55') ? phone : `55${phone}`,
                        text: message,
                    }),
                })
            } catch (e) {
                console.warn('Falha ao enviar WhatsApp via Evolution API:', e)
            }
        }
        // Se não tiver Evolution API configurada, a mensagem fica disponível para envio manual
    }

    // ── Migrar TODOS em lote ──────────────────────────────────────────────────

    const handleMigrateAll = async () => {
        const toMigrate = customersWithStatus.filter(c => c.status === 'new' || c.status === 'partial')
        if (toMigrate.length === 0) { toast.info('Nenhum cliente novo para migrar'); return }

        const confirmed = window.confirm(
            `Migrar ${toMigrate.length} clientes automaticamente?\n\nOs dados serão importados com os valores do sistema antigo. Clientes com CPF inválido serão ignorados.`
        )
        if (!confirmed) return

        const companyId = await getCompanyId()
        if (!companyId) return

        // Buscar CPFs já existentes para não reinserir
        const existingRows = await customerService.list()

        const existingCpfs = new Set(existingRows.map(r => onlyDigits(r.cpf_cnpj)))

        abortRef.current = false
        setBatchProgress({ total: toMigrate.length, done: 0, errors: 0, running: true })

        // Carregar template de boas-vindas e config do WhatsApp uma única vez
        const [welcomeTemplate, whatsappCfg] = await Promise.all([
            welcomeMessageService.getTemplate(),
            getWhatsAppSettings(),
        ])


        let done = 0
        let errors = 0

        // Processar em lotes de 20
        const BATCH_SIZE = 20
        for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
            if (abortRef.current) break

            const batch = toMigrate.slice(i, i + BATCH_SIZE)
            const payloads = batch
                .map(item => {
                    const cpf = onlyDigits(item.customer.cpf || item.customer.cpf_cnpj)
                    if (!cpf || (cpf.length !== 11 && cpf.length !== 14)) return null
                    return buildPayload(item.customer, companyId)
                })
                .filter(Boolean) as any[]

            if (payloads.length === 0) {
                errors += batch.length
                done += batch.length
                setBatchProgress({ total: toMigrate.length, done, errors, running: true })
                continue
            }

            // Filtrar os que já existem no banco
            const newPayloads = payloads.filter((p: any) => !existingCpfs.has(p.cpf_cnpj))
            const alreadyMigrated = payloads.length - newPayloads.length

            if (newPayloads.length === 0) {
                done += alreadyMigrated
                setBatchProgress({ total: toMigrate.length, done, errors, running: true })
                // Atualizar status visual dos já migrados
                const cpfs = new Set(payloads.map((p: any) => p.cpf_cnpj))
                setCustomersWithStatus(prev => prev.map(item => {
                    const cpf = (item.customer.cpf || item.customer.cpf_cnpj || '').replace(/\D/g, '')
                    return cpfs.has(cpf) ? { ...item, status: 'migrated' as const } : item
                }))
                continue
            }

            try {
                for (const payload of newPayloads) {
                    await customerService.create(payload)
                    existingCpfs.add(onlyDigits(payload.cpf_cnpj))
                }
                done += newPayloads.length + alreadyMigrated

                // Atualizar status local
                const migratedCpfs = new Set(newPayloads.map((p: any) => p.cpf_cnpj))
                setCustomersWithStatus(prev =>
                    prev.map(item => {
                        const cpf = (item.customer.cpf || item.customer.cpf_cnpj || '').replace(/\D/g, '')
                        if (migratedCpfs.has(cpf)) {
                            return { ...item, status: 'migrated' as const, missingFields: undefined }
                        }
                        return item
                    })
                )

                // Criar conta auth + enviar WhatsApp para cada novo cliente
                for (const item of batch) {
                    const cpfDigits = onlyDigits(item.customer.cpf || item.customer.cpf_cnpj)
                    if (!cpfDigits || !migratedCpfs.has(cpfDigits)) continue
                    const migratedCustomer = await customerService.getByCpfCnpj(cpfDigits)
                    if (!migratedCustomer) continue

                    try {
                        await createVpsLogin(migratedCustomer.id, item.customer.name, cpfDigits, migratedCustomer.email)
                    } catch (authErr) {
                        console.warn('Erro ao criar login VPS para', cpfDigits, authErr)
                    }

                    // Enviar WhatsApp
                    await sendWelcomeWhatsApp(item.customer, cpfDigits, welcomeTemplate, whatsappCfg)
                }
            } catch (error) {
                console.error('Erro no lote:', error)
                errors += newPayloads.length
                done += alreadyMigrated
            }

            setBatchProgress({ total: toMigrate.length, done, errors, running: true })

            // Pequena pausa entre lotes
            await new Promise(r => setTimeout(r, 300))
        }

        setBatchProgress(prev => prev ? { ...prev, running: false } : null)

        if (abortRef.current) {
            toast.warning(`Migração cancelada. ${done} migrados, ${errors} erros.`)
        } else {
            toast.success(`✅ Migração concluída! ${done} migrados, ${errors} com problema.`)
        }
    }

    // ── Filtro e busca ────────────────────────────────────────────────────────

    const filtered = customersWithStatus.filter(item => {
        const matchSearch = !search ||
            item.customer.name?.toLowerCase().includes(search.toLowerCase()) ||
            (item.customer.cpf || '').includes(search) ||
            (item.customer.email || '').toLowerCase().includes(search.toLowerCase())
        const matchFilter = filterStatus === 'all' || item.status === filterStatus
        return matchSearch && matchFilter
    })

    const total = customersWithStatus.length
    const countNew = customersWithStatus.filter(c => c.status === 'new' || c.status === 'partial').length

    // ── Resincronizar Logins Faltantes ────────────────────────────────────────

    const handleSyncAuth = async () => {
        const confirmed = window.confirm(
            "Sincronizar Logins?\n\nIsso vai criar a senha (os 5 primeiros números do CPF) para TODOS os clientes que foram importados, usando os privilégios de Admin."
        )
        if (!confirmed) return

        setLoading(true)
        let count = 0
        let erros = 0
        try {
            const migrated = customersWithStatus.filter(c => c.status === 'migrated')
            for (const item of migrated) {
                const cpfDigits = (item.customer.cpf || item.customer.cpf_cnpj || '').replace(/\D/g, '')
                if (!cpfDigits) continue

                try {
                    const customer = await customerService.getByCpfCnpj(cpfDigits);
                    if (!customer) continue;
                    await createVpsLogin(customer.id, item.customer.name, cpfDigits, customer.email);
                    count++;
                } catch (e) {
                    console.error("Falha ao sincronizar login VPS:", e);
                    erros++;
                }
            }
            if (count > 0) {
                toast.success(`✅ Sincronização concluída! ${count} novas contas ativadas.`);
            } else if (erros > 0) {
                toast.error(`Sincronização rodou, mas ${erros} contas deram problema. Olhe o console (F12)`);
            } else {
                toast.info(`Nenhuma conta nova precisou ser criada (todas já existiam ou CPFs inválidos).`);
            }
        } catch (e: any) {
            toast.error(`Erro crítico no processo: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-xl">
                        <Database size={24} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Migração de Clientes</h1>
                        <p className="text-sm text-gray-500">
                            Sistema Antigo → Mercado do Vale New
                            {total > 0 && ` · ${total} clientes encontrados`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSyncAuth}
                        disabled={loading || batchProgress?.running}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        title="Corrige o bug das contas não criadas para quem já foi importado"
                    >
                        <Zap size={16} />
                        Sincronizar Logins
                    </button>
                    {countNew > 0 && !batchProgress?.running && (
                        <button
                            onClick={handleMigrateAll}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            <Zap size={16} />
                            Migrar Todos ({countNew})
                        </button>
                    )}
                    <button
                        onClick={loadCustomers}
                        disabled={loading || batchProgress?.running}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Carregando...' : 'Recarregar Lista'}
                    </button>
                </div>
            </div>

            {/* Barra de progresso da migração em lote */}
            {batchProgress && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Zap size={18} className="text-green-600" />
                            <span className="font-semibold text-gray-800">
                                {batchProgress.running ? 'Migrando clientes...' : 'Migração concluída!'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {batchProgress.done} / {batchProgress.total}
                            </span>
                            {batchProgress.running ? (
                                <button
                                    onClick={() => { abortRef.current = true }}
                                    className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs hover:bg-red-200"
                                >
                                    <X size={12} /> Cancelar
                                </button>
                            ) : (
                                <button
                                    onClick={() => setBatchProgress(null)}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200"
                                >
                                    Fechar
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-300 ${batchProgress.running ? 'bg-blue-500' : 'bg-green-500'}`}
                            style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                        />
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span className="text-green-600 font-medium">✅ {batchProgress.done - batchProgress.errors} migrados</span>
                        {batchProgress.errors > 0 && (
                            <span className="text-red-500 font-medium">❌ {batchProgress.errors} com erro</span>
                        )}
                    </div>
                </div>
            )}

            {/* Instruções */}
            {!batchProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Users size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <strong>Como funciona:</strong> Use <span className="font-semibold">"Migrar Todos"</span> para importar em lote automaticamente,
                        ou clique em <span className="font-semibold">"Preview & Importar"</span> linha a linha para revisar antes.
                        Clientes já migrados aparecem com ✅.
                    </div>
                </div>
            )}

            {/* Filtros e busca */}
            {total > 0 && (
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={15} className="text-gray-400" />
                        {(['all', 'new', 'partial', 'migrated', 'error'] as FilterStatus[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {{ all: 'Todos', new: 'Novos', partial: 'Incompletos', migrated: 'Migrados', error: 'Erros' }[f]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabela */}
            {loading && total === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-blue-400" />
                    <p className="text-sm">Carregando clientes do sistema antigo...</p>
                </div>
            ) : total === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
                    <Users size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Nenhum cliente encontrado</p>
                    <p className="text-sm mt-1">Clique em "Recarregar Lista" para buscar os dados do sistema antigo</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <Users size={18} className="text-gray-500" />
                        Clientes ({filtered.length}{filtered.length !== total ? ` de ${total}` : ''})
                    </h2>
                    <CustomerMigrationTable
                        customers={filtered}
                        onOpenPreview={(customer, isMigrated) =>
                            setPreviewCustomer({ customer, isMigrated: isMigrated ?? false })
                        }
                    />
                </div>
            )}

            {/* Modal de preview/edição individual */}
            {previewCustomer && (
                <CustomerMigrateModal
                    customer={previewCustomer.customer}
                    isMigrated={previewCustomer.isMigrated}
                    onClose={() => setPreviewCustomer(null)}
                    onConfirm={handleMigrate}
                    loading={migrating}
                />
            )}
        </div>
    )
}
