import React, { useState, useEffect } from 'react';
import { Truck, Store, Users } from 'lucide-react';
import { DeliveryType } from '../../types/sale';

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
}

const DELIVERY_COST_DEFAULT = 3000; // R$ 30,00 em centavos

export const DeliverySection: React.FC<DeliverySectionProps> = ({
    deliveryType,
    deliveryPersonId,
    deliveryCostStore,
    deliveryCostCustomer,
    deliveryPersons,
    onDeliveryChange
}) => {
    const [selectedType, setSelectedType] = useState<DeliveryType | undefined>(deliveryType);
    const [selectedPerson, setSelectedPerson] = useState<string | undefined>(deliveryPersonId);
    const [costStore, setCostStore] = useState(deliveryCostStore);
    const [costCustomer, setCostCustomer] = useState(deliveryCostCustomer);

    // Atualizar quando tipo de entrega mudar
    useEffect(() => {
        if (selectedType === 'store_pickup') {
            // Retirada: sem custo, sem entregador
            onDeliveryChange(selectedType, undefined, 0, 0);
        } else if (selectedType === 'store_delivery') {
            // Entrega loja: R$ 30 loja, R$ 0 cliente
            onDeliveryChange(selectedType, selectedPerson, DELIVERY_COST_DEFAULT, 0);
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
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Entregador *
                    </label>
                    <select
                        value={selectedPerson || ''}
                        onChange={(e) => setSelectedPerson(e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                    >
                        <option value="">Selecione um entregador</option>
                        {deliveryPersons.map(person => (
                            <option key={person.id} value={person.id}>
                                {person.name}
                            </option>
                        ))}
                    </select>
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
