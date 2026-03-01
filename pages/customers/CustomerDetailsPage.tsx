import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, User, Mail, Phone, MapPin, FileText, Calendar, CheckCircle, XCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { Customer } from '../../types/customer';
import CustomerPrintableView from '../../components/customers/CustomerPrintableView';
import { benefitService, BenefitStatus } from '../../services/benefitService';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

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
    const { user } = useSupabaseAuth();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [benefits, setBenefits] = useState<BenefitStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Load customer
    useEffect(() => {
        if (id) {
            loadCustomer(id);
            loadBenefits(id);
        }
    }, [id]);

    const loadBenefits = async (customerId: string) => {
        try {
            const data = await benefitService.getCustomerBenefitsStatus(customerId);
            setBenefits(data);
        } catch (err) {
            console.error('Error loading benefits:', err);
        }
    };

    const handleRedeem = async (benefitId: string) => {
        if (!user) return;
        try {
            toast.loading('Registrando resgate...', { id: 'redeem' });
            await benefitService.redeemScreenProtector(benefitId, user.id);
            toast.success('Película resgatada com sucesso!', { id: 'redeem' });
            if (id) loadBenefits(id);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao resgatar', { id: 'redeem' });
        }
    };

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

    const handleDelete = async () => {
        if (!id) return;

        try {
            await customerService.delete(id);
            toast.success('Cliente deletado com sucesso');
            navigate('/admin/customers');
        } catch (err) {
            console.error('Error deleting customer:', err);
            toast.error('Erro ao deletar cliente');
        }
    };

    // Print handler
    const handlePrint = () => {
        window.print();
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
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-print"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir Ficha
                    </button>
                    <Link
                        to={`/admin/customers/${customer.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors no-print"
                    >
                        <Edit className="w-4 h-4" />
                        Editar
                    </Link>
                    <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors no-print"
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

            {/* Benefícios Ativos */}
            {benefits.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-slate-900">Benefícios Ativos</h2>
                    </div>

                    <div className="space-y-6">
                        {benefits.map(b => (
                            <div key={b.benefit.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">1 Ano de Película Grátis</h3>
                                        <p className="text-sm text-slate-500">Adquirido em: {new Date(b.benefit.granted_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-blue-600">{b.monthsRemaining}/12</div>
                                        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Meses Restantes</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="text-sm font-medium text-slate-700">Status do Mês Atual</div>
                                    {b.canRedeemThisMonth ? (
                                        <button
                                            onClick={() => handleRedeem(b.benefit.id)}
                                            className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-bold shadow-md hover:bg-blue-700 transition"
                                        >
                                            Autorizar Resgate Agora
                                        </button>
                                    ) : (
                                        <span className="text-sm font-bold text-slate-400">
                                            {b.redemptions.some(r => r.year_month === b.currentYearMonth)
                                                ? 'Resgate do mês já utilizado'
                                                : (b.monthsRemaining === 0 ? 'Expirado' : 'Não disponível')}
                                        </span>
                                    )}
                                </div>

                                {b.redemptions.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Histórico de Uso</h4>
                                        <ul className="space-y-2">
                                            {b.redemptions.map(r => (
                                                <li key={r.id} className="flex justify-between text-xs py-1.5 border-b border-slate-200/50 last:border-0 text-slate-600">
                                                    <span>Resgatado em {new Date(r.redeemed_at).toLocaleDateString('pt-BR')}</span>
                                                    <span>Por: {r.redeemed_by_user?.name || 'Admin'} ({r.year_month})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
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

            {/* Print View - Hidden, only shown when printing */}
            <CustomerPrintableView customer={customer} showAdminNotes={true} />
        </div>
    );
}
