import React, { useState, useEffect } from 'react';
import { Loader2, Store, Truck, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryType } from '../../types/sale';
import { teamService } from '../../services/team';
import { TeamMemberInput } from '../../types/team';
import { formatCpfCnpj, formatPhone, validateCpfCnpj } from '../../utils/cpfCnpjValidation';
import { capitalizeName } from '../../utils/customerFormUtils';

interface DeliveryPerson {
    id: string;
    name: string;
}

interface DeliverySectionProps {
    deliveryType: DeliveryType | undefined;
    deliveryPersonId: string | undefined;
    deliveryCostStore: number; // em centavos
    deliveryCostCustomer: number; // em centavos
    deliveryPersons: DeliveryPerson[];
    onDeliveryChange: (
        type: DeliveryType | undefined,
        personId: string | undefined,
        costStore: number,
        costCustomer: number
    ) => void;
    onDeliveryPersonCreated?: (person: DeliveryPerson) => void;
}

const DELIVERY_COST_DEFAULT = 3000; // R$ 30,00 em centavos

const emptyDeliveryPerson = (): TeamMemberInput => ({
    name: '',
    cpf_cnpj: '',
    role: 'delivery',
    employment_type: 'freelancer',
    hire_date: '',
    phone: '',
    pix_key_type: 'phone',
    pix_key: '',
    bank_name: '',
    delivery_fee: 30,
    is_active: true,
    admin_notes: '',
});

