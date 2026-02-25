import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, Coins, ShieldPlus, TicketPercent, Code, ArrowRight } from 'lucide-react';

export const PromotionsPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header Hero */}
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 pt-16 pb-24 text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-500/20 rounded-2xl mb-6 backdrop-blur-sm border border-blue-400/30">
                        <Tag className="w-8 h-8 text-blue-200" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                        Aproveite as Melhores <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">Vantagens</span>
                    </h1>
                    <p className="text-lg text-blue-100/90 leading-relaxed font-medium">
                        Central exclusiva para você maximizar descontos, acumular moedas e proteger as suas compras.
                    </p>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-20 w-full pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Moedas do Vale Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-6">
                            <Coins className="w-7 h-7 text-amber-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Moedas do Vale</h2>
                        <p className="text-slate-600 mb-6 flex-1">
                            Nosso programa de fidelidade te devolve parte do valor da compra em moedas digitais. Elas nunca expiram e viram descontos reais!
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5">
                                <Coins className="w-16 h-16" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700 mb-1">Cotação Atual:</p>
                            <p className="text-2xl font-black text-amber-500">100 Moedas</p>
                            <p className="text-sm text-slate-500 font-medium">= R$ 1,00 de desconto</p>
                        </div>
                        <Link
                            to="/moedas-do-vale"
                            className="inline-flex items-center justify-between w-full font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-5 py-3 rounded-xl transition-colors"
                        >
                            Ver Regulamento
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Cupons Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                            <TicketPercent className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Cupons e Ofertas</h2>
                        <p className="text-slate-600 mb-6 flex-1">
                            Aplique cupons promocionais divulgados nas nossas redes sociais ou recebidos via WhatsApp diretamente na sua sacola.
                        </p>
                        <div className="border border-dashed border-emerald-300 bg-emerald-50 rounded-2xl px-4 py-5 mb-6 flex gap-3 items-center">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
                                <Code className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-emerald-800 uppercase tracking-widest font-bold mb-1">Dica de uso</p>
                                <p className="text-sm text-emerald-700 font-medium leading-tight">Adicione os produtos ao carrinho para poder ativar o seu cupom especial.</p>
                            </div>
                        </div>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-between w-full font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-5 py-3 rounded-xl transition-colors"
                        >
                            Ver Produtos
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Garantia Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-6">
                            <ShieldPlus className="w-7 h-7 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Garantia Estendida</h2>
                        <p className="text-slate-600 mb-6 flex-1">
                            Use a tranquilidade a seu favor. Oferecemos opções de Garantia Estendida diretamente no momento da cotação do produto escolhido.
                        </p>
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-6 text-white relative overflow-hidden">
                            <ShieldPlus className="absolute -right-3 -bottom-3 w-20 h-20 text-white/5" />
                            <p className="font-semibold mb-1">Cobertura Imediata</p>
                            <p className="text-sm text-slate-300 leading-snug">Você contrata sem burocracia antes de finalizar o pagamento no balcão.</p>
                        </div>
                        <Link
                            to="/garantia-estendida"
                            className="inline-flex items-center justify-between w-full font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-5 py-3 rounded-xl transition-colors"
                        >
                            Conhecer a Garantia
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
};
