import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { BulkProductPreview } from '../../../types/bulk-product';

interface BulkPreviewTableProps {
    previews: BulkProductPreview[];
    onConfirm: () => void;
    onCancel: () => void;
}

export function BulkPreviewTable({ previews, onConfirm, onCancel }: BulkPreviewTableProps) {
    const validCount = previews.filter(p => p.validation.valid).length;
    const invalidCount = previews.length - validCount;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">✅ Validação de Produtos</h2>
                <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">
                        ✓ {validCount} válidos
                    </span>
                    <span className="text-red-600 font-medium">
                        ✗ {invalidCount} com erros
                    </span>
                </div>
            </div>

            {/* Summary */}
            {invalidCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                        <div>
                            <p className="font-medium text-amber-800">Atenção</p>
                            <p className="text-sm text-amber-700 mt-1">
                                {invalidCount} produto(s) com erro(s) não serão importados.
                                Apenas os produtos válidos serão cadastrados.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700 w-12">#</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">Produto</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">Serial</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">IMEI 1</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">Erros</th>
                        </tr>
                    </thead>
                    <tbody>
                        {previews.map((preview) => (
                            <tr
                                key={preview.row}
                                className={`border-t border-slate-200 ${preview.validation.valid ? 'bg-white' : 'bg-red-50'
                                    }`}
                            >
                                <td className="px-4 py-3 text-slate-600">{preview.row}</td>
                                <td className="px-4 py-3">
                                    {preview.validation.valid ? (
                                        <CheckCircle className="text-green-600" size={18} />
                                    ) : (
                                        <XCircle className="text-red-600" size={18} />
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {preview.baseProduct ? (
                                        <div>
                                            <p className="font-medium text-slate-800 text-xs">
                                                {preview.baseProduct.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                EAN: {preview.baseProduct.ean}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Não encontrado</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-800 text-xs">
                                    {preview.uniqueFields.serial || '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-800 font-mono text-xs">
                                    {preview.uniqueFields.imei1 ?
                                        preview.uniqueFields.imei1.substring(0, 8) + '...' : '-'
                                    }
                                </td>
                                <td className="px-4 py-3">
                                    {preview.validation.errors.length > 0 ? (
                                        <div className="text-xs text-red-600">
                                            {preview.validation.errors.map((error, i) => (
                                                <div key={i}>• {error}</div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-green-600 text-xs">✓ OK</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    disabled={validCount === 0}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Importar {validCount} Produto(s)
                </button>
            </div>
        </div>
    );
}
