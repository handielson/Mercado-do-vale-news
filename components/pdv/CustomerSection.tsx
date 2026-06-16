import React, { useState, useEffect } from 'react';
import { User, Search, X, Calendar, ShoppingBag, ExternalLink, UserPlus, Loader2, MapPin, FileText, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { formatCpfCnpj, formatPhone, validateCpfCnpj, validateEmail } from '../../utils/cpfCnpjValidation';
import { capitalizeName, formatCep, searchCep as searchCepUtil } from '../../utils/customerFormUtils';
import { CustomerAddress, CustomerInput } from '../../types/customer';

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
    birth_date?: string;
    is_walk_in_customer?: boolean;
}

interface CustomerSectionProps {
    selectedCustomer?: Customer;
    onSelectCustomer: (customer: Customer | undefined) => void;
    onSelectWalkInCustomer?: () => void | Promise<void>;
    isSelectingWalkInCustomer?: boolean;
}

export default function CustomerSection({
    selectedCustomer,
    onSelectCustomer,
    onSelectWalkInCustomer,
    isSelectingWalkInCustomer = false
}: CustomerSectionProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Customer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState<CustomerInput>({
        name: '',
        phone: '',
        cpf_cnpj: '',
        email: '',
        birth_date: '',
        customer_type: 'retail',
        instagram: '',
        facebook: '',
        address: {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: '',
        },
        admin_notes: '',
        custom_data: {},
        is_active: true,
    });
    const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');

    const onlyDigits = (value: string) => value.replace(/\D/g, '');

    const emptyQuickCustomer = (): CustomerInput => ({
        name: '',
        phone: '',
        cpf_cnpj: '',
        email: '',
        birth_date: '',
        customer_type: 'retail',
        instagram: '',
        facebook: '',
        address: {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: '',
        },
        admin_notes: '',
        custom_data: {},
        is_active: true,
    });

    // Buscar últimos 3 clientes ao carregar
    useEffect(() => {
        fetchRecentCustomers();
    }, []);

    const fetchRecentCustomers = async () => {
        try {
            const data = await customerService.list({ is_active: true });
            // Buscar últimos 3 clientes que fizeram compras (TODO: ordenar por última compra)
            setRecentCustomers(data.slice(0, 3));
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
            const term = searchTerm.trim().toLowerCase();
            const data = (await customerService.list({ search: term, is_active: true }))
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                .slice(0, 10);

            setSearchResults(data);

            if (data.length === 0) {
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
        if (digits.length === 11) setDocumentType('CPF');
        if (digits.length === 14) setDocumentType('CNPJ');
        setQuickCustomer(current => ({
            ...current,
            phone: digits.length >= 8 && digits.length <= 11 ? formatPhone(term) : current.phone,
            cpf_cnpj: digits.length === 11 || digits.length === 14 ? formatCpfCnpj(term) : current.cpf_cnpj,
            email: term.includes('@') ? term : current.email,
        }));
        setShowQuickCreate(true);
        setShowResults(false);
    };

    const handleQuickCustomerField = (field: keyof CustomerInput, value: string | boolean) => {
        const nextValue =
            field === 'phone' && typeof value === 'string' ? value.replace(/[^\d\s()-]/g, '')
                : field === 'cpf_cnpj' && typeof value === 'string' ? value.replace(/[^\d./-]/g, '')
                    : field === 'name' && typeof value === 'string' ? capitalizeName(value)
                    : value;
        setQuickCustomer(current => ({ ...current, [field]: nextValue }));
    };

    const handleQuickCustomerBlur = (field: keyof CustomerInput, value: string) => {
        if (field === 'phone') {
            setQuickCustomer(current => ({ ...current, phone: formatPhone(value) }));
            return;
        }

        if (field === 'cpf_cnpj') {
            if (!value) return;
            const formatted = formatCpfCnpj(value);
            const cleaned = onlyDigits(value);
            setQuickCustomer(current => ({ ...current, cpf_cnpj: formatted }));

            if (documentType === 'CPF' && cleaned.length !== 11) {
                toast.error('CPF deve ter 11 digitos');
                return;
            }
            if (documentType === 'CNPJ' && cleaned.length !== 14) {
                toast.error('CNPJ deve ter 14 digitos');
                return;
            }
            if (!validateCpfCnpj(value)) {
                toast.error(`${documentType} invalido`);
            }
        }
    };

    const handleQuickAddressField = (field: keyof CustomerAddress, value: string) => {
        const nextValue =
            field === 'zipCode' ? formatCep(value)
                : field === 'state' ? value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
                    : value;
        setQuickCustomer(current => ({
            ...current,
            address: {
                ...(current.address || {}),
                [field]: nextValue,
            },
        }));
    };

    const searchQuickCep = async (cep: string) => {
        const result = await searchCepUtil(cep);
        if (result) {
            setQuickCustomer(current => ({
                ...current,
                address: {
                    ...(current.address || {}),
                    ...result,
                },
            }));
        } else if (onlyDigits(cep).length === 8) {
            toast.error('Erro ao buscar CEP');
        }
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

        if (!cpfCnpj) {
            toast.error(`Informe o ${documentType}`);
            return;
        }

        const cleanedDocument = onlyDigits(cpfCnpj);
        if (documentType === 'CPF' && cleanedDocument.length !== 11) {
            toast.error('CPF deve ter 11 digitos');
            return;
        }

        if (documentType === 'CNPJ' && cleanedDocument.length !== 14) {
            toast.error('CNPJ deve ter 14 digitos');
            return;
        }

        if (!validateCpfCnpj(cpfCnpj)) {
            toast.error(`${documentType} invalido`);
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
                birth_date: quickCustomer.birth_date || undefined,
                customer_type: quickCustomer.customer_type || 'retail',
                instagram: quickCustomer.instagram || undefined,
                facebook: quickCustomer.facebook || undefined,
                address: quickCustomer.address,
                admin_notes: quickCustomer.admin_notes || undefined,
                custom_data: quickCustomer.custom_data || {},
                is_active: true,
            });

            handleSelectCustomer(created, { showToast: false });
            setQuickCustomer(emptyQuickCustomer());
            setDocumentType('CPF');
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
    const handleSelectCustomer = (customer: Customer, options: { showToast?: boolean } = {}) => {
        onSelectCustomer(customer);
        setShowResults(false);
        setSearchTerm('');
        setSearchResults([]);
        if (options.showToast !== false) {
            toast.success(`Cliente ${customer.name} selecionado`);
        }
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
                                        {selectedCustomer.is_walk_in_customer && (
                                            <p className="text-sm text-amber-700 font-medium">Venda rápida sem cadastro</p>
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
                            {onSelectWalkInCustomer && (
                                <button
                                    type="button"
                                    onClick={onSelectWalkInCustomer}
                                    disabled={isSelectingWalkInCustomer}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                                    title="Venda rápida para Cliente Balcão"
                                >
                                    {isSelectingWalkInCustomer ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                    <span className="hidden sm:inline text-sm font-medium">Venda rápida</span>
                                </button>
                            )}
                        </div>

                        <p className="text-xs text-red-600">
                            ⚠️ Selecionar um cliente é obrigatório para finalizar a venda
                        </p>

                        {showQuickCreate && (
                            <form onSubmit={handleCreateCustomer} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-5">
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

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <User size={16} />
                                        Dados básicos
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs font-medium text-slate-600">
                                                {documentType === 'CPF' ? 'Nome Completo' : 'Razão Social'} *
                                            </span>
                                            <input
                                                type="text"
                                                value={quickCustomer.name}
                                                onChange={(e) => handleQuickCustomerField('name', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder={documentType === 'CPF' ? 'Nome completo' : 'Razão social'}
                                                autoFocus
                                                required
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Data de Nascimento</span>
                                            <input
                                                type="date"
                                                value={quickCustomer.birth_date || ''}
                                                onChange={(e) => handleQuickCustomerField('birth_date', e.target.value)}
                                                max="9999-12-31"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Tipo de Cliente</span>
                                            <select
                                                value={quickCustomer.customer_type || 'retail'}
                                                onChange={(e) => handleQuickCustomerField('customer_type', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            >
                                                <option value="retail">Varejo</option>
                                                <option value="resale">Revenda</option>
                                                <option value="wholesale">Atacado</option>
                                            </select>
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Tipo de Documento</span>
                                            <select
                                                value={documentType}
                                                onChange={(e) => {
                                                    setDocumentType(e.target.value as 'CPF' | 'CNPJ');
                                                    handleQuickCustomerField('cpf_cnpj', '');
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            >
                                                <option value="CPF">CPF</option>
                                                <option value="CNPJ">CNPJ</option>
                                            </select>
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">{documentType} *</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={quickCustomer.cpf_cnpj || ''}
                                                onChange={(e) => handleQuickCustomerField('cpf_cnpj', e.target.value)}
                                                onBlur={(e) => handleQuickCustomerBlur('cpf_cnpj', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                                maxLength={documentType === 'CPF' ? 14 : 18}
                                                required
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Status</span>
                                            <select
                                                value={quickCustomer.is_active === false ? 'inactive' : 'active'}
                                                onChange={(e) => handleQuickCustomerField('is_active', e.target.value === 'active')}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            >
                                                <option value="active">Ativo</option>
                                                <option value="inactive">Inativo</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <Search size={16} />
                                        Contato
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Telefone</span>
                                            <input
                                                type="tel"
                                                inputMode="tel"
                                                value={quickCustomer.phone || ''}
                                                onChange={(e) => handleQuickCustomerField('phone', e.target.value)}
                                                onBlur={(e) => handleQuickCustomerBlur('phone', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="(87) 99999-9999"
                                                maxLength={15}
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">E-mail</span>
                                            <input
                                                type="email"
                                                value={quickCustomer.email || ''}
                                                onChange={(e) => handleQuickCustomerField('email', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="email@exemplo.com"
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Instagram</span>
                                            <input
                                                type="text"
                                                value={quickCustomer.instagram || ''}
                                                onChange={(e) => handleQuickCustomerField('instagram', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="@usuario ou usuario"
                                            />
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-slate-600">Facebook</span>
                                            <input
                                                type="text"
                                                value={quickCustomer.facebook || ''}
                                                onChange={(e) => handleQuickCustomerField('facebook', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="@usuario ou usuario"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                                        <MapPin size={16} />
                                        Endereço
                                    </div>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">CEP</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={quickCustomer.address?.zipCode || ''}
                                            onChange={(e) => handleQuickAddressField('zipCode', e.target.value)}
                                            onBlur={(e) => searchQuickCep(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="00000-000"
                                            maxLength={9}
                                        />
                                    </label>

                                    <label className="space-y-1 md:col-span-1">
                                        <span className="text-xs font-medium text-slate-600">Rua</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.street || ''}
                                            onChange={(e) => handleQuickAddressField('street', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Nome da rua"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">Número</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.number || ''}
                                            onChange={(e) => handleQuickAddressField('number', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="123"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">Complemento</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.complement || ''}
                                            onChange={(e) => handleQuickAddressField('complement', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Apto, bloco, etc"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">Bairro</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.neighborhood || ''}
                                            onChange={(e) => handleQuickAddressField('neighborhood', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Nome do bairro"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">Cidade</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.city || ''}
                                            onChange={(e) => handleQuickAddressField('city', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="Nome da cidade"
                                        />
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-xs font-medium text-slate-600">UF</span>
                                        <input
                                            type="text"
                                            value={quickCustomer.address?.state || ''}
                                            onChange={(e) => handleQuickAddressField('state', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                                            placeholder="UF"
                                            maxLength={2}
                                        />
                                    </label>
                                </div>

                                <label className="space-y-1 block">
                                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                        <FileText size={14} />
                                        Observações Internas
                                    </span>
                                    <textarea
                                        value={quickCustomer.admin_notes || ''}
                                        onChange={(e) => handleQuickCustomerField('admin_notes', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                                        placeholder="Notas privadas para uso interno..."
                                        rows={3}
                                    />
                                </label>

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
