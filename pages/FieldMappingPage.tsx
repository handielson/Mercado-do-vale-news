import React, { useState, useEffect } from 'react'
import { legacyAPI } from '../services/legacyAPI'
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'

interface FieldMapping {
    legacyField: string
    legacyValue: any
    newField: string
    newValue: any
    status: 'ok' | 'warning' | 'error'
    notes?: string
}

export default function FieldMappingPage() {
    const [loading, setLoading] = useState(false)
    const [sampleCustomer, setSampleCustomer] = useState<any>(null)
    const [mappings, setMappings] = useState<FieldMapping[]>([])

    const loadSampleCustomer = async () => {
        setLoading(true)
        try {
            const customers = await legacyAPI.getCustomers()
            if (customers.length > 0) {
                // Procurar por Handielson Amorim Bonfim (tem todos os campos)
                const customer = customers.find(c => c.name.includes('Handielson')) || customers[0]
                setSampleCustomer(customer)
                generateMappings(customer)
            }
        } catch (error) {
            console.error('Erro ao carregar cliente:', error)
        } finally {
            setLoading(false)
        }
    }

    const generateMappings = (customer: any) => {
        const maps: FieldMapping[] = []

        // Nome
        maps.push({
            legacyField: 'name',
            legacyValue: customer.name,
            newField: 'name',
            newValue: customer.name,
            status: 'ok'
        })

        // CPF
        maps.push({
            legacyField: 'cpf',
            legacyValue: customer.cpf,
            newField: 'cpf',
            newValue: customer.cpf,
            status: 'ok'
        })

        // WhatsApp/Phone
        maps.push({
            legacyField: 'whatsapp',
            legacyValue: customer.whatsapp,
            newField: 'phone',
            newValue: customer.whatsapp,
            status: customer.whatsapp ? 'ok' : 'warning',
            notes: customer.whatsapp ? 'Campo whatsapp → phone' : 'Campo vazio no sistema antigo'
        })

        // Email
        maps.push({
            legacyField: 'email',
            legacyValue: customer.email,
            newField: 'email',
            newValue: customer.email || `${customer.cpf}@placeholder.com`,
            status: customer.email ? 'ok' : 'warning',
            notes: customer.email ? undefined : 'Email não existe, será criado placeholder'
        })

        // Birth Date
        maps.push({
            legacyField: 'birth_date',
            legacyValue: customer.birth_date,
            newField: 'birth_date',
            newValue: customer.birth_date,
            status: customer.birth_date ? 'ok' : 'warning',
            notes: customer.birth_date ? undefined : 'Data de nascimento não cadastrada'
        })

        // Type
        maps.push({
            legacyField: 'type',
            legacyValue: customer.type,
            newField: 'type',
            newValue: customer.type?.toLowerCase(),
            status: customer.type ? 'ok' : 'error',
            notes: `Converter "${customer.type}" para lowercase`
        })

        // Wholesale Status
        maps.push({
            legacyField: 'wholesale_status',
            legacyValue: customer.wholesale_status,
            newField: 'type (atacado/varejo)',
            newValue: customer.wholesale_status === 'approved' ? 'atacado' : 'varejo',
            status: 'warning',
            notes: 'Precisa confirmar lógica de conversão'
        })

        // Address - Street
        maps.push({
            legacyField: 'address.street',
            legacyValue: customer.address?.street,
            newField: 'address_street',
            newValue: customer.address?.street,
            status: customer.address?.street ? 'ok' : 'warning',
            notes: 'JSONB → campo plano'
        })

        // Address - Number
        maps.push({
            legacyField: 'address.number',
            legacyValue: customer.address?.number,
            newField: 'address_number',
            newValue: customer.address?.number,
            status: customer.address?.number ? 'ok' : 'warning'
        })

        // Address - Complement
        maps.push({
            legacyField: 'address.complement',
            legacyValue: customer.address?.complement,
            newField: 'address_complement',
            newValue: customer.address?.complement,
            status: 'ok'
        })

        // Address - Neighborhood
        maps.push({
            legacyField: 'address.neighborhood',
            legacyValue: customer.address?.neighborhood,
            newField: 'address_neighborhood',
            newValue: customer.address?.neighborhood,
            status: customer.address?.neighborhood ? 'ok' : 'warning'
        })

        // Address - City
        maps.push({
            legacyField: 'address.city',
            legacyValue: customer.address?.city,
            newField: 'address_city',
            newValue: customer.address?.city,
            status: customer.address?.city ? 'ok' : 'warning'
        })

        // Address - State
        maps.push({
            legacyField: 'address.state',
            legacyValue: customer.address?.state,
            newField: 'address_state',
            newValue: customer.address?.state,
            status: customer.address?.state ? 'ok' : 'warning'
        })

        // Address - ZIP Code
        maps.push({
            legacyField: 'address.zipCode',
            legacyValue: customer.address?.zipCode,
            newField: 'address_zip_code',
            newValue: customer.address?.zipCode,
            status: customer.address?.zipCode ? 'ok' : 'warning'
        })

        // Instagram
        maps.push({
            legacyField: 'social_media.instagram',
            legacyValue: customer.social_media?.instagram,
            newField: 'instagram',
            newValue: customer.social_media?.instagram,
            status: customer.social_media?.instagram ? 'ok' : 'warning',
            notes: customer.social_media?.instagram ? 'JSONB → campo plano' : 'Instagram não cadastrado'
        })

        setMappings(maps)
    }

    useEffect(() => {
        loadSampleCustomer()
    }, [])

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Mapeamento de Campos - Migração</h1>
                <p className="text-gray-600 mt-2">
                    Visualize como os dados do sistema antigo serão mapeados para o novo sistema
                </p>
            </div>

            {loading && (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando cliente exemplo...</p>
                </div>
            )}

            {sampleCustomer && (
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h2 className="text-lg font-semibold text-blue-900 mb-2">Cliente Exemplo</h2>
                        <p className="text-blue-800">
                            <strong>Nome:</strong> {sampleCustomer.name}
                        </p>
                        <p className="text-blue-800">
                            <strong>CPF:</strong> {sampleCustomer.cpf}
                        </p>
                    </div>

                    {/* Raw Data */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Dados Brutos (JSON)</h3>
                        <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                            {JSON.stringify(sampleCustomer, null, 2)}
                        </pre>
                    </div>

                    {/* Mappings Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Campo Sistema Antigo
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Valor Atual
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        <ArrowRight className="inline" size={16} />
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Campo Sistema Novo
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Valor Migrado
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {mappings.map((mapping, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                                            {mapping.legacyField}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                {mapping.legacyValue !== undefined && mapping.legacyValue !== null
                                                    ? JSON.stringify(mapping.legacyValue)
                                                    : '(vazio)'}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <ArrowRight className="inline text-gray-400" size={16} />
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-blue-900">
                                            {mapping.newField}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                            <code className="bg-blue-50 px-2 py-1 rounded text-xs">
                                                {mapping.newValue !== undefined && mapping.newValue !== null
                                                    ? JSON.stringify(mapping.newValue)
                                                    : '(vazio)'}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-start gap-2">
                                                {mapping.status === 'ok' && (
                                                    <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                                                )}
                                                {mapping.status === 'warning' && (
                                                    <AlertCircle className="text-yellow-600 flex-shrink-0" size={16} />
                                                )}
                                                {mapping.status === 'error' && (
                                                    <AlertCircle className="text-red-600 flex-shrink-0" size={16} />
                                                )}
                                                {mapping.notes && (
                                                    <span className="text-xs text-gray-600">{mapping.notes}</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-600 font-medium">Campos OK</p>
                            <p className="text-2xl font-bold text-green-900">
                                {mappings.filter(m => m.status === 'ok').length}
                            </p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-600 font-medium">Avisos</p>
                            <p className="text-2xl font-bold text-yellow-900">
                                {mappings.filter(m => m.status === 'warning').length}
                            </p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-600 font-medium">Erros</p>
                            <p className="text-2xl font-bold text-red-900">
                                {mappings.filter(m => m.status === 'error').length}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
