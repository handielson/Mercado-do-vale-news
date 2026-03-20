import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CreditCard,
    Truck,
    Tag,
    ChevronDown,
    HelpCircle,
    MessageCircle,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getCompanyData } from '../../services/companyService';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQCategory {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
    {
        id: 'pagamento',
        title: 'Pagamento',
        icon: <CreditCard className="w-6 h-6" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-200',
        items: [
            {
                question: 'Quais formas de pagamento são aceitas?',
                answer:
                    'Aceitamos Pix, cartão de débito, cartão de crédito (parcelado em até 12x) e dinheiro em espécie nas nossas lojas físicas. Para compras online, os métodos disponíveis são exibidos no momento do checkout.',
            },
            {
                question: 'O pagamento via Pix tem algum desconto?',
                answer:
                    'Sim! Pagamentos via Pix podem ter condições especiais de preço. Confira o produto desejado pois o desconto é exibido diretamente na página do produto antes de você finalizar a compra.',
            },
            {
                question: 'Posso parcelar no cartão de crédito?',
                answer:
                    'Sim, aceitamos parcelamento em cartão de crédito. O número máximo de parcelas e as condições (com ou sem juros) dependem do valor da compra e são exibidas no checkout. Acima de um determinado valor, o parcelamento pode incidir juros de acordo com a bandeira do cartão.',
            },
            {
                question: 'É seguro comprar online aqui?',
                answer:
                    'Totalmente! Nossa plataforma utiliza conexão criptografada (SSL/HTTPS) e os dados do seu cartão são processados por gateways certificados. Nunca armazenamos os dados completos do seu cartão.',
            },
            {
                question: 'Posso pagar com dois cartões ou combinar métodos?',
                answer:
                    'Para compras online, trabalhamos com pagamento único por pedido. Caso precise de um arranjo especial (ex.: parte em dinheiro e parte no cartão), entre em contato com nossa equipe de atendimento via WhatsApp antes de finalizar.',
            },
            {
                question: 'Quando o pagamento é confirmado?',
                answer:
                    'Pagamentos via Pix são confirmados em segundos após a transferência. Cartão de crédito/débito costuma ser confirmado em até 1 hora. Você receberá uma notificação assim que o pagamento for aprovado.',
            },
        ],
    },
    {
        id: 'entrega',
        title: 'Entrega',
        icon: <Truck className="w-6 h-6" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
        items: [
            {
                question: 'Qual é o prazo de entrega?',
                answer:
                    'O prazo varia de acordo com a sua localização e a transportadora escolhida. Após a confirmação do pagamento, você pode calcular o frete e o prazo estimado diretamente na página do produto ou no carrinho. Em média, as entregas ocorrem entre 2 e 10 dias úteis.',
            },
            {
                question: 'Vocês entregam em todo o Brasil?',
                answer:
                    'Sim! Enviamos para todo o território nacional por meio de transportadoras parceiras (Correios, Jadlog, entre outras). Para regiões mais remotas, o prazo pode ser um pouco maior.',
            },
            {
                question: 'Como rastrear meu pedido?',
                answer:
                    'Assim que seu pedido for despachado, você receberá o código de rastreio por e-mail ou WhatsApp. Você também pode acompanhar o status diretamente na página de rastreamento do nosso site, que é atualizada automaticamente.',
            },
            {
                question: 'E se o produto chegar com defeito ou avariado?',
                answer:
                    'Caso o produto chegue com algum dano gerado pelo transporte, entre em contato conosco em até 7 dias corridos após o recebimento com fotos do produto e da embalagem. Vamos resolver rapidamente com troca ou reenvio sem custo.',
            },
            {
                question: 'Posso retirar o produto na loja?',
                answer:
                    'Sim! Oferecemos a opção de retirada gratuita em loja física. Select essa opção no checkout e aguarde a confirmação de que o produto está pronto para retirada. O prazo médio é de 1 dia útil após a confirmação do pagamento.',
            },
            {
                question: 'O frete é gratuito?',
                answer:
                    'O frete gratuito pode estar disponível em promoções específicas ou para compras acima de determinado valor. As condições aparecem automaticamente no carrinho quando aplicáveis. Fique de olho nas nossas campanhas!',
            },
        ],
    },
    {
        id: 'promocoes',
        title: 'Promoções',
        icon: <Tag className="w-6 h-6" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-200',
        items: [
            {
                question: 'Como funciona o programa Moedas do Vale?',
                answer:
                    'As Moedas do Vale são nosso programa de fidelidade. A cada compra, você acumula moedas que podem ser convertidas em desconto em compras futuras. 100 Moedas = R$ 1,00 de desconto. As moedas não expiram e aparecem automaticamente na sua conta após a compra.',
            },
            {
                question: 'Como usar um cupom de desconto?',
                answer:
                    'Adicione os produtos desejados ao carrinho e, na etapa de checkout, insira o código do cupom no campo indicado. O desconto é aplicado instantaneamente antes de você confirmar o pagamento. Cada cupom tem prazo e regras específicas divulgadas junto à promoção.',
            },
            {
                question: 'Com que frequência vocês lançam promoções?',
                answer:
                    'Realizamos promoções com frequência, especialmente em datas comemorativas (Black Friday, Dia das Mães, Natal etc.) e em queimas de estoque. Siga nossas redes sociais e ative as notificações para não perder nenhuma oferta.',
            },
            {
                question: 'O que é a Garantia Estendida?',
                answer:
                    'A Garantia Estendida é um serviço adicional que você pode contratar no momento da compra. Ela amplia o período de cobertura do produto além da garantia de fábrica. As condições e preços são exibidos na página de cada produto elegível.',
            },
            {
                question: 'Posso acumular cupom com desconto de Moedas do Vale?',
                answer:
                    'As regras de cumulatividade variam por promoção. Em geral, é possível usar Moedas do Vale e um cupom de desconto no mesmo pedido, mas cada cupom tem suas próprias condições. Essas informações ficam descritas nos regulamentos de cada promoção.',
            },
            {
                question: 'Onde vejo as promoções ativas?',
                answer:
                    'Todas as promoções e vantagens disponíveis estão centralizadas na nossa página de Promoções (/promocoes). Lá você encontra os cupons ativos, o regulamento das Moedas do Vale, a Garantia Estendida e outras campanhas em andamento.',
            },
        ],
    },
];

