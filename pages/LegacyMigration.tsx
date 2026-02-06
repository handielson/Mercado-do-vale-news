/**
 * Página de Migração de Dados - Legacy System
 * 
 * Esta página permite visualizar e migrar dados do sistema antigo
 * para o novo sistema.
 */

import React, { useState, useEffect } from 'react'
import { legacyAPI, LegacyCustomer, LegacyProduct, LegacySale } from '../services/legacyAPI'
import { Database, Users, Package, ShoppingCart, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { CustomerDetailsModal } from '../components/migration/CustomerDetailsModal'
import { CustomerMigrationTable, CustomerMigrationStatus } from '../components/migration/CustomerMigrationTable'
import { supabase } from '../services/supabase'

export default function LegacyMigrationPage() {
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<any>(null)
    const [customersWithStatus, setCustomersWithStatus] = useState<CustomerMigrationStatus[]>([])
    const [products, setProducts] = useState<LegacyProduct[]>([])
    const [sales, setSales] = useState<LegacySale[]>([])
    const [activeTab, setActiveTab] = useState<'stats' | 'customers' | 'products' | 'sales'>('stats')
    const [selectedCustomer, setSelectedCustomer] = useState<LegacyCustomer | null>(null)

    // Carregar estatísticas
    const loadStats = async () => {
        setLoading(true)
        try {
            const data = await legacyAPI.getStats()
            setStats(data)
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error)
            alert('Erro ao carregar estatísticas')
        } finally {
            setLoading(false)
        }
    }

    // Carregar clientes e verificar status de migração
    const loadCustomers = async () => {
        setLoading(true)
        try {
            // Buscar clientes do sistema antigo
            const legacyCustomers = await legacyAPI.getCustomers()

            // Buscar todos os CPFs já migrados no Supabase
            const { data: existingCustomers, error } = await supabase
                .from('customers')
                .select('cpf_cnpj, phone, email, address')

            if (error) {
                console.error('Erro ao verificar duplicados:', error)
                toast.error('Erro ao verificar clientes existentes')
            }

            // Criar mapa de CPFs existentes
            const existingCPFs = new Map(
                (existingCustomers || []).map(c => [c.cpf_cnpj, c])
            )

            // Verificar status de cada cliente
            const customersWithStatus: CustomerMigrationStatus[] = legacyCustomers.map(customer => {
                const existing = existingCPFs.get(customer.cpf)

                if (!existing) {
                    return {
                        customer,
                        status: 'new' as const
                    }
                }

                // Verificar se tem campos faltando
                const missingFields: string[] = []
                if (!existing.phone && customer.whatsapp) missingFields.push('phone')
                if (!existing.email && customer.email) missingFields.push('email')
                if (!existing.address && customer.address) missingFields.push('address')

                if (missingFields.length > 0) {
                    return {
                        customer,
                        status: 'partial' as const,
                        missingFields
                    }
                }

                return {
                    customer,
                    status: 'migrated' as const
                }
            })

            setCustomersWithStatus(customersWithStatus)
        } catch (error) {
            console.error('Erro ao carregar clientes:', error)
            toast.error('Erro ao carregar clientes')
        } finally {
            setLoading(false)
        }
    }

    // Carregar produtos
    const loadProducts = async () => {
        setLoading(true)
        try {
            const data = await legacyAPI.getProducts({ limit: 100 })
            setProducts(data)
        } catch (error) {
            console.error('Erro ao carregar produtos:', error)
            alert('Erro ao carregar produtos')
        } finally {
            setLoading(false)
        }
    }

    // Carregar vendas
    const loadSales = async () => {
        setLoading(true)
        try {
            const data = await legacyAPI.getSales({ limit: 50 })
            setSales(data)
        } catch (error) {
            console.error('Erro ao carregar vendas:', error)
            alert('Erro ao carregar vendas')
        } finally {
            setLoading(false)
        }
    }

    // Migrar cliente individual para Supabase
    const migrateCustomer = async (customer: LegacyCustomer) => {
        try {
            setLoading(true)

            // Buscar company_id
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id')
                .eq('slug', 'mercado-do-vale')
                .single()

            if (companyError || !company) {
                toast.error('Erro ao buscar empresa')
                return
            }

            // Transformar dados do formato legacy para o formato atual
            const customerData: any = {
                company_id: company.id,
                name: customer.name,
                cpf_cnpj: customer.cpf,
                email: customer.email || null,
                phone: customer.whatsapp || null,
                customer_type: customer.wholesale_status === 'APPROVED' ? 'wholesale' : 'retail',
                is_active: true,
            }

            // Adicionar endereço como JSONB se existir
            if (customer.address) {
                customerData.address = {
                    street: customer.address.street || '',
                    number: customer.address.number || '',
                    complement: customer.address.complement || '',
                    neighborhood: customer.address.neighborhood || '',
                    city: customer.address.city || '',
                    state: customer.address.state || '',
                    zipCode: customer.address.zipCode || ''
                }
            }

            // Inserir no Supabase
            const { error: insertError } = await supabase
                .from('customers')
                .insert(customerData)

            if (insertError) {
                console.error('Erro ao migrar:', insertError)
                toast.error(`Erro: ${insertError.message}`)
                return
            }

            toast.success(`Cliente "${customer.name}" migrado com sucesso!`)

            // Recarregar lista para atualizar status
            await loadCustomers()
        } catch (error: any) {
            console.error('Erro ao migrar cliente:', error)
            toast.error(`Erro: ${error.message || 'Falha na migração'}`)
        } finally {
            setLoading(false)
        }
    }

    // Atualizar cliente parcial (campos faltantes)
    const updateCustomer = async (customer: LegacyCustomer) => {
        try {
            setLoading(true)

            // Preparar dados para atualização (apenas campos não-nulos)
            const updateData: any = {}

            if (customer.whatsapp) updateData.phone = customer.whatsapp
            if (customer.email) updateData.email = customer.email
            if (customer.address) {
                updateData.address = {
                    street: customer.address.street || '',
                    number: customer.address.number || '',
                    complement: customer.address.complement || '',
                    neighborhood: customer.address.neighborhood || '',
                    city: customer.address.city || '',
                    state: customer.address.state || '',
                    zipCode: customer.address.zipCode || ''
                }
            }

            // Atualizar no Supabase
            const { error } = await supabase
                .from('customers')
                .update(updateData)
                .eq('cpf_cnpj', customer.cpf)

            if (error) {
                console.error('Erro ao atualizar:', error)
                toast.error(`Erro: ${error.message}`)
                return
            }

            toast.success(`Cliente "${customer.name}" atualizado com sucesso!`)

            // Recarregar lista para atualizar status
            await loadCustomers()
        } catch (error: any) {
            console.error('Erro ao atualizar cliente:', error)
            toast.error(`Erro: ${error.message || 'Falha na atualização'}`)
        } finally {
            setLoading(false)
        }
    }

    // Carregar dados iniciais
    useEffect(() => {
        loadStats()
    }, [])

    // Exportar dados para JSON
    const exportToJSON = (data: any, filename: string) => {
        const json = JSON.stringify(data, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Database size={32} />
                    Migração de Dados - Sistema Antigo
                </h1>
                <p className="text-gray-600 mt-2">
                    Visualize e migre dados do sistema antigo (MV-Gestão) para o novo sistema
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex gap-6">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'stats'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Database className="inline mr-2" size={18} />
                        Estatísticas
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'customers'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Users className="inline mr-2" size={18} />
                        Clientes
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'products'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Package className="inline mr-2" size={18} />
                        Produtos
                    </button>
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sales'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <ShoppingCart className="inline mr-2" size={18} />
                        Vendas
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow p-6">
                {/* Estatísticas Tab */}
                {activeTab === 'stats' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Estatísticas Gerais</h2>
                            <button
                                onClick={loadStats}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                Atualizar
                            </button>
                        </div>
                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600 font-medium">Total de Clientes</p>
                                    <p className="text-3xl font-bold text-blue-900">{stats.total_customers || 0}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-600 font-medium">Total de Produtos</p>
                                    <p className="text-3xl font-bold text-green-900">{stats.total_products || 0}</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <p className="text-sm text-purple-600 font-medium">Total de Vendas</p>
                                    <p className="text-3xl font-bold text-purple-900">{stats.total_sales || 0}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Clientes Tab */}
                {activeTab === 'customers' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Clientes ({customersWithStatus.length})</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => exportToJSON(customersWithStatus.map(c => c.customer), 'customers.json')}
                                    disabled={customersWithStatus.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    <Download size={18} />
                                    Exportar JSON
                                </button>
                                <button
                                    onClick={loadCustomers}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                    Carregar
                                </button>
                            </div>
                        </div>
                        {customersWithStatus.length > 0 && (
                            <CustomerMigrationTable
                                customers={customersWithStatus}
                                onViewDetails={setSelectedCustomer}
                                onMigrate={migrateCustomer}
                                onUpdate={updateCustomer}
                            />
                        )}
                    </div>
                )}

                {/* Produtos Tab */}
                {activeTab === 'products' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Produtos ({products.length})</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => exportToJSON(products, 'products.json')}
                                    disabled={products.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    <Download size={18} />
                                    Exportar JSON
                                </button>
                                <button
                                    onClick={loadProducts}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                    Carregar
                                </button>
                            </div>
                        </div>
                        {products.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nome</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Código</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Preço</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Estoque</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {products.slice(0, 50).map(product => (
                                            <tr key={product.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm">{product.name}</td>
                                                <td className="px-4 py-2 text-sm font-mono">{product.code}</td>
                                                <td className="px-4 py-2 text-sm">R$ {product.price.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-sm">{product.stock}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Vendas Tab */}
                {activeTab === 'sales' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Vendas ({sales.length})</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => exportToJSON(sales, 'sales.json')}
                                    disabled={sales.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    <Download size={18} />
                                    Exportar JSON
                                </button>
                                <button
                                    onClick={loadSales}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                    Carregar
                                </button>
                            </div>
                        </div>
                        {sales.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Data</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Cliente</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sales.slice(0, 50).map(sale => (
                                            <tr key={sale.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm">{new Date(sale.created_at).toLocaleDateString()}</td>
                                                <td className="px-4 py-2 text-sm">{sale.customer_id}</td>
                                                <td className="px-4 py-2 text-sm">R$ {sale.total.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-sm">{sale.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Detalhes do Cliente */}
            {selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    onConfirm={migrateCustomer}
                    loading={loading}
                />
            )}
        </div>
    )
}
