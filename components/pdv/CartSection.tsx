import React from 'react';
import { ShoppingCart, Trash2, X } from 'lucide-react';
import { SaleItem } from '../../types/sale';
import { calculateItemTotal, calculateItemSubtotal, calculateItemDiscount, formatCurrency } from '../../utils/saleCalculations';

interface CartSectionProps {
    items: SaleItem[];
    onUpdateQuantity: (itemId: string, quantity: number) => void;
    onRemoveItem: (itemId: string) => void;
    onClearCart: () => void;
}

export default function CartSection({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onClearCart
}: CartSectionProps) {
    // Calcular totais
    const subtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
    const discountTotal = items.reduce((sum, item) => sum + calculateItemDiscount(item), 0);
    const total = subtotal - discountTotal;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ShoppingCart size={20} />
                    Carrinho ({items.length} {items.length === 1 ? 'item' : 'itens'})
                </h3>
                {items.length > 0 && (
                    <button
                        onClick={onClearCart}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                        <Trash2 size={16} />
                        Limpar
                    </button>
                )}
            </div>

            {/* Lista de Itens */}
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Carrinho vazio</p>
                        <p className="text-sm mt-1">Adicione produtos para iniciar a venda</p>
                    </div>
                ) : (
                    items.map((item) => {
                        const itemSubtotal = calculateItemSubtotal(item);
                        const itemDiscount = calculateItemDiscount(item);
                        const itemTotal = calculateItemTotal(item);

                        return (
                            <div
                                key={item.id}
                                className={`p-3 border rounded-lg ${item.is_gift ? 'border-green-300 bg-green-50' : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Informações do Produto */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-slate-800">{item.product_name}</h4>
                                            {item.is_gift && (
                                                <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-medium">
                                                    🎁 BRINDE
                                                </span>
                                            )}
                                        </div>
                                        {item.product_sku && (
                                            <p className="text-xs text-slate-500">SKU: {item.product_sku}</p>
                                        )}

                                        {/* Preço e Quantidade */}
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                                    disabled={item.quantity <= 1}
                                                    className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={item.track_inventory ? item.stock_quantity : undefined}
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const qty = parseInt(e.target.value) || 1;
                                                        const maxQty = item.track_inventory ? (item.stock_quantity || 0) : Infinity;
                                                        onUpdateQuantity(item.id, Math.min(qty, maxQty));
                                                    }}
                                                    className="w-14 px-2 py-1 border border-slate-300 rounded text-center"
                                                />
                                                <button
                                                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                                    disabled={item.track_inventory && item.stock_quantity !== undefined && item.quantity >= item.stock_quantity}
                                                    className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={item.track_inventory && item.quantity >= (item.stock_quantity || 0) ? `Estoque máximo: ${item.stock_quantity}` : ''}
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <div className="text-sm">
                                                <span className="text-slate-600">
                                                    {formatCurrency(item.unit_price)} × {item.quantity}
                                                </span>
                                                <span className="mx-2 text-slate-400">=</span>
                                                {item.is_gift ? (
                                                    <>
                                                        <span className="line-through text-slate-400 mr-2">
                                                            {formatCurrency(itemSubtotal)}
                                                        </span>
                                                        <span className="font-bold text-green-700">
                                                            R$ 0,00
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="font-bold text-blue-700">
                                                        {formatCurrency(itemTotal)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Desconto (se houver) */}
                                        {itemDiscount > 0 && (
                                            <p className="text-xs text-green-600 mt-1">
                                                Desconto: -{formatCurrency(itemDiscount)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Botão Remover */}
                                    <button
                                        onClick={() => onRemoveItem(item.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Remover item"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Totais */}
            {items.length > 0 && (
                <div className="border-t border-slate-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountTotal > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Desconto:</span>
                            <span className="font-medium text-green-600">-{formatCurrency(discountTotal)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                        <span className="text-slate-800">TOTAL:</span>
                        <span className="text-blue-700">{formatCurrency(total)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
