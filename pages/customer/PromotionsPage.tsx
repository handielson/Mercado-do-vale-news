import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tag, Coins, ShieldPlus, TicketPercent, Code, ArrowRight, Smartphone, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const PromotionsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings: themeSettings } = useTheme();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header Hero */}
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 pt-16 pb-24 text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 max-w-2xl mx-auto text-left md:text-center flex flex-col items-start md:items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors mb-6 text-sm font-medium"
                    >
                        <ArrowLeft size={16} /> Voltar para o Catálogo
                    </button>
                    
                    {/* Logomarca */}
                    {themeSettings?.logo_main ? (
                       <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-2xl shadow-xl shadow-slate-900/20 mb-8 inline-flex items-center justify-center border border-white/20">
                           <img src={themeSettings.logo_main} alt="Logo" className="h-16 w-auto object-contain" />
                       </div>
                    ) : (
                       <div className="w-16 h-16 bg-white/10 rounded-2xl mb-8 flex items-center justify-center">
                           <Tag className="w-8 h-8 text-white" />
                       </div>
                    )}

                    <div className="md:flex md:items-center md:justify-center md:gap-4 mb-4">
                        <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                            Aproveite as Melhores <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">Vantagens</span>
                        </h1>
                    </div>
                    <p className="text-lg text-blue-100/90 leading-relaxed font-medium">
                        Central exclusiva para você maximizar descontos, acumular moedas e proteger as suas compras.
                    </p>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-20 w-full pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

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

                    {/* Clube da película do vale Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
                            <Smartphone className="w-7 h-7 text-indigo-600" />
                        </div>
                        <div className="flex flex-col gap-1 mb-3">
                            <h2 className="text-xl font-bold text-slate-800">Clube da película do vale</h2>
                            <span className="inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                                Sazonal (Entra e Sai)
                            </span>
                        </div>
                        <p className="text-slate-600 mb-6 flex-1">
                            <strong className="text-orange-600">Fique alerta:</strong> esta promoção é sazonal e pode ser ativada ou desativada. Quando ativa na loja, na compra de qualquer aparelho Celular, você ganha 1 ano de películas gratuitas para proteger a tela do seu smartphone novo. Consulte sempre a disponibilidade.
                        </p>
                        <div className="border border-dashed border-indigo-300 bg-indigo-50 rounded-2xl px-4 py-5 mb-6 flex gap-3 items-center">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-800 uppercase tracking-widest font-bold mb-1">Como Resgatar</p>
                                <p className="text-sm text-indigo-700 font-medium leading-tight">Direito a 1 resgate por mês com aplicação gratuita exclusiva em nossas lojas físicas durante o período vigente da promoção.</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                            <Link
                                to="/?categoria=celulares"
                                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
                            >
                                Ver Aparelhos
                            </Link>
                            <Link
                                to="/promocoes/pelicula-gratis"
                                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-3 rounded-xl transition-colors border border-indigo-100"
                            >
                                Regulamento
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