export const DeliverySection: React.FC<DeliverySectionProps> = ({
    deliveryType,
    deliveryPersonId,
    deliveryCostStore,
    deliveryCostCustomer,
    deliveryPersons,
    onDeliveryChange,
    onDeliveryPersonCreated
}) => {
    const [selectedType, setSelectedType] = useState<DeliveryType | undefined>(deliveryType);
    const [selectedPerson, setSelectedPerson] = useState<string | undefined>(deliveryPersonId);
    const [costStore, setCostStore] = useState(deliveryCostStore);
    const [costCustomer, setCostCustomer] = useState(deliveryCostCustomer);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [isCreatingPerson, setIsCreatingPerson] = useState(false);
    const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');
    const [quickPerson, setQuickPerson] = useState<TeamMemberInput>(emptyDeliveryPerson());

    useEffect(() => {
        setSelectedType(deliveryType);
        setSelectedPerson(deliveryPersonId);
        setCostStore(deliveryCostStore);
        setCostCustomer(deliveryCostCustomer);
    }, [deliveryType, deliveryPersonId, deliveryCostStore, deliveryCostCustomer]);

    // Atualizar quando tipo de entrega mudar
    useEffect(() => {
        if (selectedType === 'store_pickup') {
            // Retirada: sem custo, sem entregador
            onDeliveryChange(selectedType, undefined, 0, 0);
        } else if (selectedType === 'store_delivery') {
            // Entrega loja: custo da loja pode ser ajustado no PDV, cliente nao paga entrega.
            onDeliveryChange(selectedType, selectedPerson, costStore, 0);
        } else if (selectedType === 'hybrid_delivery') {
            // Híbrida: valores customizados
            onDeliveryChange(selectedType, selectedPerson, costStore, costCustomer);
        } else {
            // Nenhum tipo selecionado
            onDeliveryChange(undefined, undefined, 0, 0);
        }
    }, [selectedType, selectedPerson, costStore, costCustomer]);

    const handleTypeChange = (type: DeliveryType) => {
        setSelectedType(type);

        // Resetar valores baseado no tipo
        if (type === 'store_pickup') {
            setSelectedPerson(undefined);
            setCostStore(0);
            setCostCustomer(0);
        } else if (type === 'store_delivery') {
            setCostStore(DELIVERY_COST_DEFAULT);
            setCostCustomer(0);
        } else if (type === 'hybrid_delivery') {
            // Valores padrão: metade cada
            setCostStore(DELIVERY_COST_DEFAULT / 2);
            setCostCustomer(DELIVERY_COST_DEFAULT / 2);
        }
    };

    const handleQuickField = (field: keyof TeamMemberInput, value: string | number) => {
        const nextValue =
            field === 'name' && typeof value === 'string' ? capitalizeName(value)
                : field === 'phone' && typeof value === 'string' ? value.replace(/[^\d\s()-]/g, '')
                    : field === 'cpf_cnpj' && typeof value === 'string' ? value.replace(/[^\d./-]/g, '')
                        : value;
        setQuickPerson(current => ({ ...current, [field]: nextValue }));
    };

    const handleDocumentBlur = (value: string) => {
        if (!value) return;
        const cleaned = value.replace(/\D/g, '');
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
            return;
        }
        setQuickPerson(current => ({ ...current, cpf_cnpj: formatCpfCnpj(value) }));
    };

    const handlePhoneBlur = (value: string) => {
        const phone = formatPhone(value);
        setQuickPerson(current => ({
            ...current,
            phone,
            pix_key: current.pix_key_type === 'phone' && !current.pix_key ? phone : current.pix_key,
        }));
    };

    const handleCreateDeliveryPerson = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = quickPerson.name.trim();
        const cpfCnpj = quickPerson.cpf_cnpj.trim();

        if (!name) {
            toast.error('Informe o nome do entregador');
            return;
        }
        if (!cpfCnpj) {
            toast.error(`Informe o ${documentType} do entregador`);
            return;
        }
        const cleanedDocument = cpfCnpj.replace(/\D/g, '');
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

        try {
            setIsCreatingPerson(true);
            const created = await teamService.createDeliveryFromPdv({
                ...quickPerson,
                name,
                cpf_cnpj: formatCpfCnpj(cpfCnpj),
                role: 'delivery',
                employment_type: quickPerson.employment_type || 'freelancer',
                hire_date: quickPerson.hire_date || new Date().toISOString().slice(0, 10),
                phone: quickPerson.phone || undefined,
                pix_key: quickPerson.pix_key || undefined,
                bank_name: quickPerson.bank_name || undefined,
                delivery_fee: quickPerson.delivery_fee || undefined,
                admin_notes: quickPerson.admin_notes || undefined,
                is_active: true,
            });

            const person = { id: created.id, name: created.name };
            onDeliveryPersonCreated?.(person);
            setSelectedPerson(created.id);
            setQuickPerson(emptyDeliveryPerson());
            setDocumentType('CPF');
            setShowQuickCreate(false);
            toast.success('Entregador cadastrado e selecionado');
        } catch (error: any) {
            console.error('Erro ao cadastrar entregador no PDV:', error);
            if (error.message?.includes('duplicate key') || error.code === '23505') {
                toast.error('Entregador ja cadastrado com este CPF/CNPJ');
            } else {
                toast.error(error.message || 'Erro ao cadastrar entregador');
            }
        } finally {
            setIsCreatingPerson(false);
        }
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(cents / 100);
    };

    const needsDeliveryPerson = selectedType === 'store_delivery' || selectedType === 'hybrid_delivery';

    return (
        <div className="delivery-section bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Modalidade de Entrega
            </h3>

            {/* Radio buttons para tipo de entrega */}
            <div className="space-y-3 mb-4">
                {/* Retirada na loja */}
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                        type="radio"
                        name="deliveryType"
                        checked={selectedType === 'store_pickup'}
                        onChange={() => handleTypeChange('store_pickup')}
                        className="w-4 h-4"
                    />
                    <Store className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                        <div className="font-medium">Retirada na Loja</div>
                        <div className="text-sm text-gray-600">Sem custo de entrega</div>
                    </div>
                </label>

                {/* Entrega pela loja */}
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                        type="radio"
                        name="deliveryType"
                        checked={selectedType === 'store_delivery'}
                        onChange={() => handleTypeChange('store_delivery')}
                        className="w-4 h-4"
                    />
                    <Truck className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                        <div className="font-medium">Entrega pela Loja</div>
                        <div className="text-sm text-gray-600">
                            Custo: {formatCurrency(DELIVERY_COST_DEFAULT)} (desconto integral para cliente)
                        </div>
                    </div>
                </label>

                {/* Entrega híbrida */}
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                        type="radio"
                        name="deliveryType"
                        checked={selectedType === 'hybrid_delivery'}
                        onChange={() => handleTypeChange('hybrid_delivery')}
                        className="w-4 h-4"
                    />
                    <Users className="w-5 h-5 text-orange-600" />
                    <div className="flex-1">
                        <div className="font-medium">Entrega Híbrida</div>
                        <div className="text-sm text-gray-600">Custo dividido entre loja e cliente</div>
                    </div>
                </label>
            </div>

            {/* Seleção de entregador (quando necessário) */}
            {needsDeliveryPerson && (
                <div className="mb-4 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Entregador *
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedPerson || ''}
                                onChange={(e) => setSelectedPerson(e.target.value || undefined)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            >
                                <option value="">Selecione um entregador</option>
                                {deliveryPersons.map(person => (
                                    <option key={person.id} value={person.id}>
                                        {person.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowQuickCreate(true)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                                title="Cadastrar novo entregador"
                            >
                                <UserPlus size={18} />
                            </button>
                        </div>
                    </div>

                    {showQuickCreate && (
                        <form onSubmit={handleCreateDeliveryPerson} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <UserPlus size={18} />
                                    Novo entregador
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowQuickCreate(false)}
                                    className="p-1 text-slate-500 hover:text-slate-700 hover:bg-white rounded"
                                    title="Fechar cadastro"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-medium text-slate-600">Nome Completo *</span>
                                    <input
                                        type="text"
                                        value={quickPerson.name}
                                        onChange={(e) => handleQuickField('name', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="Nome do entregador"
                                        required
                                    />
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-medium text-slate-600">Tipo de Documento</span>
                                    <select
                                        value={documentType}
                                        onChange={(e) => {
                                            setDocumentType(e.target.value as 'CPF' | 'CNPJ');
                                            handleQuickField('cpf_cnpj', '');
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
                                        value={quickPerson.cpf_cnpj}
                                        onChange={(e) => handleQuickField('cpf_cnpj', e.target.value)}
                                        onBlur={(e) => handleDocumentBlur(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                        maxLength={documentType === 'CPF' ? 14 : 18}
                                        required
                                    />
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-medium text-slate-600">Telefone</span>
                                    <input
                                        type="tel"
                                        value={quickPerson.phone || ''}
                                        onChange={(e) => handleQuickField('phone', e.target.value)}
                                        onBlur={(e) => handlePhoneBlur(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="(87) 99999-9999"
                                        maxLength={15}
                                    />
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-medium text-slate-600">Valor por Entrega (R$)</span>
                                    <input
                                        type="number"
                                        value={quickPerson.delivery_fee || ''}
                                        onChange={(e) => handleQuickField('delivery_fee', e.target.value ? parseFloat(e.target.value) : 0)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="30,00"
                                        min="0"
                                        step="0.01"
                                    />
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-medium text-slate-600">Tipo de Chave PIX</span>
                                    <select
                                        value={quickPerson.pix_key_type || 'phone'}
                                        onChange={(e) => handleQuickField('pix_key_type', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="phone">Celular</option>
                                        <option value="cpf">CPF / CNPJ</option>
                                        <option value="email">E-mail</option>
                                        <option value="random">Chave Aleatória</option>
                                    </select>
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-medium text-slate-600">Chave PIX</span>
                                    <input
                                        type="text"
                                        value={quickPerson.pix_key || ''}
                                        onChange={(e) => handleQuickField('pix_key', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="Chave PIX"
                                    />
                                </label>

                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-medium text-slate-600">Banco</span>
                                    <input
                                        type="text"
                                        value={(quickPerson as any).bank_name || ''}
                                        onChange={(e) => handleQuickField('bank_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="Ex: Nubank, Bradesco, Itaú"
                                    />
                                </label>

                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-medium text-slate-600">Observações Internas</span>
                                    <textarea
                                        value={quickPerson.admin_notes || ''}
                                        onChange={(e) => handleQuickField('admin_notes', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                                        placeholder="Notas privadas sobre o entregador..."
                                        rows={2}
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
                                    disabled={isCreatingPerson}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isCreatingPerson ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                    Cadastrar e selecionar
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Input de custo para entrega pela loja */}
            {selectedType === 'store_delivery' && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor da Entrega
                    </label>
                    <input
                        type="number"
                        value={costStore / 100}
                        onChange={(e) => setCostStore(Math.round(parseFloat(e.target.value || '0') * 100))}
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="30,00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Custo da entrega (desconto integral para o cliente)
                    </p>
                </div>
            )}

            {/* Inputs de custo (apenas para híbrida) */}
            {selectedType === 'hybrid_delivery' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custo Loja
                        </label>
                        <input
                            type="number"
                            value={costStore / 100}
                            onChange={(e) => setCostStore(Math.round(parseFloat(e.target.value || '0') * 100))}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custo Cliente
                        </label>
                        <input
                            type="number"
                            value={costCustomer / 100}
                            onChange={(e) => setCostCustomer(Math.round(parseFloat(e.target.value || '0') * 100))}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0,00"
                        />
                    </div>
                </div>
            )}

            {/* Resumo de entrega */}
            {selectedType && selectedType !== 'store_pickup' && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-gray-700">Custo loja:</span>
                            <span className="font-medium">{formatCurrency(costStore)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-700">Custo cliente:</span>
                            <span className="font-medium">{formatCurrency(costCustomer)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-blue-300">
                            <span className="font-semibold text-gray-900">Total entrega:</span>
                            <span className="font-semibold text-blue-600">
                                {formatCurrency(costStore + costCustomer)}
                            </span>
                        </div>
                        {selectedPerson && (
                            <div className="flex justify-between text-green-700">
                                <span>Crédito entregador:</span>
                                <span className="font-medium">{formatCurrency(costStore + costCustomer)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliverySection;
