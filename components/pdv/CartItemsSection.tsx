import React from 'react';
import { ShoppingBag, Minus, Plus, Trash2, Shield } from 'lucide-react';
import { SaleItem } from '../../types/sale';
import { WarrantyOption } from '../../types/companySettings';

interface CartItemsSectionProps {
    items: SaleItem[];
    warrantyOptions: WarrantyOption[];
    onUpdateQuantity: (id: string, qty: number) => void;
    onRemoveItem: (id: string) => void;
    onUpdateWarranty: (id: string, warranty: WarrantyOption | null) => void;
    onUpdatePrice: (id: string, newPrice: number) => void;
}

const fmt = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

export default function CartItemsSection({ items, warrantyOptions, onUpdateQuantity, onRemoveItem, onUpdateWarranty, onUpdatePrice }: CartItemsSectionProps) {
    if (items.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={20} />
                Itens Adicionados ({items.length})
            </h3>

            <div className="space-y-3">
                {items.map(item => {
                    const productTotal = item.unit_price * item.quantity;
                    const warrantyTotal = item.warranty_price || 0;
                    const subtotal = productTotal + warrantyTotal;

                    return (
                        <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">

                            {/* Bloco de linhas estilo recibo */}
                            <div className="px-4 pt-3 pb-2 space-y-1">

                                {/* Linha 1: produto */}
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-sm font-medium text-slate-800">
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    {item.is_gift ? (
                                        <span className="text-sm font-semibold text-slate-800 shrink-0 tabular-nums">
                                            {fmt(productTotal)}
                                        </span>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-slate-500">Unidade: R$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-24 px-2 py-1 text-right text-sm font-semibold text-slate-800 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    value={(item.unit_price / 100)}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val >= 0) {
                                                            onUpdatePrice(item.id, Math.round(val * 100));
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {item.quantity > 1 && (
                                                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                                    Total: {fmt(productTotal)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Linha 2: garantia (condicional) */}
                                {warrantyTotal > 0 && item.warranty_months && (
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="text-sm text-blue-700 flex items-center gap-1">
                                            <Shield size={13} className="text-blue-500 shrink-0" />
                                            + Garantia {item.warranty_months}M
                                        </span>
                                        <span className="text-sm font-medium text-blue-700 shrink-0 tabular-nums">
                                            {fmt(warrantyTotal)}
                                        </span>
                                    </div>
                                )}

                                {/* Linha 3: subtotal */}
                                <div className="flex justify-end pt-1 border-t border-slate-100 mt-1">
                                    <span className="text-sm text-slate-500">
                                        Subtotal:{' '}
                                        <span className="font-bold text-slate-900">{fmt(subtotal)}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Controles: quantidade e remover */}
                            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={() => onRemoveItem(item.id)}
                                    className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 size={13} /> Remover
                                </button>

                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                                    <button
                                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-7 text-center text-sm font-semibold text-slate-700">{item.quantity}</span>
                                    <button
                                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Seletor de Garantia Estendida */}
                            {warrantyOptions.length > 0 && !item.is_gift && (
                                <div className="bg-blue-50/50 px-4 py-3 border-t border-blue-100 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                                        <Shield size={15} className="text-blue-600" />
                                        Garantia Estendida
                                    </div>
                                    <select
                                        value={item.warranty_months?.toString() || ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) {
                                                onUpdateWarranty(item.id, null);
                                            } else {
                                                const opt = warrantyOptions.find(o => o.months.toString() === val);
                                                onUpdateWarranty(item.id, opt || null);
                                            }
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                        <option value="">Nenhuma garantia estendida</option>
                                        {warrantyOptions.map(opt => {
                                            const price = Math.round((item.unit_price * opt.percentage) / 100);
                                            return (
                                                <option key={opt.months} value={opt.months}>
                                                    +{opt.months} Meses (+{fmt(price)})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
