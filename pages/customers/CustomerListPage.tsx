import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Filter, Edit, Trash2, Eye, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { Customer, CustomerFilters } from '../../types/customer';

/**
 * Customer List Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First: All data from Supabase
 * - Real-time updates via service cache
 * - Responsive design
 * - < 500 lines
 */
export default function CustomerListPage() {
    const navigate = useNavigate();

    // State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<CustomerFilters>({});
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Load customers
    useEffect(() => {
        loadCustomers();
    }, [filters]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await customerService.list(filters);
            setCustomers(data);
        } catch (err) {
            console.error('Error loading customers:', err);
            setError('Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    };

    // Search handler
    const handleSearch = () => {
        setFilters({ ...filters, search: searchTerm });
    };

    const handleDelete = async (id: string) => {
        try {
            await customerService.delete(id);
            toast.success('Cliente deletado com sucesso');
            setDeleteConfirm(null);
            loadCustomers();
        } catch (err) {
            console.error('Error deleting customer:', err);
            toast.error('Erro ao deletar cliente');
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

    // Filter active/inactive
    const activeCustomers = customers.filter(c => c.is_active);
    const inactiveCustomers = customers.filter(c => !c.is_active);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
                        <p className="text-sm text-slate-600">
                            {activeCustomers.length} ativos • {inactiveCustomers.length} inativos
                        </p>
                    </div>
                </div>
                <Link
                    to="/admin/customers/new"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Novo Cliente
                </Link>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Buscar por nome, CPF/CNPJ ou email..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Buscar
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                        <Filter className="w-5 h-5" />
                        Filtros
                    </button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Status
                            </label>
                            <select
                                value={filters.is_active === undefined ? 'all' : filters.is_active ? 'active' : 'inactive'}
                                onChange={(e) => setFilters({
                                    ...filters,
                                    is_active: e.target.value === 'all' ? undefined : e.target.value === 'active'
                                })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            >
                                <option value="all">Todos</option>
                                <option value="active">Ativos</option>
                                <option value="inactive">Inativos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Cadastrado Após
                            </label>
                            <input
                                type="date"
                                value={filters.created_after || ''}
                                onChange={(e) => setFilters({ ...filters, created_after: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Cadastrado Antes
                            </label>
                            <input
                                type="date"
                                value={filters.created_before || ''}
                                onChange={(e) => setFilters({ ...filters, created_before: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Carregando clientes...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && customers.length === 0 && (
                <div className="text-center py-12">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhum cliente encontrado
                    </h3>
                    <p className="text-slate-600 mb-6">
                        {searchTerm || filters.search
                            ? 'Tente ajustar os filtros de busca'
                            : 'Comece adicionando seu primeiro cliente'}
                    </p>
                    <Link
                        to="/admin/customers/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Adicionar Cliente
                    </Link>
                </div>
            )}

            {/* Customers Table */}
            {!loading && !error && customers.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                    Cliente
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                    CPF/CNPJ
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                    Contato
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {customers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                <span className="text-blue-600 font-semibold">
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{customer.name}</div>
                                                {customer.email && (
                                                    <div className="text-sm text-slate-500">{customer.email}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {formatCpfCnpj(customer.cpf_cnpj)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {formatPhone(customer.phone)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {customer.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                <UserCheck className="w-3 h-3" />
                                                Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                                                <UserX className="w-3 h-3" />
                                                Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Visualizar"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(customer.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Deletar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            Confirmar Exclusão
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Tem certeza que deseja deletar este cliente? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
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
