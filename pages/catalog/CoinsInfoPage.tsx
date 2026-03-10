import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, ShoppingBag, Calendar, Flame, Gift, CheckCircle2, AlertTriangle, Clock, Share2 } from 'lucide-react';
import { getCashbackSettings } from '../../services/cashbackService';
import { supabase } from '../../services/supabase';
import type { CashbackSettings } from '../../types/cashback';

const DEFAULT_DAILY = [5, 10, 15, 20, 25, 30, 50];

export default function CoinsInfoPage() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<CashbackSettings | null>(null);

    useEffect(() => {
        getCashbackSettings().then(setSettings).catch(() => null);
    }, []);

    const dailyValues: number[] = (settings as any)?.checkin_daily_values ?? DEFAULT_DAILY;
    const coinsPerReal = settings?.coins_per_real ?? 1;
    const coinsToReais = settings?.coins_to_brl_rate ?? 100;
    const minRedeem = settings?.min_coins_to_redeem ?? 100;
    const maxRedeemPct = settings?.max_redeem_percent ?? 20;
    const expiryDays = settings?.coins_expire_after_days ?? 0;
    const referralMultiplier = settings?.referral_coins_per_real ?? 0.50;

    const [userCode, setUserCode] = useState<string | null>(null);

    // Simulator states
    const [simPurchase, setSimPurchase] = useState<number | ''>('');
    const [simCoins, setSimCoins] = useState<number | ''>('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from('customers').select('referral_code').eq('id', user.id).single()
                    .then(({ data }) => setUserCode(data?.referral_code || null));
            }
        });
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">

            {/* ===== CABEÇALHO PROFISSIONAL ===== */}
            <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-xl">
                            <Coins className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-800 text-lg leading-tight">
                                Regulamento — Moedas do Vale
                            </h1>
                            <p className="text-xs text-slate-400">Programa de fidelidade e recompensas</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== CONTEÚDO ===== */}
            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

                {/* Introdução */}
                <section className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-2xl p-6 shadow">
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">🪙</div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">O que são as Moedas do Vale?</h2>
                            <p className="text-yellow-50 text-sm leading-relaxed">
                                As <strong>Moedas do Vale</strong> são nosso programa de fidelidade. Ao comprar e
                                acompanhar nossa loja, você acumula moedas que podem ser trocadas por descontos
                                reais nas suas próximas compras.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 1. Como Ganhar */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-xl">💰</span> 1. Como Ganhar Moedas
                    </h2>
                    <div className="space-y-3">

                        {/* Compras */}
                        <div className="bg-white border border-green-200 rounded-xl p-4 flex gap-4 shadow-sm">
                            <div className="p-2 bg-green-100 rounded-xl h-fit">
                                <ShoppingBag className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Comprando na loja</h3>
                                <p className="text-sm text-slate-600">
                                    A cada <strong>R$ 1,00</strong> pago (valor final após descontos), você ganha{' '}
                                    <strong className="text-green-700">{coinsPerReal} moeda{coinsPerReal > 1 ? 's' : ''}</strong>.
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Exemplo: Compra de R$ 200 → +{200 * coinsPerReal} moedas
                                </p>
                            </div>
                        </div>

                        {/* Check-in */}
                        <div className="bg-white border border-blue-200 rounded-xl p-4 flex gap-4 shadow-sm">
                            <div className="p-2 bg-blue-100 rounded-xl h-fit">
                                <Calendar className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Check-in diário</h3>
                                <p className="text-sm text-slate-600">
                                    Acesse a loja todos os dias e clique em <strong>Check-in</strong> na barra de categorias.
                                    As moedas aumentam a cada dia consecutivo!
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    No {dailyValues.length}º dia, você recebe o bônus máximo de{' '}
                                    <strong className="text-amber-600">{dailyValues[dailyValues.length - 1]} moedas 🎁</strong>
                                </p>
                            </div>
                        </div>

                        {/* Promoções */}
                        <div className="bg-white border border-amber-200 rounded-xl p-4 flex gap-4 shadow-sm">
                            <div className="p-2 bg-amber-100 rounded-xl h-fit">
                                <Gift className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Promoções especiais</h3>
                                <p className="text-sm text-slate-600">
                                    Periodicamente, produtos e categorias específicas oferecem bônus extras de moedas.
                                    Fique atento às promoções na loja!
                                </p>
                            </div>
                        </div>

                        {/* Indicação */}
                        <div className="bg-white border border-purple-200 rounded-xl p-4 flex gap-4 shadow-sm">
                            <div className="p-2 bg-purple-100 rounded-xl h-fit">
                                <Share2 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800 mb-1">Indicação de Amigos (Compartilhamento)</h3>
                                <p className="text-sm text-slate-600">
                                    Compartilhe produtos conosco! Quando alguém fechar uma compra usando sua indicação, você ganha{' '}
                                    <strong className="text-purple-700">{referralMultiplier * 100}% do subtotal da compra em moedas</strong> automaticamente! (Ex: R$ 100 da compra = {100 * referralMultiplier} moedas).
                                </p>
                                {userCode && (
                                    <div className="mt-2 text-sm bg-purple-50 p-2 rounded border border-purple-100">
                                        Seu código de indicação: <strong className="font-mono text-purple-800 tracking-wider">{userCode}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </section>

                {/* 2. Ciclo de Check-in */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Flame className="w-5 h-5 text-orange-500" /> 2. Ciclo de Check-in Progressivo
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                        As moedas do check-in aumentam a cada dia consecutivo. Ao completar o ciclo de {dailyValues.length} dias,
                        o contador reinicia do Dia 1 e você pode recomeçar.
                    </p>

                    {/* Calendário visual */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {dailyValues.map((coins, idx) => {
                            const isLast = idx === dailyValues.length - 1;
                            return (
                                <div
                                    key={idx}
                                    className={`flex flex-col items-center rounded-xl px-3 py-3 border min-w-[58px] text-center
                                        ${isLast
                                            ? 'border-amber-400 bg-amber-50 shadow'
                                            : 'border-slate-200 bg-white'
                                        }`}
                                >
                                    <span className="text-lg mb-0.5">{isLast ? '🎁' : '🪙'}</span>
                                    <span className="text-[10px] text-slate-400">Dia {idx + 1}</span>
                                    <span className={`text-sm font-bold ${isLast ? 'text-amber-700' : 'text-slate-700'}`}>
                                        +{coins}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex gap-2 items-start">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-orange-700">
                            <strong>Atenção:</strong> Se você pular um dia, o streak é resetado para o Dia 1.
                            Para manter o bônus máximo, faça check-in todos os dias!
                        </p>
                    </div>
                </section>

                {/* 3. Como Resgatar */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-xl">🛒</span> 3. Como Resgatar
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                        {[
                            { icon: '1', text: 'Adicione produtos ao carrinho normalmente' },
                            { icon: '2', text: 'Na tela de finalização, ative a opção "Usar Moedas do Vale"' },
                            { icon: '3', text: 'O desconto é calculado e aplicado automaticamente' },
                            { icon: '4', text: 'Confirme o pedido com o desconto aplicado' },
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow">
                                    {step.icon}
                                </span>
                                <span className="text-sm text-slate-600">{step.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Taxa de conversão */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                            <p className="text-xs text-yellow-600 mb-1">Taxa de conversão</p>
                            <p className="text-lg font-bold text-yellow-800">
                                {coinsToReais} moedas = R$ 1,00
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                            <p className="text-xs text-slate-500 mb-1">Desconto máximo permitido</p>
                            <p className="text-lg font-bold text-slate-700">
                                {maxRedeemPct}% do valor do pedido
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
                        ℹ️ <strong>Saldo mínimo para resgatar:</strong> {minRedeem} moedas
                    </div>
                </section>

                {/* Simulador */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-xl">🧮</span> Simulador de Benefícios
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Simulador de Ganho */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-2">Simular Ganhos</h3>
                            <label className="block text-xs text-slate-500 mb-1">Se eu comprar (R$):</label>
                            <input
                                type="number"
                                min="0"
                                value={simPurchase}
                                onChange={e => setSimPurchase(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-yellow-500"
                                placeholder="Ex: 500"
                            />
                            <div className="bg-yellow-50 rounded-lg p-3 flex justify-between items-center text-sm border border-yellow-100">
                                <span className="text-yellow-800 font-medium">Você ganhará:</span>
                                <strong className="text-yellow-700 text-lg">+{Math.floor((Number(simPurchase) || 0) * coinsPerReal)} moedas</strong>
                            </div>
                        </div>

                        {/* Simulador de Resgate */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-2">Simular Desconto</h3>
                            <label className="block text-xs text-slate-500 mb-1">Se eu resgatar (moedas):</label>
                            <input
                                type="number"
                                min="0"
                                value={simCoins}
                                onChange={e => setSimCoins(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-yellow-500"
                                placeholder="Ex: 1000"
                            />
                            <div className="bg-green-50 rounded-lg p-3 flex justify-between items-center text-sm border border-green-100">
                                <span className="text-green-800 font-medium">Terá desconto de:</span>
                                <strong className="text-green-700 text-lg">R$ {((Number(simCoins) || 0) / coinsToReais).toFixed(2).replace('.', ',')}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. Validade */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Clock className="w-5 h-5 text-slate-400" /> 4. Validade das Moedas
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        {expiryDays > 0 ? (
                            <p className="text-sm text-slate-600">
                                As moedas expiram após <strong>{expiryDays} dias</strong> a partir da data em que foram ganhas.
                                Utilize suas moedas dentro deste prazo para não perdê-las.
                            </p>
                        ) : (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p className="text-sm text-slate-600">
                                    <strong className="text-green-700">Suas moedas não expiram!</strong>{' '}
                                    Acumule sem pressa e resgate quando quiser.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* 5. Regras Gerais */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-xl">📋</span> 5. Regras Gerais
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <ul className="space-y-2 text-sm text-slate-600">
                            {[
                                'As moedas são pessoais e intransferíveis.',
                                'Não é possível trocar moedas por dinheiro em espécie.',
                                'Pedidos cancelados ou devolvidos têm as moedas estornadas automaticamente.',
                                'O Mercado do Vale reserva o direito de alterar, suspender ou encerrar este programa a qualquer momento, sem aviso prévio.',
                                'Moedas ganhas em promoções específicas podem ter regras de uso próprias.',
                                'O uso indevido ou fraudulento do sistema pode resultar no cancelamento da conta.',
                            ].map((rule, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-slate-300 font-bold text-xs mt-0.5">→</span>
                                    {rule}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Rodapé */}
                <footer className="text-center text-xs text-slate-400 pb-4 border-t border-slate-100 pt-4">
                    <p><strong>Mercado do Vale</strong> · Programa Moedas do Vale</p>
                    <p className="mt-1">Em caso de dúvidas, fale conosco pelo WhatsApp.</p>
                </footer>

            </main>
        </div>
    );
}
