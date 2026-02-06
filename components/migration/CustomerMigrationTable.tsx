import React from 'react'
import { LegacyCustomer } from '../../services/legacyAPI'

export type MigrationStatus = 'migrated' | 'new' | 'partial' | 'checking'

export interface CustomerMigrationStatus {
    customer: LegacyCustomer
    status: MigrationStatus
    missingFields?: string[]
}

interface CustomerMigrationTableProps {
    customers: CustomerMigrationStatus[]
    onViewDetails: (customer: LegacyCustomer) => void
    onMigrate: (customer: LegacyCustomer) => void
    onUpdate: (customer: LegacyCustomer) => void
}

export function CustomerMigrationTable({ customers, onViewDetails, onMigrate, onUpdate }: CustomerMigrationTableProps) {
    const getStatusBadge = (status: MigrationStatus) => {
        switch (status) {
            case 'migrated':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✅ Migrado</span>
            case 'new':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">🆕 Novo</span>
            case 'partial':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">⚠️ Parcial</span>
            case 'checking':
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">🔄 Verificando...</span>
        }
    }

    const getActionButton = (item: CustomerMigrationStatus) => {
        const { customer, status, missingFields } = item

        if (status === 'checking') {
            return (
                <button disabled className="px-3 py-1 bg-gray-300 text-gray-500 rounded text-xs cursor-wait">
                    🔄 Verificando...
                </button>
            )
        }

        if (status === 'migrated') {
            return (
                <button
                    onClick={() => onViewDetails(customer)}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                    title="Cliente já migrado - clique para ver detalhes"
                >
                    👁️ Ver
                </button>
            )
        }

        if (status === 'partial') {
            return (
                <div className="flex gap-1">
                    <button
                        onClick={() => onUpdate(customer)}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                        title={`Atualizar campos: ${missingFields?.join(', ')}`}
                    >
                        🔄 Atualizar
                    </button>
                    <button
                        onClick={() => onViewDetails(customer)}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                    >
                        👁️
                    </button>
                </div>
            )
        }

        // status === 'new'
        return (
            <div className="flex gap-1">
                <button
                    onClick={() => onMigrate(customer)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                    ➡️ Migrar
                </button>
                <button
                    onClick={() => onViewDetails(customer)}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                    👁️
                </button>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nome</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">CPF</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">WhatsApp</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Cidade</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tipo</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {customers.slice(0, 50).map(item => {
                        const { customer } = item
                        return (
                            <tr key={customer.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm font-medium">{customer.name}</td>
                                <td className="px-4 py-2 text-sm font-mono text-xs">{customer.cpf || '-'}</td>
                                <td className="px-4 py-2 text-sm text-xs">{customer.email || '-'}</td>
                                <td className="px-4 py-2 text-sm">{customer.whatsapp || '-'}</td>
                                <td className="px-4 py-2 text-sm">{customer.address?.city || '-'}</td>
                                <td className="px-4 py-2 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs ${customer.type === 'Atacado' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {customer.type}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-sm">
                                    {getStatusBadge(item.status)}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                    {getActionButton(item)}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
