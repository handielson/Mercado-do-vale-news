import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import { PublicHeader } from '../../components/PublicHeader';

const CONTACT_EMAIL = 'contato@mercadodovale.com.br';
const UPDATED_AT = '4 de agosto de 2026';

type LegalSection = {
    title: string;
    content: React.ReactNode;
};

function LegalPage({ title, description, sections }: { title: string; description: string; sections: LegalSection[] }) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Helmet>
                <title>{title} | Mercado do Vale</title>
                <meta name="description" content={description} />
                <meta name="robots" content="index,follow" />
            </Helmet>
            <PublicHeader />
            <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
                <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                    <ArrowLeft size={16} /> Voltar ao catálogo
                </Link>
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                    <header className="border-b border-slate-200 pb-6">
                        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Mercado do Vale</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
                        <p className="mt-3 text-sm text-slate-500">Última atualização: {UPDATED_AT}</p>
                    </header>
                    <div className="mt-8 space-y-8 text-[15px] leading-7 text-slate-700">
                        {sections.map((section) => (
                            <section key={section.title}>
                                <h2 className="mb-3 text-xl font-bold text-slate-950">{section.title}</h2>
                                <div className="space-y-3">{section.content}</div>
                            </section>
                        ))}
                    </div>
                </article>
            </main>
            <LegalFooter />
        </div>
    );
}

function LegalFooter() {
    return (
        <footer className="border-t border-slate-200 bg-white">
            <nav aria-label="Documentos legais" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-slate-600">
                <Link to="/privacidade" className="hover:text-blue-700">Privacidade</Link>
                <Link to="/termos-de-uso" className="hover:text-blue-700">Termos de Uso</Link>
                <Link to="/exclusao-de-dados" className="hover:text-blue-700">Exclusão de Dados</Link>
            </nav>
        </footer>
    );
}

const Identity = () => (
    <p>
        O controlador dos dados é <strong>HANDIELSON AMORIM BONFIM 06329092427</strong>, nome fantasia
        <strong> Mercado do Vale</strong>, CNPJ <strong>34.719.515/0001-68</strong>, com endereço na Rua Abílio
        Mourato Cruz, 5, Loja C, Cohab Massangano, Petrolina/PE, CEP 56310-150. Contato do responsável por
        privacidade: <a className="font-semibold text-blue-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
);

