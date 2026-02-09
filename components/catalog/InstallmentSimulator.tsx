import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import { formatPrice } from '@/services/installmentCalculator';

interface InstallmentSimulatorProps {
    plans: InstallmentPlan[];
    selected: InstallmentPlan;
    onSelect: (plan: InstallmentPlan) => void;
}

export function InstallmentSimulator({
    plans,
    selected,
    onSelect
}: InstallmentSimulatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Show only highlighted plans when collapsed
    const visiblePlans = isExpanded
        ? plans
        : plans.filter(p => p.highlighted || p.installments === selected.installments);

    return (
        <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
                Forma de Pagamento
            </label>

            <div className="space-y-2">
                {visiblePlans.map((plan) => {
                    const isSelected = plan.installments === selected.installments;
                    const isPix = plan.label.includes('PIX');

                    return (
                        <button
                            key={plan.installments}
                            onClick={() => onSelect(plan)}
                            className={`
                                w-full p-4 rounded-lg border-2 text-left
                                transition-all duration-200
                                ${isSelected
                                    ? isPix
                                        ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md'
                                        : 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`
                                            font-bold text-lg
                                            ${isSelected
                                                ? isPix ? 'text-green-700' : 'text-blue-700'
                                                : 'text-slate-800'
                                            }
                                        `}>
                                            {plan.label}
                                        </span>
                                        {plan.highlighted && !isSelected && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                                                Popular
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-1 space-y-0.5">
                                        {plan.installments > 1 ? (
                                            <>
                                                <p className="text-sm text-slate-600">
                                                    {plan.installments}x de {formatPrice(plan.value)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Total: {formatPrice(plan.total)}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-sm text-slate-600">
                                                {formatPrice(plan.total)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {isSelected && (
                                    <Check className={`
                                        w-6 h-6 flex-shrink-0
                                        ${isPix ? 'text-green-600' : 'text-blue-600'}
                                    `} />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Expand/Collapse Button */}
            {plans.length > visiblePlans.length && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            Mostrar menos opções
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            Ver todas as opções de parcelamento
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
