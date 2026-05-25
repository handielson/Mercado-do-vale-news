import React, { useState, useEffect } from 'react';
import { User, Search, X, Calendar, ShoppingBag, ExternalLink, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { formatCpfCnpj, formatPhone, validateCpfCnpj, validateEmail } from '../../utils/cpfCnpjValidation';

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
    birth_date?: string;
}

interface CustomerSectionProps {
    selectedCustomer?: Customer;
    onSelectCustomer: (customer: Customer | undefined) => void;
}

export default function CustomerSection({
    selectedCustomer,
    onSelectCustomer
}: CustomerSectionProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Customer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState({
        name: '',
        phone: '',
        cpf_cnpj: '',
        email: '',
    });

    const onlyDigits = (value: string) => value.replace(/\D/g, '');

    // Buscar últimos 3 clientes ao carregar
    useEffect(() => {
        fetchRecentCustomers();
    }, []);

    const fetchRecentCustomers = async () => {
        try {
            const { supabase } = await import('../../services/supabase');

            // Buscar últimos 3 clientes que fizeram compras (TODO: ordenar por última compra)
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, cpf_cnpj, email, phone, birth_date')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;
            setRecentCustomers(data || []);
        } catch (error) {
            console.error('Erro ao buscar clientes recentes:', error);
        }
    };

    // Calcular dias até próximo aniversário
    const calculateDaysUntilBirthday = (birthDate: string) => {
        const today = new Date();
        const birth = new Date(birthDate);

        // Próximo aniversário
        const nextBirthday = new Date(
            today.getFullYear(),
            birth.getMonth(),
            birth.getDate()
        );

        // Se já passou este ano, pegar o próximo ano
        if (nextBirthday < today) {
            nextBirthday.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = nextBirthday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    // Formatar data de aniversário
    const formatBirthDate = (birthDate: string) => {
        const date = new Date(birthDate);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    };

    // Buscar clientes
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            toast.error('Digite um nome, CPF/CNPJ, telefone ou e-mail para buscar');
            return;
        }

        setIsSearching(true);
        setShowResults(true);

        try {
            const { supabase } = await import('../../services/supabase');
            const term = searchTerm.trim().toLowerCase();
            const digits = onlyDigits(term);
            const searchTokens = new Set([term]);
            if (digits) {
                searchTokens.add(digits);
                searchTokens.add(formatPhone(digits));
                searchTokens.add(formatCpfCnpj(digits));
            }
            const orFilter = [...searchTokens]
                .filter(Boolean)
                .flatMap(token => [
                    `name.ilike.%${token}%`,
                    `cpf_cnpj.ilike.%${token}%`,
                    `phone.ilike.%${token}%`,
                    `email.ilike.%${token}%`,
                ])
                .join(',');

            const { data, error } = await supabase
                .from('customers')
                .select('id, name, cpf_cnpj, email, phone, birth_date')
                .or(orFilter)
                .eq('is_active', true)
                .order('name', { ascending: true })
                .limit(10);

            if (error) throw error;

            setSearchResults(data || []);

            if (!data || data.length === 0) {
                toast.info('Nenhum cliente encontrado');
            } else {
                toast.success(`${data.length} cliente(s) encontrado(s)`);
            }
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            toast.error('Erro ao buscar clientes');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const openQuickCreate = () => {
        const term = searchTerm.trim();
        const digits = onlyDigits(term);
        setQuickCustomer(current => ({
            ...current,
            phone: digits.length >= 8 && digits.length <= 11 ? formatPhone(term) : current.phone,
            cpf_cnpj: digits.length === 14 ? formatCpfCnpj(term) : current.cpf_cnpj,
            email: term.includes('@') ? term : current.email,
        }));
        setShowQuickCreate(true);
        setShowResults(false);
    };

    const handleQuickCustomerField = (field: keyof typeof quickCustomer, value: string) => {
        const nextValue =
            field === 'phone' ? formatPhone(value)
                : field === 'cpf_cnpj' ? formatCpfCnpj(value)
                    : value;
        setQuickCustomer(current => ({ ...current, [field]: nextValue }));
    };

    const handleCreateCustomer = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = quickCustomer.name.trim();
        const cpfCnpj = quickCustomer.cpf_cnpj.trim();
        const phone = quickCustomer.phone.trim();
        const email = quickCustomer.email.trim();

        if (!name) {
            toast.error('Informe o nome do cliente');
            return;
        }

        if (cpfCnpj && !validateCpfCnpj(cpfCnpj)) {
            toast.error('CPF/CNPJ invalido');
            return;
        }

        if (email && !validateEmail(email)) {
            toast.error('E-mail invalido');
            return;
        }

        try {
            setIsCreatingCustomer(true);
            const created = await customerService.create({
                name,
                cpf_cnpj: cpfCnpj || undefined,
                phone: phone || undefined,
                email: email || undefined,
                customer_type: 'retail',
                is_active: true,
            });

            handleSelectCustomer(created);
            setQuickCustomer({ name: '', phone: '', cpf_cnpj: '', email: '' });
            setShowQuickCreate(false);
            fetchRecentCustomers();
            toast.success('Cliente cadastrado e selecionado');
        } catch (error: any) {
            console.error('Erro ao cadastrar cliente no PDV:', error);
            if (error.message?.includes('duplicate key') || error.code === '23505') {
                toast.error('Cliente ja cadastrado com este CPF/CNPJ');
            } else {
                toast.error(error.message || 'Erro ao cadastrar cliente');
            }
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    // Selecionar cliente
    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer);
        setShowResults(false);
        setSearchTerm('');
        setSearchResults([]);
        toast.success(`Cliente ${customer.name} selecionado`);
    };

    // Remover seleção
    const handleRemoveCustomer = () => {
        onSelectCustomer(undefined);
        toast.info('Cliente removido');
    };

    // Enter para buscar
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <User size={20} />
                    Cliente
                    <span className="text-red-600 text-sm">*</span>
                </h3>

                {/* Acesso Rápido - 3 últimos clientes */}
                {!selectedCustomer && recentCustomers.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-2">
                        {recentCustomers.map((customer) => (
                            <button
                                key={customer.id}
                                onClick={() => handleSelectCustomer(customer)}
                                className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
                                title={`Selecionar ${customer.name}`}
                            >
                                {customer.name.split(' ')[0]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Cliente Selecionado */}
            {selectedCustomer ? (
                <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                        {selectedCustomer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-800">{selectedCustomer.name}</h4>
                                        {selectedCustomer.cpf_cnpj && (
                                            <p className="text-sm text-slate-600">CPF/CNPJ: {selectedCustomer.cpf_cnpj}</p>
                                        )}
                                        {selectedCustomer.phone && (
                                            <p className="text-sm text-slate-600">Tel: {selectedCustomer.phone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleRemoveCustomer}
                                className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Remover cliente"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Informações Adicionais do Cliente */}
                    <div className="grid grid-cols-1 gap-3">
                        {/* Aniversário */}
                        {selectedCustomer.birth_date && (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="flex items-center gap-2 text-purple-700">
                                    <Calendar size={16} />
                                    <span className="text-sm font-medium">
                                        Aniversário: {formatBirthDate(selectedCustomer.birth_date)}
                                    </span>
                                    <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full">
                                        {calculateDaysUntilBirthday(selectedCustomer.birth_date)} dias
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Resumo de Compras (TODO: implementar busca real) */}
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-green-700">
                                    <ShoppingBag size={16} />
                                    <div className="text-sm">
                                        <span className="font-medium">Compras: </span>
                                        <span className="font-bold">-</span>
                                        <span className="mx-2">|</span>
                                        <span className="font-medium">Total: </span>
                                        <span className="font-bold">R$ -</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toast.info('Funcionalidade em desenvolvimento')}
                                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition-colors"
                                    title="Ver histórico de compras"
                                >
                                    Histórico
                                    <ExternalLink size={12} />
                                </button>
                            </div>
                            <p className="text-xs text-green-600 mt-1 italic">
                                💡 Funcionalidade em desenvolvimento
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Busca de Cliente */}
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Nome, CPF/CNPJ, telefone ou e-mail..."
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <Search size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={openQuickCreate}
                                className="px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                                title="Cadastrar novo cliente"
                            >
                                <UserPlus size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-red-600">
                            ⚠️ Selecionar um cliente é obrigatório para finalizar a venda
                        </p>

                        {showQuickCreate && (
                            <form onSubmit={handleCreateCustomer} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <UserPlus size={18} className="text-emerald-700" />
                                        Novo cliente
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickCreate(false)}
                                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white rounded"
                                        title="Fechar cadastro"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="space-y-1 md:col-span-2">
                                        <span className="text-xs font-medium text-slate-600">Nome *</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.name}
                                            onChange={(e) => handleQuickCustomerField('name', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Nome completo"
                                            autoFocus
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">Telefone</span>
                                        <input
                                            type="tel"
                                            inputMode="tel"
                                            value={quickCustomer.phone}
                                            onChange={(e) => handleQuickCustomerField('phone', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="(87) 99999-9999"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">CPF/CNPJ</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={quickCustomer.cpf_cnpj}
                                            onChange={(e) => handleQuickCustomerField('cpf_cnpj', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Opcional"
                                        />
                                    </label>

                                    <label className="space-y-1 md:col-span-2">
                                        <span className="text-xs font-medium text-slate-600">E-mail</span>
                                        <input
                                            type="email"
                                            value={quickCustomer.email}
                                            onChange={(e) => handleQuickCustomerField('email', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Opcional"
                                        />
                                    </label>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickCreate(false)}
                                        className="px-3 py-2 text-sm text-slate-700 hover:bg-white rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreatingCustomer}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isCreatingCustomer ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                        Cadastrar e selecionar
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Resultados da Busca */}
                        {showResults && (
                            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                                {isSearching ? (
                                    <div className="p-4 text-center text-slate-500">
                                        Buscando clientes...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-4 text-center text-slate-500 space-y-3">
                                        <p>Nenhum cliente encontrado</p>
                                        <button
                                            type="button"
                                            onClick={openQuickCreate}
                                            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                        >
                                            <UserPlus size={16} />
                                            Cadastrar novo cliente
                                        </button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {searchResults.map((customer) => (
                                            <button
                                                key={customer.id}
                                                onClick={() => handleSelectCustomer(customer)}
                                                className="w-full p-3 text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <h4 className="font-medium text-slate-800">{customer.name}</h4>
                                                {customer.cpf_cnpj && (
                                                    <p className="text-sm text-slate-600">CPF/CNPJ: {customer.cpf_cnpj}</p>
                                                )}
                                                {customer.phone && (
                                                    <p className="text-sm text-slate-600">Tel: {customer.phone}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
