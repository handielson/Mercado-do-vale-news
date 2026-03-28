import React from 'react'
import { LegacyCustomer } from '../../services/legacyAPI'
import { Eye, RefreshCw, CheckCircle } from 'lucide-react'

export type MigrationStatus = 'migrated' | 'new' | 'partial' | 'checking' | 'error'

export interface CustomerMigrationStatus {
    customer: LegacyCustomer
    status: MigrationStatus
    missingFields?: string[]
    errorMessage?: string
}

interface CustomerMigrationTableProps {
    customers: CustomerMigrationStatus[]
    onOpenPreview: (customer: LegacyCustomer, isMigrated?: boolean) => void
}

export function CustomerMigrationTable({ customers, onOpenPreview }: CustomerMigrationTableProps) {
    const getStatusBadge = (item: CustomerMigrationStatus) => {
        switch (item.status) {
            case 'migrated':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">✅ Migrado</span>
            case 'new':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">🆕 Novo</span>
            case 'partial':
                return (
                    <span
                        className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium whitespace-nowrap cursor-help"
                        title={`Campos faltando: ${item.missingFields?.join(', ')}`}
                    >
                        ⚠️ Incompleto
                    </span>
                )
            case 'error':
                return (
                    <span
                        className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium whitespace-nowrap cursor-help"
                        title={item.errorMessage}
                    >
                        ❌ Erro
                    </span>
                )
            case 'checking':
                return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium whitespace-nowrap">🔄 Verificando</span>
        }
    }

    const getActionButton = (item: CustomerMigrationStatus) => {
        const { customer, status } = item

        if (status === 'checking') {
            return (
                <button disabled className="px-3 py-1 bg-gray-100 text-gray-400 rounded-lg text-xs cursor-wait flex items-center gap-1">
                    <RefreshCw size={12} className="animate-spin" />
                </button>
            )
        }

        if (status === 'migrated') {
            return (
                <button
                    onClick={() => onOpenPreview(customer, true)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 flex items-center gap-1 transition-colors"
                    title="Ver dados migrados"
                >
                    <Eye size={12} />
                    Ver
                </button>
            )
        }

        // new | partial | error — abre preview para editar e migrar
        return (
            <button
                onClick={() => onOpenPreview(customer, false)}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${status === 'partial'
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : status === 'error'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
            >
                <Eye size={12} />
                {status === 'partial' ? 'Completar' : status === 'error' ? 'Corrigir' : 'Preview & Importar'}
            </button>
        )
    }

    // Resumo de contagens
    const counts = {
        new: customers.filter(c => c.status === 'new').length,
        partial: customers.filter(c => c.status === 'partial').length,
        migrated: customers.filter(c => c.status === 'migrated').length,
        error: customers.filter(c => c.status === 'error').length,
    }

    return (
        <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{counts.new}</p>
                    <p className="text-xs text-blue-500 font-medium">Novos</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{counts.partial}</p>
                    <p className="text-xs text-yellow-500 font-medium">Incompletos</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{counts.migrated}</p>
                    <p className="text-xs text-green-500 font-medium flex items-center justify-center gap-1">
                        <CheckCircle size={10} /> Migrados
                    </p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{counts.error}</p>
                    <p className="text-xs text-red-500 font-medium">Erros</p>
                </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">CPF</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">WhatsApp</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cidade</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {customers.map(item => {
                            const { customer } = item
                            const city = customer.address?.city || customer.address_city || '—'
                            const hasCpf = !!(customer.cpf || customer.cpf_cnpj)
                            return (
                                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
                                    <td className={`px-4 py-3 font-mono text-xs ${hasCpf ? 'text-gray-700' : 'text-red-400 italic'}`}>
                                        {customer.cpf || customer.cpf_cnpj || 'sem CPF'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[140px]">{customer.email || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{customer.whatsapp || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500">{city}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${customer.type === 'Atacado'
                                            ? 'bg-blue-100 text-blue-700'
                                            : customer.type === 'Revenda'
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-green-100 text-green-700'
                                            }`}>
                                            {customer.type || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(item)}</td>
                                    <td className="px-4 py-3">{getActionButton(item)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
