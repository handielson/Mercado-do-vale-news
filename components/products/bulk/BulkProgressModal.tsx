import React from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface BulkProgressModalProps {
    isOpen: boolean;
    total: number;
    current: number;
    success: number;
    failed: number;
    isComplete: boolean;
    onClose: () => void;
}

export function BulkProgressModal({
    isOpen,
    total,
    current,
    success,
    failed,
    isComplete,
    onClose
}: BulkProgressModalProps) {
    if (!isOpen) return null;

    const progress = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                {/* Header */}
                <div className="text-center mb-6">
                    {isComplete ? (
                        <CheckCircle className="mx-auto mb-4 text-green-600" size={64} />
                    ) : (
                        <Loader2 className="mx-auto mb-4 text-blue-600 animate-spin" size={64} />
                    )}
                    <h2 className="text-2xl font-bold text-slate-800">
                        {isComplete ? 'Importação Concluída!' : 'Importando Produtos...'}
                    </h2>
                </div>

                {/* Progress Bar */}
                {!isComplete && (
                    <div className="mb-6">
                        <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-slate-600 text-center mt-2">
                            {current} de {total} produtos processados
                        </p>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <CheckCircle className="mx-auto mb-2 text-green-600" size={24} />
                        <p className="text-2xl font-bold text-green-700">{success}</p>
                        <p className="text-sm text-green-600">Sucesso</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <XCircle className="mx-auto mb-2 text-red-600" size={24} />
                        <p className="text-2xl font-bold text-red-700">{failed}</p>
                        <p className="text-sm text-red-600">Falhas</p>
                    </div>
                </div>

                {/* Actions */}
                {isComplete && (
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Fechar
                    </button>
                )}
            </div>
        </div>
    );
}