const AccordionItem: React.FC<{ item: FAQItem; color: string; borderColor: string }> = ({
    item,
    color,
    borderColor,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className={`border ${borderColor} rounded-2xl overflow-hidden transition-all duration-200`}
        >
            <button
                onClick={() => setIsOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left bg-white hover:bg-slate-50 transition-colors"
                aria-expanded={isOpen}
            >
                <span className="font-semibold text-slate-800 text-sm leading-snug">
                    {item.question}
                </span>
                <ChevronDown
                    className={`w-5 h-5 shrink-0 ${color} transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="px-5 pb-5 bg-white">
                    <p className="text-slate-600 text-sm leading-relaxed">{item.answer}</p>
                </div>
            )}
        </div>
    );
};

export const FAQPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings: themeSettings } = useTheme();
    const [activeCategory, setActiveCategory] = useState<string>('pagamento');
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

    useEffect(() => {
        getCompanyData()
            .then((company) => {
                if (company?.phone) {
                    const digits = company.phone.replace(/\D/g, '');
                    const number = digits.startsWith('55') ? digits : `55${digits}`;
                    setWhatsappUrl(`https://wa.me/${number}`);
                }
            })
            .catch(() => { /* silently ignore */ });
    }, []);

    const activeData = FAQ_DATA.find((c) => c.id === activeCategory)!;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Hero */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 pt-16 pb-28 text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-start md:items-center text-left md:text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors mb-6 text-sm font-medium"
                    >
                        <ArrowLeft size={16} /> Voltar para o Catálogo
                    </button>

                    {themeSettings?.logo_main ? (
                        <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-2xl shadow-xl shadow-slate-900/20 mb-8 inline-flex items-center justify-center border border-white/20">
                            <img src={themeSettings.logo_main} alt="Logo" className="h-16 w-auto object-contain" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-white/10 rounded-2xl mb-8 flex items-center justify-center">
                            <HelpCircle className="w-8 h-8 text-white" />
                        </div>
                    )}

                    <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                        Perguntas{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
                            Frequentes
                        </span>
                    </h1>
                    <p className="text-lg text-blue-100/90 leading-relaxed font-medium">
                        Tire suas dúvidas sobre pagamento, entrega e promoções.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-20 w-full pb-24">
                {/* Category Tabs */}
                <div className="flex gap-3 justify-center flex-wrap mb-8">
                    {FAQ_DATA.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm shadow-md transition-all duration-200 ${
                                activeCategory === cat.id
                                    ? `${cat.bgColor} ${cat.color} shadow-lg scale-105`
                                    : 'bg-white text-slate-500 hover:text-slate-800 hover:shadow-lg'
                            }`}
                        >
                            {cat.icon}
                            {cat.title}
                        </button>
                    ))}
                </div>

                {/* Accordion */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                    {/* Category Header */}
                    <div className={`flex items-center gap-3 px-6 py-5 border-b border-slate-100`}>
                        <div className={`w-10 h-10 rounded-xl ${activeData.bgColor} ${activeData.color} flex items-center justify-center`}>
                            {activeData.icon}
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg">{activeData.title}</h2>
                            <p className="text-xs text-slate-400">{activeData.items.length} perguntas</p>
                        </div>
                    </div>

                    <div className="p-5 flex flex-col gap-3">
                        {activeData.items.map((item, idx) => (
                            <AccordionItem
                                key={idx}
                                item={item}
                                color={activeData.color}
                                borderColor={activeData.borderColor}
                            />
                        ))}
                    </div>
                </div>

                {/* CTA WhatsApp */}
                {whatsappUrl && (
                    <div className="mt-8 bg-gradient-to-br from-green-900 to-emerald-800 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-6 shadow-xl">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                            <MessageCircle className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-xl font-bold mb-1">Ainda tem dúvidas?</h3>
                            <p className="text-emerald-200 text-sm leading-relaxed">
                                Nossa equipe está pronta para te ajudar pelo WhatsApp. Clique abaixo e fale com a gente agora!
                            </p>
                        </div>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-2 bg-white text-green-800 font-bold px-6 py-3 rounded-2xl hover:bg-green-50 transition-colors shadow-md"
                        >
                            Falar no WhatsApp
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};
