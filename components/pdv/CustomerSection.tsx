import React, { useState } from 'react';
import { User, Search, X } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
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

    // Buscar clientes
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            toast.error('Digite um nome ou CPF para buscar');
            return;
        }

        setIsSearching(true);
        setShowResults(true);

        try {
            // TODO: Implementar busca real com Supabase
            // Buscar por: name, cpf_cnpj

            // Simulação temporária
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock de resultados
            const mockResults: Customer[] = [];
            setSearchResults(mockResults);

            if (mockResults.length === 0) {
                toast.info('Nenhum cliente encontrado');
            }
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            toast.error('Erro ao buscar clientes');
        } finally {
            setIsSearching(false);
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
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <User size={20} />
                Cliente
                <span className="text-red-600 text-sm">*</span>
            </h3>

            {/* Cliente Selecionado */}
            {selectedCustomer ? (
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
                                placeholder="Nome ou CPF/CNPJ do cliente..."
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <Search size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-red-600">
                            ⚠️ Selecionar um cliente é obrigatório para finalizar a venda
                        </p>

                        {/* Resultados da Busca */}
                        {showResults && (
                            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                                {isSearching ? (
                                    <div className="p-4 text-center text-slate-500">
                                        Buscando clientes...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-4 text-center text-slate-500">
                                        Nenhum cliente encontrado
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
