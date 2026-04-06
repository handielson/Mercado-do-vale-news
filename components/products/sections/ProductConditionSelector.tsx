import React from 'react';
import { Package } from 'lucide-react';

interface ProductConditionSelectorProps {
    value: 'NOVO' | 'USADO';
    onChange: (condition: 'NOVO' | 'USADO') => void;
}

/**
 * ProductConditionSelector Component
 * Card-based selector for product condition (NEW vs USED)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Visual card selection (not radio buttons)
 * - Clear distinction between NEW and USED
 * - Affects image gallery behavior
 */
export function ProductConditionSelector({ value, onChange }: ProductConditionSelectorProps) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-blue-600" />
                Situação do Produto
            </h3>

            <div className="grid grid-cols-2 gap-4">
                {/* NOVO Card */}
                <button
                    type="button"
                    onClick={() => onChange('NOVO')}
                    className={`
                        relative p-6 rounded-lg border-2 transition-all
                        hover:shadow-md
                        ${value === 'NOVO'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }
                    `}
                >
                    <div className="text-center space-y-2">
                        <div className="text-3xl">✨</div>
                        <div className="font-semibold text-slate-900">NOVO</div>
                        <div className="text-xs text-slate-600">
                            Produto novo
                            <br />
                            Imagens compartilhadas
                        </div>
                    </div>

                    {/* Selection indicator */}
                    {value === 'NOVO' && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* USADO Card */}
                <button
                    type="button"
                    onClick={() => onChange('USADO')}
                    className={`
                        relative p-6 rounded-lg border-2 transition-all
                        hover:shadow-md
                        ${value === 'USADO'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-200 bg-white hover:border-amber-300'
                        }
                    `}
                >
                    <div className="text-center space-y-2">
                        <div className="text-3xl">🔄</div>
                        <div className="font-semibold text-slate-900">USADO</div>
                        <div className="text-xs text-slate-600">
                            Produto usado
                            <br />
                            Imagens individuais
                        </div>
                    </div>

                    {/* Selection indicator */}
                    {value === 'USADO' && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>

            {/* Info message */}
            <div className={`
                p-3 rounded-lg text-sm
                ${value === 'NOVO' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}
            `}>
                {value === 'NOVO' ? (
                    <>
                        <strong>💡 Produto NOVO:</strong> As imagens são compartilhadas com todos os produtos
                        que têm o mesmo modelo e cor. Ideal para produtos novos lacrados.
                    </>
                ) : (
                    <>
                        <strong>⚠️ Produto USADO:</strong> Você deve adicionar fotos específicas deste produto
                        mostrando seu estado real (arranhões, desgaste, etc.).
                    </>
                )}
            </div>
        </div>
    );
}
