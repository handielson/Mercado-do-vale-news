import React from 'react';
import { X, Plus, Wand2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EANInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    onSearch?: (ean: string) => void;
    label?: string;
    className?: string;
    maxEANs?: number;
}

/**
 * Gera um código EAN-13 válido e aleatório (Padrão Brasil - 789)
 */
const generateBrazilianEAN = () => {
    let ean = '789';
    for (let i = 0; i < 9; i++) {
        ean += Math.floor(Math.random() * 10).toString();
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(ean[i], 10);
        sum += i % 2 === 0 ? digit * 1 : digit * 3;
    }

    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;

    return ean + checkDigit.toString();
};

/**
 * EAN Input Component
 * Allows adding multiple EAN-13 barcodes
 * - Only numeric input allowed
 * - Max 13 digits per EAN
 * - Add/Remove functionality
 * - Visual validation feedback
 */
export const EANInput: React.FC<EANInputProps> = ({
    value = [],
    onChange,
    onSearch,
    label = 'Códigos de Barras (EAN-13)',
    className,
    maxEANs = 5
}) => {
    const handleEANChange = (index: number, newValue: string) => {
        // Only allow numbers
        const numericOnly = newValue.replace(/\D/g, '');

        // Limit to 13 digits
        const limited = numericOnly.slice(0, 13);

        const newEANs = [...value];
        newEANs[index] = limited;
        onChange(newEANs);

        // Trigger search when EAN reaches 13 digits
        if (limited.length === 13 && onSearch) {
            onSearch(limited);
        }
    };

    const handleGenerateEAN = () => {
        const newEAN = generateBrazilianEAN();
        const currentEANs = value.length > 0 ? [...value] : [''];

        // Se houver um campo vazio, preenchê-lo
        const emptyIndex = currentEANs.findIndex(e => e === '');
        if (emptyIndex !== -1) {
            handleEANChange(emptyIndex, newEAN);
        } else if (currentEANs.length < maxEANs) {
            // Se não houver campo vazio, mas puder adicionar mais um, adiciona
            const updated = [...currentEANs, newEAN];
            onChange(updated);
            if (onSearch) onSearch(newEAN);
        } else {
            // Se já atingiu o máximo, substitui o primeiro para garantir feedback
            handleEANChange(0, newEAN);
        }
    };

    const handleAddEAN = () => {
        if (value.length < maxEANs) {
            onChange([...value, '']);
        }
    };

    const handleRemoveEAN = (index: number) => {
        const newEANs = value.filter((_, i) => i !== index);
        onChange(newEANs.length > 0 ? newEANs : ['']);
    };

    // Ensure at least one input field
    const eans = value.length > 0 ? value : [''];

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <label className="text-sm font-medium text-slate-700">
                {label}
                <span className="ml-2 text-xs text-slate-400 font-mono">eans[]</span>
            </label>

            <div className="space-y-2">
                {eans.map((ean, index) => {
                    const isValid = ean.length === 13;
                    const isInvalid = ean.length > 0 && ean.length !== 13;

                    return (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={ean}
                                    onChange={(e) => handleEANChange(index, e.target.value)}
                                    placeholder="7891234567890"
                                    maxLength={13}
                                    className={cn(
                                        'w-full rounded-md border bg-white px-3 py-2 text-sm tracking-wider focus-visible:outline-none focus-visible:ring-2',
                                        isInvalid && 'border-red-300 focus-visible:ring-red-500',
                                        isValid && 'border-green-300 focus-visible:ring-green-500',
                                        !isInvalid && !isValid && 'border-slate-300 focus-visible:ring-blue-500'
                                    )}
                                />
                                <div className="flex items-center justify-between text-[10px] mt-0.5">
                                    <span className={cn(
                                        'font-medium',
                                        isValid && 'text-green-600',
                                        isInvalid && 'text-orange-600',
                                        !isValid && !isInvalid && 'text-slate-400'
                                    )}>
                                        {ean.length}/13 dígitos
                                    </span>
                                    {isValid && (
                                        <span className="text-green-600 font-medium">
                                            ✓ Válido
                                        </span>
                                    )}
                                    {isInvalid && (
                                        <span className="text-red-600 font-medium">
                                            ⚠️ Deve ter 13 dígitos
                                        </span>
                                    )}
                                </div>
                            </div>

                            {eans.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEAN(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Remover código de barras"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {eans.length < maxEANs && (
                <div className="flex items-center gap-6 mt-1">
                    <button
                        type="button"
                        onClick={handleAddEAN}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <Plus size={16} />
                        Adicionar outro código de barras
                    </button>
                    {(eans.some(e => e === '' || e.length !== 13) || eans.length > 0) && (
                        <button
                            type="button"
                            onClick={handleGenerateEAN}
                            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-2 py-0.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Gerar (ou substituir) código EAN-13 Brasil (789...)"
                        >
                            <Wand2 size={16} />
                            Gerar Novo EAN (BR)
                        </button>
                    )}
                </div>
            )}

            {eans.length >= maxEANs && (
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-500">
                        Máximo de {maxEANs} códigos de barras atingido
                    </p>
                    {eans.length > 0 && (
                        <button
                            type="button"
                            onClick={handleGenerateEAN}
                            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-2 py-0.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Substituir por código EAN-13 Brasil (789...)"
                        >
                            <Wand2 size={16} />
                            Gerar Novo EAN (BR)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