export function PrivacyPage() {
    return <LegalPage
        title="Política de Privacidade"
        description="Como o Mercado do Vale coleta, utiliza, compartilha, protege e exclui dados pessoais."
        sections={[
            { title: '1. Quem trata seus dados', content: <Identity /> },
            {
                title: '2. Dados que podemos tratar',
                content: <>
                    <p>Conforme a sua interação conosco, podemos tratar:</p>
                    <ul className="list-disc space-y-2 pl-6">
                        <li>identificação e cadastro, como nome, e-mail, telefone, CPF ou CNPJ e credenciais protegidas;</li>
                        <li>endereço de entrega, dados do pedido, itens adquiridos, garantia, atendimento e histórico de relacionamento;</li>
                        <li>informações técnicas de acesso, como endereço IP, navegador, dispositivo, páginas visitadas e eventos de uso;</li>
                        <li>dados enviados voluntariamente em formulários, avaliações, mensagens, WhatsApp ou outros canais de atendimento;</li>
                        <li>para administradores autorizados, identificadores de contas, páginas, perfis profissionais, campanhas e permissões fornecidos pela Meta durante a conexão do Facebook/Instagram.</li>
                    </ul>
                    <p>Os dados completos do cartão não são armazenados pelo Mercado do Vale: o processamento eletrônico é realizado pelo provedor de pagamento.</p>
                </>
            },
            {
                title: '3. Finalidades e bases legais',
                content: <>
                    <p>Usamos dados para cadastrar e autenticar usuários; exibir catálogo e preços adequados; processar, entregar e acompanhar pedidos; emitir documentos e cumprir garantias; prevenir fraude; prestar atendimento; cumprir obrigações legais e fiscais; melhorar segurança e desempenho; e, quando permitido, enviar comunicações e medir resultados.</p>
                    <p>O tratamento pode se apoiar na execução de contrato ou de procedimentos solicitados, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos, no legítimo interesse avaliado com respeito aos seus direitos e, quando necessário, no consentimento.</p>
                </>
            },
            {
                title: '4. Integração com Meta (Facebook e Instagram)',
                content: <>
                    <p>A conexão com a Meta é restrita a administradores autorizados e serve para administrar ativos comerciais, criar e acompanhar campanhas e anúncios, consultar métricas e organizar conteúdo do Facebook e Instagram.</p>
                    <p>Podemos receber identificadores do usuário da Meta, nome e e-mail disponibilizados na autorização, contas de anúncio, páginas, perfis profissionais, permissões, tokens de acesso e dados de campanhas. Os tokens são armazenados de forma criptografada e não são exibidos ao público. Não vendemos esses dados.</p>
                    <p>Você pode revogar a integração nas configurações da Meta ou solicitar a desconexão e exclusão conforme nossa <Link className="font-semibold text-blue-700 hover:underline" to="/exclusao-de-dados">página de Exclusão de Dados</Link>.</p>
                </>
            },
            {
                title: '5. Compartilhamento e operadores',
                content: <p>Compartilhamos apenas o necessário com fornecedores que sustentam a operação, como hospedagem e infraestrutura, processador de pagamentos, serviços de entrega, comunicação, análise de acesso, prevenção a fraude e plataformas conectadas pelo próprio usuário, incluindo Meta. Também poderá haver compartilhamento por obrigação legal, ordem de autoridade competente ou para proteger direitos. Cada terceiro trata dados conforme sua própria política e obrigações contratuais e legais.</p>
            },
            {
                title: '6. Cookies e medição',
                content: <p>O site pode usar armazenamento local e cookies essenciais para sessão, carrinho, preferências e segurança, além de ferramentas de medição, como Google Analytics, para compreender uso e desempenho. Você pode limitar cookies no navegador, mas funções essenciais poderão deixar de operar corretamente.</p>
            },
            {
                title: '7. Segurança e retenção',
                content: <p>Adotamos medidas técnicas e administrativas compatíveis com os riscos, incluindo conexão HTTPS, controle de acesso e proteção de credenciais. Mantemos os dados somente pelo período necessário às finalidades informadas e às obrigações legais, fiscais, contábeis, de garantia e de defesa de direitos. Depois disso, eles são excluídos ou anonimizados quando aplicável.</p>
            },
            {
                title: '8. Seus direitos',
                content: <>
                    <p>Nos termos da LGPD, você pode solicitar confirmação e acesso; correção; anonimização, bloqueio ou eliminação de dados inadequados ou excessivos; portabilidade quando regulamentada; informação sobre compartilhamentos; revisão de decisões automatizadas; revogação do consentimento e informação sobre suas consequências; e eliminação de dados tratados com consentimento, observadas as hipóteses legais de conservação.</p>
                    <p>Envie a solicitação para <a className="font-semibold text-blue-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Poderemos pedir informações proporcionais para confirmar sua identidade e proteger sua conta.</p>
                </>
            },
            {
                title: '9. Crianças, alterações e contato',
                content: <p>Nossos serviços não são direcionados intencionalmente a crianças sem a participação de seu responsável. Esta política pode ser atualizada para refletir mudanças legais ou operacionais; a data da versão vigente permanecerá no topo. Dúvidas e solicitações podem ser enviadas ao contato de privacidade indicado nesta página.</p>
            },
        ]}
    />;
}

