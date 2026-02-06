import React from 'react';
import { ShoppingBag, Package } from 'lucide-react';

/**
 * Purchase History Tab Component
 * 
 * Shows customer's purchase history
 * Max 200 lines (ANTIGRAVITY protocol)
 * 
 * TODO: Implement sales fetching and display
 */
export const PurchaseHistoryTab: React.FC = () => {
    // TODO: Fetch sales from Supabase
    // const { customer } = useSupabaseAuth();
    // const [sales, setSales] = useState<Sale[]>([]);

    return (
        <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Histórico de Compras</h2>
            <p className="text-slate-600 mb-6">
                Acompanhe todas as suas compras realizadas
            </p>

            {/* Empty State */}
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                    <ShoppingBag className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Nenhuma compra realizada
                </h3>
                <p className="text-slate-600 mb-6">
                    Você ainda não realizou compras. Explore nosso catálogo!
                </p>
                <a
                    href="/cliente/catalogo"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    <Package size={20} />
                    Ver Catálogo
                </a>
            </div>

            {/* TODO: Sales List
            <div className="space-y-4">
                {sales.map(sale => (
                    <div key={sale.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="font-semibold text-slate-900">Pedido #{sale.id.slice(0, 8)}</p>
                                <p className="text-sm text-slate-600">{formatDate(sale.created_at)}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-800'
                            }`}>
                                {sale.status === 'completed' ? 'Concluído' :
                                 sale.status === 'cancelled' ? 'Cancelado' : 'Reembolsado'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-slate-600">{sale.items.length} item(ns)</p>
                            <p className="text-lg font-bold text-slate-900">
                                {formatCurrency(sale.total)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            */}
        </div>
    );
};
