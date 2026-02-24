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
}

const formatPrice = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

export default function CartItemsSection({ items, warrantyOptions, onUpdateQuantity, onRemoveItem, onUpdateWarranty }: CartItemsSectionProps) {
    if (items.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={20} />
                Itens Adicionados ({items.length})
            </h3>

            <div className="space-y-4">
                {items.map(item => (
                    <div key={item.id} className="p-4 border border-slate-200 rounded-lg flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-800">{item.product_name}</h4>
                                <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                    <span>{formatPrice(item.unit_price)} unid.</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <span className="font-bold text-slate-800">{formatPrice(item.subtotal)}</span>
                                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-white rounded text-slate-600 transition-colors">
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-white rounded text-slate-600 transition-colors">
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <button onClick={() => onRemoveItem(item.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 transition-colors mt-1">
                                    <Trash2 size={16} /> Remover
                                </button>
                            </div>
                        </div>

                        {/* Warranty Selector */}
                        {warrantyOptions.length > 0 && !item.is_gift && (
                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                                    <Shield size={16} className="text-blue-600" />
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
                                                +{opt.months} Meses (+{formatPrice(price)})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