export function TermsPage() {
    return <LegalPage
        title="Termos de Uso"
        description="Regras de uso do site, catálogo, contas e serviços do Mercado do Vale."
        sections={[
            { title: '1. Identificação e aceite', content: <><Identity /><p>Ao acessar o site ou utilizar seus recursos, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não utilize as áreas que exigem cadastro ou envio de dados.</p></> },
            { title: '2. Cadastro e segurança', content: <p>Você deve fornecer dados verdadeiros, completos e atualizados, proteger suas credenciais e comunicar suspeitas de uso indevido. É proibido tentar acessar contas ou áreas restritas sem autorização, contornar controles de segurança, inserir código malicioso ou usar o serviço para fraude ou atividade ilegal.</p> },
            { title: '3. Catálogo, ofertas e disponibilidade', content: <p>Imagens e descrições procuram representar os produtos com fidelidade, mas pequenas variações de cor e apresentação podem ocorrer. Preços, condições, estoque, prazo e abrangência de entrega são confirmados no fluxo de compra ou atendimento. Erros evidentes poderão ser corrigidos, com comunicação ao consumidor e respeito aos direitos previstos na legislação brasileira.</p> },
            { title: '4. Pedidos, pagamento e entrega', content: <p>O pedido depende da confirmação de estoque, cadastro e pagamento. Transações eletrônicas podem ser processadas por provedores externos, sujeitos às validações de segurança deles. Prazos de entrega são estimativas informadas conforme destino e modalidade; eventos fora do controle razoável serão comunicados e tratados conforme a legislação aplicável.</p> },
            { title: '5. Trocas, arrependimento e garantia', content: <p>Trocas, devoluções, direito de arrependimento e garantias seguem o Código de Defesa do Consumidor, as condições apresentadas no momento da compra e as características de cada produto. Entre em contato pelos canais oficiais e preserve comprovantes e acessórios quando aplicável.</p> },
            { title: '6. Comunicações e integrações', content: <p>Podemos enviar mensagens operacionais sobre cadastro, pedidos, entrega, garantia, segurança e atendimento. Comunicações promocionais dependem da base legal aplicável e permitem oposição quando cabível. Recursos integrados a Meta, Google, WhatsApp, processadores de pagamento ou outras plataformas também estão sujeitos aos termos desses provedores.</p> },
            { title: '7. Propriedade intelectual', content: <p>Marcas, textos, fotografias, layout, software e demais conteúdos do site são protegidos por direitos de propriedade intelectual. O uso pessoal para consulta e compra é permitido; reprodução, exploração comercial, raspagem abusiva ou alteração sem autorização não são permitidas.</p> },
            { title: '8. Suspensão e responsabilidade', content: <p>Podemos restringir acesso em caso de risco à segurança, fraude, violação destes Termos ou obrigação legal. Buscamos manter o serviço disponível e seguro, mas manutenções e indisponibilidades de terceiros podem ocorrer. Nada nestes Termos exclui responsabilidades ou direitos que não possam ser afastados pela legislação de defesa do consumidor e proteção de dados.</p> },
            { title: '9. Privacidade, mudanças e lei aplicável', content: <p>O tratamento de dados é descrito na <Link className="font-semibold text-blue-700 hover:underline" to="/privacidade">Política de Privacidade</Link>. Estes Termos podem ser atualizados, com indicação da data vigente. Aplica-se a legislação brasileira, preservados o foro e os direitos assegurados ao consumidor. Dúvidas: <a className="font-semibold text-blue-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p> },
        ]}
    />;
}

export function DataDeletionPage() {
    return <LegalPage
        title="Exclusão de Dados"
        description="Instruções para solicitar exclusão de dados e remover a integração do Mercado do Vale com a Meta."
        sections={[
            { title: '1. Como solicitar', content: <>
                <p>Envie um e-mail para <a className="font-semibold text-blue-700 hover:underline" href={`mailto:${CONTACT_EMAIL}?subject=Solicitação%20de%20exclusão%20de%20dados`}>{CONTACT_EMAIL}</a> com o assunto <strong>“Solicitação de exclusão de dados”</strong>. Informe o e-mail ou telefone associado à conta e indique se deseja excluir a conta do Mercado do Vale, os dados recebidos da Meta ou ambos.</p>
                <a className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800" href={`mailto:${CONTACT_EMAIL}?subject=Solicitação%20de%20exclusão%20de%20dados`}><Mail size={17} /> Abrir solicitação por e-mail</a>
            </> },
            { title: '2. Verificação e confirmação', content: <p>Para impedir exclusões indevidas, poderemos solicitar confirmação de identidade ou de titularidade da conta usando apenas informações proporcionais ao risco. Após a validação, registraremos a solicitação, informaremos o andamento pelo e-mail de contato e confirmaremos a conclusão ou eventual necessidade de conservação legal.</p> },
            { title: '3. Dados da integração com a Meta', content: <>
                <p>Quando a solicitação incluir Facebook ou Instagram, removeremos a conexão do usuário com o app Mercado do Vale e os tokens de acesso, identificadores de perfil fornecidos na autorização e dados vinculados à integração que não precisem ser mantidos por obrigação legal ou exercício regular de direitos.</p>
                <p>Você também pode revogar o acesso diretamente na Meta: acesse <strong>Configurações e privacidade → Configurações → Apps e sites</strong>, localize o app Mercado do Vale e selecione a opção de remover. A revogação interrompe novos acessos, mas, para confirmar a exclusão dos dados já recebidos, envie também a solicitação acima.</p>
                <a className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline" href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noreferrer">Abrir Apps e sites no Facebook <ExternalLink size={15} /></a>
            </> },
            { title: '4. O que pode ser preservado', content: <p>Alguns registros podem ser mantidos de forma restrita pelo tempo exigido por obrigações legais, fiscais, contábeis, antifraude, de garantia ou para exercício regular de direitos. Nesses casos, eles não serão usados para outras finalidades incompatíveis e serão eliminados ou anonimizados quando a conservação deixar de ser necessária.</p> },
            { title: '5. Outras solicitações de privacidade', content: <p>Para acesso, correção, oposição, revogação de consentimento ou outros direitos previstos na LGPD, utilize o mesmo e-mail. Consulte também a <Link className="font-semibold text-blue-700 hover:underline" to="/privacidade">Política de Privacidade</Link>.</p> },
        ]}
    />;
}
