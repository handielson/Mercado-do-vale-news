import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, RefreshCw } from 'lucide-react';
import { Product } from '../../types/product';
import { StockMovementType, StockMovementReason } from '../../types/inventory';

interface StockAdjustmentModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (adjustment: {
        type: StockMovementType;
        quantity: number;
        reason: StockMovementReason;
        notes?: string;
    }) => void;
}

/**
 * StockAdjustmentModal Component
 * Modal for adjusting product stock
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Component < 500 lines
 * - Clear validation
 * - User-friendly interface
 */
export function StockAdjustmentModal({ product, isOpen, onClose, onConfirm }: StockAdjustmentModalProps) {
    const [type, setType] = useState<StockMovementType>('in');
    const [quantity, setQuantity] = useState<string>('');
    const [reason, setReason] = useState<StockMovementReason>('inventory');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal opens
            setType('in');
            setQuantity('');
            setReason('inventory');
            setNotes('');
        }
    }, [isOpen]);

    if (!isOpen || !product) return null;

    const currentStock = product.stock_quantity || 0;
    const quantityNum = parseInt(quantity) || 0;

    let newStock = currentStock;
    if (type === 'in') {
        newStock = currentStock + quantityNum;
    } else if (type === 'out') {
        newStock = Math.max(0, currentStock - quantityNum);
    } else if (type === 'adjustment') {
        newStock = quantityNum;
    }

    const handleConfirm = () => {
        if (!quantity || quantityNum <= 0) {
            alert('Por favor, informe uma quantidade válida');
            return;
        }

        onConfirm({
            type,
            quantity: quantityNum,
            reason,
            notes: notes.trim() || undefined
        });

        onClose();
    };

    const reasonOptions: Record<StockMovementReason, string> = {
        purchase: 'Compra',
        sale: 'Venda',
        loss: 'Perda',
        donation: 'Doação',
        return: 'Devolução',
        inventory: 'Inventário',
        transfer: 'Transferência'
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Ajustar Estoque</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Product Info */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-4">
                            {product.images?.[0] && (
                                <img
                                    src={product.images[0]}
                                    alt={product.name}
                                    className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">{product.name}</h3>
                                <p className="text-sm text-slate-600">SKU: {product.sku}</p>
                                <p className="text-sm font-medium text-blue-600 mt-1">
                                    Estoque Atual: {currentStock} unidades
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Movement Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                            Tipo de Movimento
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setType('in')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${type === 'in'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <Plus className="w-6 h-6" />
                                <span className="text-sm font-medium">Entrada</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('out')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${type === 'out'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <Minus className="w-6 h-6" />
                                <span className="text-sm font-medium">Saída</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('adjustment')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${type === 'adjustment'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <RefreshCw className="w-6 h-6" />
                                <span className="text-sm font-medium">Ajuste</span>
                            </button>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {type === 'adjustment' ? 'Nova Quantidade' : 'Quantidade'}
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder={type === 'adjustment' ? 'Quantidade final' : 'Quantidade a movimentar'}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Motivo
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value as StockMovementReason)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Object.entries(reasonOptions).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Observações (opcional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Adicione detalhes sobre este ajuste..."
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Preview */}
                    {quantity && quantityNum > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-900">Novo Estoque:</span>
                                <span className="text-2xl font-bold text-blue-900">{newStock} unidades</span>
                            </div>
                            {type !== 'adjustment' && (
                                <p className="text-xs text-blue-700 mt-2">
                                    {currentStock} {type === 'in' ? '+' : '−'} {quantityNum} = {newStock}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!quantity || quantityNum <= 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar Ajuste
                    </button>
                </div>
            </div>
        </div>
    );
}
