import React, { useEffect } from 'react';
import { X, Coins, ShoppingBag, Calendar, Flame, Gift, CheckCircle2, ChevronRight } from 'lucide-react';

interface CoinsInfoModalProps {
    onClose: () => void;
    dailyValues?: number[];
    coinsPerReal?: number;
    coinsToReais?: number; // how many coins = R$1
}

const DEFAULT_DAILY = [5, 10, 15, 20, 25, 30, 50];

export function CoinsInfoModal({
    onClose,
    dailyValues = DEFAULT_DAILY,
    coinsPerReal = 1,
    coinsToReais = 100,
}: CoinsInfoModalProps) {
    // Fechar com Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const brlPerCoin = (1 / coinsToReais).toFixed(2);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-xl">
                            <Coins className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg leading-tight">Moedas do Vale</h2>
                            <p className="text-xs text-slate-400">Programa de fidelidade</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-6">

                    {/* Intro */}
                    <p className="text-sm text-slate-600">
                        As <strong>Moedas do Vale</strong> são nossos pontos de fidelidade.
                        Acumule moedas comprando, fazendo check-in todo dia e resgate como desconto na sua próxima compra!
                    </p>

                    {/* ---- COMO GANHAR ---- */}
                    <section>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span className="text-base">💰</span> Como Ganhar Moedas
                        </h3>
                        <div className="space-y-2">
                            {/* Compras */}
                            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                                <ShoppingBag className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-green-800">Comprando na loja</p>
                                    <p className="text-xs text-green-600 mt-0.5">
                                        Ganhe <strong>{coinsPerReal} moeda</strong> a cada R$ 1,00 pago.
                                        Compra de R$ 100 → <strong>+{coinsPerReal * 100} moedas</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Check-in */}
                            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-blue-800">Check-in diário</p>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                        Entre na loja e colete sua moeda todo dia. As moedas aumentam com o streak!
                                    </p>
                                </div>
                            </div>

                            {/* Promoções */}
                            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <Gift className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Promoções especiais</p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        Alguns produtos e categorias têm bônus extras de moedas. Fique atento!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ---- CICLO SEMANAL ---- */}
                    <section>
                        <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" /> Ciclo de Check-in
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">
                            Faça check-in dias seguidos para ganhar mais. Após o dia {dailyValues.length}, o ciclo reinicia.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {dailyValues.map((coins, idx) => {
                                const isLast = idx === dailyValues.length - 1;
                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col items-center rounded-xl px-2 py-2 min-w-[52px] border
                                            ${isLast
                                                ? 'border-amber-400 bg-amber-50'
                                                : 'border-slate-200 bg-slate-50'
                                            }`}
                                    >
                                        <span className="text-base mb-0.5">{isLast ? '🎁' : '🪙'}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">Dia {idx + 1}</span>
                                        <span className={`text-sm font-bold ${isLast ? 'text-amber-700' : 'text-slate-700'}`}>
                                            +{coins}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600 font-medium">
                            <Flame className="w-3.5 h-3.5" />
                            Pule um dia e o streak reinicia do dia 1!
                        </div>
                    </section>

                    {/* ---- COMO RESGATAR ---- */}
                    <section>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span className="text-base">🛒</span> Como Resgatar
                        </h3>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                            {[
                                'Adicione produtos ao carrinho',
                                'Na finalização, ative "Usar Moedas do Vale"',
                                'O desconto é aplicado automaticamente',
                                'Aproveite! 🎉',
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-sm text-slate-600">{step}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800">
                            💡 <strong>{coinsToReais} moedas</strong> = <strong>R$ 1,00</strong> de desconto.
                            Para resgatar precisar ter pelo menos {coinsToReais} moedas acumuladas.
                        </div>
                    </section>

                    {/* ---- DICAS ---- */}
                    <section>
                        <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span className="text-base">⚡</span> Dicas
                        </h3>
                        <ul className="space-y-1.5">
                            {[
                                'Faça check-in todo dia para não quebrar o streak',
                                `No dia ${dailyValues.length} você ganha ${dailyValues[dailyValues.length - 1]} moedas — o maior bônus!`,
                                'Compras maiores geram mais moedas',
                                'Moedas não expiram enquanto você mantiver atividade',
                            ].map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        Entendido! <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
