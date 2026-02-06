import React from 'react'
import { LegacyCustomer } from '../../services/legacyAPI'
import { ArrowRight } from 'lucide-react'

interface CustomerDetailsModalProps {
    customer: LegacyCustomer
    onClose: () => void
    onConfirm: (customer: LegacyCustomer) => void
    loading: boolean
}

export function CustomerDetailsModal({ customer, onClose, onConfirm, loading }: CustomerDetailsModalProps) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Detalhes do Cliente</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Nome Completo</label>
                            <p className="text-lg font-semibold text-gray-900">{customer.name}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">CPF/CNPJ</label>
                            <p className="text-lg font-mono text-gray-900">{customer.cpf || 'Não informado'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Email</label>
                            <p className="text-gray-900">{customer.email || 'Não informado'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">WhatsApp</label>
                            <p className="text-gray-900">{customer.whatsapp || 'Não informado'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Data de Nascimento</label>
                            <p className="text-gray-900">{customer.birth_date || 'Não informado'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Instagram</label>
                            <p className="text-gray-900">{customer.social_media?.instagram ? `@${customer.social_media.instagram}` : 'Não informado'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Tipo de Cliente</label>
                            <p className="text-gray-900">
                                <span className={`px-3 py-1 rounded ${customer.type === 'Atacado' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                    {customer.type}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Status Atacado</label>
                            <p className="text-gray-900">{customer.wholesale_status === 'APPROVED' ? '✅ Aprovado' : customer.wholesale_status === 'PENDING' ? '⏳ Pendente' : '❌ Não'}</p>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <label className="text-sm font-medium text-gray-600">Endereço Completo</label>
                        <p className="text-gray-900">
                            {customer.address?.street && `${customer.address.street}, `}
                            {customer.address?.number && `${customer.address.number}`}
                            {customer.address?.complement && ` - ${customer.address.complement}`}
                            {!customer.address?.street && 'Não informado'}
                        </p>
                        <p className="text-gray-900 mt-1">
                            {customer.address?.neighborhood && `${customer.address.neighborhood}, `}
                            {customer.address?.city && `${customer.address.city}`}
                            {customer.address?.state && ` - ${customer.address.state}`}
                            {customer.address?.zipCode && ` | CEP: ${customer.address.zipCode}`}
                        </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            <strong>⚠️ Atenção:</strong> Ao migrar, será criado um usuário no novo sistema com:
                        </p>
                        <ul className="list-disc list-inside text-sm text-yellow-700 mt-2">
                            <li>Username: {customer.cpf}</li>
                            <li>Email: {customer.email || `${customer.cpf}@placeholder.com`}</li>
                            <li>Senha temporária: 12345678</li>
                            <li>Tipo: {customer.wholesale_status === 'APPROVED' ? 'Atacado' : 'Varejo'}</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            onConfirm(customer)
                            onClose()
                        }}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <ArrowRight size={18} />
                        Confirmar Migração
                    </button>
                </div>
            </div>
        </div>
    )
}
