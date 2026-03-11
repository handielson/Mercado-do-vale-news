import React, { useState } from 'react';
import { Truck, Package, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import type { ShippingOption } from '../../types/shipping';

interface ShippingCalculatorProps {
    weight?: number;
    height?: number;
    width?: number;
    length?: number;
    orderValue?: number;
    compact?: boolean;
}

function formatPrice(price: number): string {
    if (price === 0) return 'Grátis';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cepMask(value: string): string {
    return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

const TYPE_ICON: Record<string, string> = {
    local_free: '🛵',
    local_paid: '🛵',
    national: '📦',
    carrier: '📫',
};

export function ShippingCalculator({ weight, height, width, length, orderValue, compact = false }: ShippingCalculatorProps) {
    const [cep, setCep] = useState('');
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ShippingOption[] | null>(null);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(!compact);

    async function handleCalculate() {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            setError('CEP inválido. Digite 8 dígitos.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const results = await shippingService.calculate({
                to_cep: cep,
                weight,
                height,
                width,
                length,
                order_value: orderValue,
            });
            setOptions(results.options);
            if (results.options.length === 0) setError('Não encontramos opções de frete para este CEP.');
        } catch {
            setError('Erro ao calcular frete. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            {/* Header (compact toggle) */}
            {compact ? (
                <button
                    onClick={() => setExpanded(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <span className="flex items-center gap-2">
                        <Truck size={16} className="text-blue-600" />
                        Calcular Frete
                    </span>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            ) : (
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <Truck size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Calcular Frete</span>
                </div>
            )}

            {/* Body */}
            {(!compact || expanded) && (
                <div className="p-4 space-y-3">
                    {/* CEP Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={cep}
                            onChange={e => setCep(cepMask(e.target.value))}
                            onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                            placeholder="00000-000"
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            maxLength={9}
                        />
                        <button
                            onClick={handleCalculate}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 transition-colors">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Calcular'}
                        </button>
                    </div>

                    {error && (
                        <p className="text-xs text-red-600">{error}</p>
                    )}

                    {/* Results */}
                    {options !== null && options.length > 0 && (
                        <div className="space-y-2">
                            {options.map(opt => (
                                <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${opt.isFree ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50'}`}>
                                    <span className="text-base">{TYPE_ICON[opt.type] ?? '📦'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{opt.name}</p>
                                        {opt.carrier && (
                                            <p className="text-xs text-slate-500">{opt.carrier}</p>
                                        )}
                                        <p className="text-xs text-slate-400">{opt.daysLabel}</p>
                                    </div>
                                    <span className={`text-sm font-bold flex-shrink-0 ${opt.isFree ? 'text-green-700' : 'text-slate-800'}`}>
                                        {formatPrice(opt.price)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {!weight && !height && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Package size={12} /> Dimensões do produto não informadas — cálculo pode ser estimado
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
