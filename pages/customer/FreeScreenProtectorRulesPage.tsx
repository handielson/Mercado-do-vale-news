import React from 'react';
import { ShieldCheck, Calendar, Smartphone, Info, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const FreeScreenProtectorRulesPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-indigo-900 pt-16 pb-20 text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 max-w-3xl mx-auto text-left md:text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 text-indigo-200 hover:text-white transition-colors mb-6 text-sm font-medium"
                    >
                        <ArrowLeft size={16} /> Voltar para o Catálogo
                    </button>
                    <div className="md:flex md:items-center md:justify-center md:gap-4 mb-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-400/30 mb-4 md:mb-0">
                            <ShieldCheck className="w-6 h-6 text-indigo-200" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            Regulamento: Clube da película do vale
                        </h1>
                    </div>
                    <p className="text-lg text-indigo-200/90 leading-relaxed font-medium">
                        Entenda como funciona o seu benefício e como realizar os resgates mensais nas nossas lojas.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 -mt-10 relative z-20 w-full pb-20">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-6 md:p-10 space-y-8">

                        <section>
                            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Info className="text-indigo-600" /> O que é o benefício?
                            </h2>
                            <p className="text-slate-600 leading-relaxed mb-4">
                                O "Clube da película do vale" é uma <strong>promoção sazonal</strong> e exclusiva da Mercado do Vale. Fique alerta, pois este aviso significa que o benefício <strong>"entra e sai" do ar</strong>. Quando a campanha estiver ativa, os clientes que adquirem qualquer smartphone conosco ganham o direito de receber e ter instalada gratuitamente 1 (uma) película de proteção para a tela do aparelho por mês, durante 12 meses.
                            </p>
                            <div className="mt-4 flex items-start gap-3 text-sm text-orange-800 bg-orange-50 p-4 rounded-xl border border-orange-200">
                                <Info size={20} className="shrink-0 mt-0.5" />
                                <p><strong>Atenção - Promoção Sazonal:</strong> Por ser um benefício de campanha com tempo limitado, o seu direito e a entrega das películas gratuitas dependem <strong>exclusivamente</strong> de a promoção estar ativa e disponível na loja física, seja no momento em que você compra o celular ou nos meses seguintes durante os seus resgates presenciais.</p>
                            </div>
                        </section>

                        <hr className="border-slate-100" />

                        <section>
                            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-indigo-600" /> Regras de Utilização
                            </h2>
                            <ul className="space-y-4 text-slate-600">
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 min-w-[20px]"><Calendar className="w-5 h-5 text-indigo-500" /></div>
                                    <p><strong>Frequência:</strong> O benefício é limitado a 1 (um) resgate por mês calendário. Os resgates não são cumulativos. Se você não utilizar o benefício em um mês, ele não é transferido para o mês seguinte.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 min-w-[20px]"><Smartphone className="w-5 h-5 text-indigo-500" /></div>
                                    <p><strong>Aparelho Vinculado:</strong> A película fornecida será obrigatoriamente compatível com o modelo do smartphone adquirido na compra que gerou o benefício. Não é permitida a troca por películas de outros modelos.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 min-w-[20px]"><ShieldCheck className="w-5 h-5 text-indigo-500" /></div>
                                    <p><strong>Instalação na Loja:</strong> Para garantir a qualidade e a correta aplicação, a película deve ser obrigatoriamente instalada por um de nossos especialistas em uma de nossas lojas físicas no momento do resgate. Não fornecemos a película avulsa para instalação pelo próprio cliente.</p>
                                </li>
                            </ul>
                        </section>

                        <hr className="border-slate-100" />

                        <section>
                            <h2 className="text-2xl font-bold text-slate-800 mb-4">Como resgatar?</h2>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                                <ol className="list-decimal list-inside space-y-3 text-indigo-900 font-medium">
                                    <li>Acompanhe a disponibilidade do mês atual no seu <strong>Painel do Cliente</strong>, na aba "Meus Benefícios".</li>
                                    <li>Dirija-se a uma de nossas lojas físicas.</li>
                                    <li>Apresente seu documento de identificação e o painel logado para um de nossos vendedores.</li>
                                    <li>O vendedor fará a autorização via sistema e nossa equipe realizará a aplicação da película nova no seu aparelho na hora!</li>
                                </ol>
                            </div>
                        </section>

                        <section className="text-sm text-slate-500 pt-4">
                            <p>
                                <strong>Validade:</strong> O benefício é válido por exatos 12 meses a contar da data de entrega do aparelho. Após esse período, o benefício expira automaticamente.
                            </p>
                            <p className="mt-2">
                                O Mercado do Vale reserva-se o direito de alterar ou cancelar esta promoção a qualquer momento, garantindo o direito adquirido dos clientes que já estão participando ativamente do programa de 12 meses.
                            </p>
                        </section>

                    </div>
                </div>

                <div className="mt-8 text-center">
                    <Link
                        to="/?categoria=celulares"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all hover:-translate-y-1"
                    >
                        Comprar Meu Celular e Ganhar <ArrowLeft className="w-5 h-5 rotate-180" />
                    </Link>
                </div>
            </div>
        </div>
    );
};
