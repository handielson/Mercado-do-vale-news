import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, User, Mail, Phone, MapPin, FileText, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { customerService } from '../../services/customers';
import { Customer } from '../../types/customer';

/**
 * Customer Details Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - Read-only view with actions
 * - < 500 lines
 */
export default function CustomerDetailsPage() {
    const navigate = useNavigate();
    const { id } = useParams();

    // State
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Load customer
    useEffect(() => {
        if (id) {
            loadCustomer(id);
        }
    }, [id]);

    const loadCustomer = async (customerId: string) => {
        try {
            setLoading(true);
            const data = await customerService.getById(customerId);
            setCustomer(data);
        } catch (err) {
            console.error('Error loading customer:', err);
            setError('Erro ao carregar cliente');
        } finally {
            setLoading(false);
        }
    };

    // Delete customer
    const handleDelete = async () => {
        if (!id) return;

        try {
            await customerService.delete(id);
            navigate('/admin/customers');
        } catch (err) {
            console.error('Error deleting customer:', err);
            alert('Erro ao deletar cliente');
        }
    };

    // Format CPF/CNPJ
    const formatCpfCnpj = (value?: string) => {
        if (!value) return '-';
        if (value.length === 11) {
            return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    // Format phone
    const formatPhone = (value?: string) => {
        if (!value) return '-';
        return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    // Format date
    const formatDate = (value: string) => {
        return new Date(value).toLocaleDateString('pt-BR');
    };

    // Loading state
    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !customer) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error || 'Cliente não encontrado'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/customers')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                        <p className="text-sm text-slate-600">
                            Cadastrado em {formatDate(customer.created_at)}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link
                        to={`/admin/customers/${customer.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        Editar
                    </Link>
                    <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Deletar
                    </button>
                </div>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
                {customer.is_active ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Cliente Ativo
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        Cliente Inativo
                    </span>
                )}
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Informações Básicas</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            Nome / Razão Social
                        </label>
                        <p className="text-slate-900">{customer.name}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            CPF / CNPJ
                        </label>
                        <p className="text-slate-900">{formatCpfCnpj(customer.cpf_cnpj)}</p>
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Contato</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            Email
                        </label>
                        <p className="text-slate-900">{customer.email || '-'}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            Telefone
                        </label>
                        <p className="text-slate-900">{formatPhone(customer.phone)}</p>
                    </div>
                </div>
            </div>

            {/* Address */}
            {customer.address && Object.keys(customer.address).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
                    </div>

                    <div className="space-y-2">
                        <p className="text-slate-900">
                            {customer.address.street}, {customer.address.number}
                            {customer.address.complement && ` - ${customer.address.complement}`}
                        </p>
                        <p className="text-slate-900">
                            {customer.address.neighborhood}
                        </p>
                        <p className="text-slate-900">
                            {customer.address.city} - {customer.address.state}
                        </p>
                        <p className="text-slate-600 text-sm">
                            CEP: {customer.address.zipCode}
                        </p>
                    </div>
                </div>
            )}

            {/* Custom Fields */}
            {customer.custom_data && Object.keys(customer.custom_data).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Informações Adicionais</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {Object.entries(customer.custom_data).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-slate-500 mb-1 capitalize">
                                    {key.replace(/_/g, ' ')}
                                </label>
                                <p className="text-slate-900">{value || '-'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Informações do Sistema</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            Data de Cadastro
                        </label>
                        <p className="text-slate-900">{formatDate(customer.created_at)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">
                            Última Atualização
                        </label>
                        <p className="text-slate-900">{formatDate(customer.updated_at)}</p>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            Confirmar Exclusão
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Tem certeza que deseja deletar <strong>{customer.name}</strong>?
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
