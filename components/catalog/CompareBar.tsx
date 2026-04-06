import { useState } from 'react';
import { X, GitCompare, Trash2 } from 'lucide-react';
import { useCompare } from '../../contexts/CompareContext';
import { CompareModal } from './CompareModal';
import type { CatalogProduct } from '../../types/catalog';

/** Retorna nome do modelo sem sufixo de RAM/storage. Ex: "Redmi Note 15, 8GB/256GB" → "Redmi Note 15" */
const cleanModelName = (p: CatalogProduct): string =>
    (p.model || p.name || 'Produto').replace(/,?\s*\d+\s*[GT]B\/\d+\s*[GT]B.*/i, '').trim();

export function CompareBar() {
    const { selected, remove, clear } = useCompare();
    const [showModal, setShowModal] = useState(false);

    const visible = selected.length > 0;

    return (
        <>
            {/* Floating bar */}
            <div
                className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
            >
                <div className="bg-slate-900 border-t border-slate-700 shadow-2xl">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
                        {/* Label */}
                        <span className="text-white text-sm font-semibold whitespace-nowrap hidden sm:block">
                            Comparar ({selected.length}/3):
                        </span>

                        {/* Slots */}
                        <div className="flex gap-3 flex-1 overflow-x-auto">
                            {selected.map(product => (
                                <div
                                    key={product.id}
                                    className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 min-w-0 shrink-0 max-w-[180px]"
                                >
                                    {product.images?.[0] && (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-8 h-8 object-contain rounded shrink-0"
                                        />
                                    )}
                                    <span className="text-white text-xs truncate">
                                        {cleanModelName(product)}
                                    </span>
                                    <button
                                        onClick={() => remove(product.id)}
                                        className="text-slate-400 hover:text-white transition-colors shrink-0"
                                        title="Remover"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Empty slots */}
                            {Array.from({ length: 3 - selected.length }).map((_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    className="flex items-center justify-center bg-slate-800/40 border border-dashed border-slate-600 rounded-lg px-4 py-1.5 w-[120px] shrink-0"
                                >
                                    <span className="text-slate-500 text-xs">+ produto</span>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={clear}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                                title="Limpar seleção"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => setShowModal(true)}
                                disabled={selected.length < 2}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                                <GitCompare size={16} />
                                Comparar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer so content above doesn't hide behind bar */}
            {visible && <div className="h-16" />}

            {showModal && <CompareModal onClose={() => setShowModal(false)} />}
        </>
    );
}
