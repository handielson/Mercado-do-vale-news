import React from 'react';
import { Customer } from '../../types/customer';

interface CustomerPrintableViewProps {
    customer: Customer;
    showAdminNotes?: boolean;
}

export default function CustomerPrintableView({ customer, showAdminNotes = false }: CustomerPrintableViewProps) {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const calculateAge = (birthDate: string) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const getFullAddress = () => {
        if (!customer.address) return null;
        const { street, number, complement, neighborhood, city, state, zipCode } = customer.address;
        const parts = [];
        if (street) parts.push(street);
        if (number) parts.push(number);
        if (complement) parts.push(complement);
        if (neighborhood) parts.push(neighborhood);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (zipCode) parts.push(`CEP: ${zipCode}`);
        return parts.length > 0 ? parts.join(', ') : null;
    };

    return (
        <div className="print-only print-container p-8 bg-white">
            {/* Header */}
            <div className="print-header border-b-2 border-gray-800 pb-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Ficha de Cliente
                </h1>
                <p className="text-lg text-gray-600">Mercado do Vale</p>
            </div>

            {/* Dados Pessoais */}
            <section className="print-section mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
                    Dados Pessoais
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-600">Nome / Razão Social:</p>
                        <p className="text-base text-gray-900">{customer.name}</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-600">CPF/CNPJ:</p>
                        <p className="text-base text-gray-900">{customer.cpf_cnpj}</p>
                    </div>
                    {customer.birth_date && (
                        <>
                            <div>
                                <p className="text-sm font-semibold text-gray-600">Data de Nascimento:</p>
                                <p className="text-base text-gray-900">
                                    {formatDate(customer.birth_date)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-600">Idade:</p>
                                <p className="text-base text-gray-900">{calculateAge(customer.birth_date)} anos</p>
                            </div>
                        </>
                    )}
                    {customer.customer_type && (
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Tipo de Cliente:</p>
                            <p className="text-base text-gray-900">
                                {customer.customer_type === 'wholesale' && 'Atacado'}
                                {customer.customer_type === 'resale' && 'Revenda'}
                                {customer.customer_type === 'retail' && 'Varejo'}
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold text-gray-600">Status:</p>
                        <p className="text-base text-gray-900">
                            {customer.is_active ? 'Ativo' : 'Inativo'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Contato */}
            <section className="print-section mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
                    Contato
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    {customer.email && (
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Email:</p>
                            <p className="text-base text-gray-900">{customer.email}</p>
                        </div>
                    )}
                    {customer.phone && (
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Telefone:</p>
                            <p className="text-base text-gray-900">{customer.phone}</p>
                        </div>
                    )}
                    {customer.instagram && (
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Instagram:</p>
                            <p className="text-base text-gray-900">@{customer.instagram}</p>
                        </div>
                    )}
                    {customer.facebook && (
                        <div>
                            <p className="text-sm font-semibold text-gray-600">Facebook:</p>
                            <p className="text-base text-gray-900">{customer.facebook}</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Endereço */}
            {getFullAddress() && (
                <section className="print-section mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
                        Endereço
                    </h2>
                    <p className="text-base text-gray-900">{getFullAddress()}</p>
                </section>
            )}

            {/* Observações Internas */}
            {showAdminNotes && customer.admin_notes && (
                <section className="print-section mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
                        Observações Internas
                    </h2>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">
                        {customer.admin_notes}
                    </p>
                </section>
            )}

            {/* Informações de Cadastro */}
            <section className="print-section mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
                    Informações de Cadastro
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-600">Data de Cadastro:</p>
                        <p className="text-base text-gray-900">
                            {formatDate(customer.created_at)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-600">Última Atualização:</p>
                        <p className="text-base text-gray-900">
                            {formatDate(customer.updated_at)}
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <div className="print-footer mt-8 pt-4 border-t border-gray-300">
                <p className="text-sm text-gray-600">
                    Impresso em: {new Date().toLocaleString('pt-BR')}
                </p>
            </div>
        </div>
    );
}
