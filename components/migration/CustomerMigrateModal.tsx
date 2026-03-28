/**
 * CustomerMigrateModal
 * 
 * Modal de pré-visualização e edição antes de migrar um cliente.
 * Mostra lado a lado: dados do sistema legado vs. como ficará no novo sistema.
 * Todos os campos do novo sistema são editáveis antes de confirmar.
 */

import React, { useState } from 'react'
import { LegacyCustomer } from '../../services/legacyAPI'
import { ArrowRight, X, AlertTriangle, CheckCircle, User } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MigratedCustomerData {
    name: string
    cpf_cnpj: string
    phone: string
    email: string
    birth_date: string
    customer_type: 'retail' | 'wholesale' | 'resale'
    instagram: string
    admin_notes: string
    address: {
        street: string
        number: string
        complement: string
        neighborhood: string
        city: string
        state: string
        zipCode: string
    }
}

interface CustomerMigrateModalProps {
    customer: LegacyCustomer
    onClose: () => void
    onConfirm: (customer: LegacyCustomer, edited: MigratedCustomerData) => void
    loading: boolean
    isMigrated?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCustomerType(type: string, wholesaleStatus?: string): 'retail' | 'wholesale' | 'resale' {
    if (wholesaleStatus === 'APPROVED') return 'wholesale'
    const t = (type || '').toLowerCase()
    if (t === 'atacado' || t === 'wholesale') return 'wholesale'
    if (t === 'revenda' || t === 'resale') return 'resale'
    return 'retail'
}

function getAddressFromLegacy(customer: LegacyCustomer) {
    // Suporte a dois formatos: JSONB aninhado ou colunas separadas
    return {
        street: customer.address?.street || customer.address_street || '',
        number: customer.address?.number || customer.address_number || '',
        complement: customer.address?.complement || customer.address_complement || '',
        neighborhood: customer.address?.neighborhood || customer.address_neighborhood || '',
        city: customer.address?.city || customer.address_city || '',
        state: customer.address?.state || customer.address_state || '',
        zipCode: customer.address?.zipCode || customer.address_zip_code || '',
    }
}

function buildPreviewData(customer: LegacyCustomer): MigratedCustomerData {
    return {
        name: (customer.name || '').trim(),
        cpf_cnpj: (customer.cpf || customer.cpf_cnpj || '').replace(/\D/g, ''),
        phone: (customer.whatsapp || customer.phone || '').replace(/\D/g, ''),
        email: customer.email || '',
        birth_date: customer.birth_date || '',
        customer_type: mapCustomerType(customer.type, customer.wholesale_status),
        instagram: customer.social_media?.instagram || '',
        admin_notes: '',
        address: getAddressFromLegacy(customer),
    }
}

function isCpfValid(cpf: string): boolean {
    const c = cpf.replace(/\D/g, '')
    return c.length === 11 || c.length === 14
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CustomerMigrateModal({ customer, onClose, onConfirm, loading, isMigrated }: CustomerMigrateModalProps) {
    const [data, setData] = useState<MigratedCustomerData>(() => buildPreviewData(customer))

    const cpfValid = isCpfValid(data.cpf_cnpj)

    function update(field: keyof MigratedCustomerData, value: any) {
        setData(prev => ({ ...prev, [field]: value }))
    }

    function updateAddress(field: keyof MigratedCustomerData['address'], value: string) {
        setData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }))
    }

    function handleConfirm() {
        onConfirm(customer, data)
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <User size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {isMigrated ? 'Revisar Cliente Migrado' : 'Pré-visualização de Migração'}
                            </h2>
                            <p className="text-sm text-gray-500">Revise e edite os dados antes de importar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Alerta CPF inválido */}
                    {!cpfValid && (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                            <AlertTriangle size={18} className="flex-shrink-0" />
                            <p className="text-sm"><strong>CPF/CNPJ inválido:</strong> "{customer.cpf}" — corrija antes de migrar.</p>
                        </div>
                    )}

                    {/* Grid: Legado | → | Novo */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                        {/* ── LEGADO ── */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                                Sistema Antigo
                            </h3>
                            <LegacyField label="Nome" value={customer.name} />
                            <LegacyField label="CPF/CNPJ" value={customer.cpf || customer.cpf_cnpj} mono />
                            <LegacyField label="WhatsApp" value={customer.whatsapp} />
                            <LegacyField label="Email" value={customer.email} />
                            <LegacyField label="Tipo" value={customer.type} />
                            <LegacyField label="Status Atacado" value={customer.wholesale_status || '—'} />
                            <LegacyField label="Nascimento" value={customer.birth_date} />
                            <LegacyField label="Instagram" value={customer.social_media?.instagram} />
                            <LegacyField label="Cidade" value={customer.address?.city || customer.address_city} />
                            <LegacyField label="Estado" value={customer.address?.state || customer.address_state} />
                            <LegacyField label="CEP" value={customer.address?.zipCode || customer.address_zip_code} />
                            <LegacyField label="Rua" value={customer.address?.street || customer.address_street} />
                            <LegacyField label="Número" value={customer.address?.number || customer.address_number} />
                            <LegacyField label="Bairro" value={customer.address?.neighborhood || customer.address_neighborhood} />
                        </div>

                        {/* Seta */}
                        <div className="flex items-center pt-16">
                            <div className="bg-blue-100 rounded-full p-2">
                                <ArrowRight size={18} className="text-blue-600" />
                            </div>
                        </div>

                        {/* ── NOVO SISTEMA (editável) ── */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                Novo Sistema <span className="text-blue-300">(editável)</span>
                            </h3>

                            {/* Nome */}
                            <EditableField label="Nome *">
                                <input
                                    value={data.name}
                                    onChange={e => update('name', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </EditableField>

                            {/* CPF */}
                            <EditableField label="CPF/CNPJ *" invalid={!cpfValid}>
                                <input
                                    value={data.cpf_cnpj}
                                    onChange={e => update('cpf_cnpj', e.target.value.replace(/\D/g, ''))}
                                    className={`w-full text-sm border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 ${cpfValid
                                        ? 'border-gray-200 focus:ring-blue-300'
                                        : 'border-red-300 bg-red-50 focus:ring-red-300'
                                    }`}
                                    placeholder="Apenas números"
                                />
                            </EditableField>

                            {/* Telefone */}
                            <EditableField label="Telefone/WhatsApp">
                                <input
                                    value={data.phone}
                                    onChange={e => update('phone', e.target.value.replace(/\D/g, ''))}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="Apenas números"
                                />
                            </EditableField>

                            {/* Email */}
                            <EditableField label="Email">
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={e => update('email', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </EditableField>

                            {/* Tipo */}
                            <EditableField label="Tipo de Cliente">
                                <select
                                    value={data.customer_type}
                                    onChange={e => update('customer_type', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                >
                                    <option value="retail">Varejo (retail)</option>
                                    <option value="wholesale">Atacado (wholesale)</option>
                                    <option value="resale">Revenda (resale)</option>
                                </select>
                            </EditableField>

                            {/* Nascimento */}
                            <EditableField label="Data de Nascimento">
                                <input
                                    type="date"
                                    value={data.birth_date}
                                    onChange={e => update('birth_date', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </EditableField>

                            {/* Instagram */}
                            <EditableField label="Instagram">
                                <input
                                    value={data.instagram}
                                    onChange={e => update('instagram', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="@usuario"
                                />
                            </EditableField>

                            {/* Cidade + Estado inline */}
                            <div className="grid grid-cols-2 gap-2">
                                <EditableField label="Cidade">
                                    <input
                                        value={data.address.city}
                                        onChange={e => updateAddress('city', e.target.value)}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </EditableField>
                                <EditableField label="Estado">
                                    <input
                                        value={data.address.state}
                                        onChange={e => updateAddress('state', e.target.value)}
                                        maxLength={2}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </EditableField>
                            </div>

                            {/* CEP */}
                            <EditableField label="CEP">
                                <input
                                    value={data.address.zipCode}
                                    onChange={e => updateAddress('zipCode', e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </EditableField>

                            {/* Rua + Número */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <EditableField label="Rua">
                                        <input
                                            value={data.address.street}
                                            onChange={e => updateAddress('street', e.target.value)}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        />
                                    </EditableField>
                                </div>
                                <EditableField label="Número">
                                    <input
                                        value={data.address.number}
                                        onChange={e => updateAddress('number', e.target.value)}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </EditableField>
                            </div>

                            {/* Bairro + Complemento */}
                            <div className="grid grid-cols-2 gap-2">
                                <EditableField label="Bairro">
                                    <input
                                        value={data.address.neighborhood}
                                        onChange={e => updateAddress('neighborhood', e.target.value)}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </EditableField>
                                <EditableField label="Complemento">
                                    <input
                                        value={data.address.complement}
                                        onChange={e => updateAddress('complement', e.target.value)}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </EditableField>
                            </div>

                            {/* Observações internas */}
                            <EditableField label="Obs. Internas (admin)">
                                <textarea
                                    value={data.admin_notes}
                                    onChange={e => update('admin_notes', e.target.value)}
                                    rows={2}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                    placeholder="Notas visíveis apenas para admins..."
                                />
                            </EditableField>
                        </div>
                    </div>

                    {/* Resumo do que vai ser importado */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-600" />
                            Resumo do Registro a Importar
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <SummaryItem label="Nome" value={data.name || '—'} />
                            <SummaryItem label="CPF/CNPJ" value={data.cpf_cnpj || '—'} valid={cpfValid} />
                            <SummaryItem label="Tipo" value={data.customer_type} />
                            <SummaryItem label="Telefone" value={data.phone || '—'} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !data.name || !cpfValid}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Importando...
                            </>
                        ) : (
                            <>
                                <ArrowRight size={16} />
                                {isMigrated ? 'Atualizar no Novo Sistema' : 'Importar para o Novo Sistema'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function LegacyField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
    return (
        <div>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className={`text-sm text-gray-700 truncate ${mono ? 'font-mono' : ''} ${!value ? 'text-gray-300 italic' : ''}`}>
                {value || 'não informado'}
            </p>
        </div>
    )
}

function EditableField({ label, children, invalid }: { label: string; children: React.ReactNode; invalid?: boolean }) {
    return (
        <div>
            <label className={`block text-xs font-medium mb-1 ${invalid ? 'text-red-500' : 'text-gray-500'}`}>{label}</label>
            {children}
        </div>
    )
}

function SummaryItem({ label, value, valid }: { label: string; value: string; valid?: boolean }) {
    return (
        <div>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-sm font-semibold truncate ${valid === false ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
        </div>
    )
}
