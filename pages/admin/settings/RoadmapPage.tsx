import React from 'react';
import { 
  Rocket, 
  CheckCircle2, 
  Clock, 
  Lightbulb, 
  Server,
  ShieldAlert,
  Settings,
  AlertCircle
} from 'lucide-react';

export const RoadmapPage = () => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
              <Rocket size={20} />
            </div>
            Roadmap & Pendências
          </h1>
          <p className="text-slate-500 mt-2">
            Acompanhamento do que foi feito, o que falta fazer e ideias futuras.
          </p>
        </div>
      </div>

      {/* INTEGRAÇÃO SYNOLOGY */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Server size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Integração Synology NAS (Vídeos)</h2>
              <p className="text-sm text-slate-500">Documentação do status de conexão dos vídeos locais para a nuvem.</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wider whitespace-nowrap self-start md:self-auto">
            Aguardando Roteador
          </span>
        </div>

        <div className="p-6 space-y-8">
          
          {/* O QUE FOI FEITO */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-500" />
              O Que Já Foi Feito (Concluído)
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Configuração do Web Station e DDNS:</strong> Criamos o diretório <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">/web/videos</code> no Synology e ativamos o portal apontando o domínio <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">mdvvideos.i234.me</code> para ele via portal reverso.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">CORS do Synology Livre:</strong> Criamos as regras de Header no Web Station para permitir que o navegador toque o MP4 dentro do site da sua loja sem barrar por política de segurança cruzada (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">Access-Control-Allow-Origin: *</code>).
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Injeção 100% Automática do URL:</strong> Programamos o *backend* (API do Supabase) para que qualquer produto salvo (manualmente ou via Bling) preencha a URL de vídeo sozinho, bastando o SKU bater com o nome do arquivo, sem precisar clicar em botões.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Botão Dinâmico na Loja (Página de Produto):</strong> O layout da loja já foi moldado para mostrar a caixinha de "Ver Vídeo" automaticamente sempre que o sistema injetar a URL do NAS.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Redirecionamento Roteador ZTE:</strong> Port Forwarding configurado com sucesso nas portas externas <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">59996</code> (HTTP) e <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">59997</code> (HTTPS) apontando para o IP <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">192.168.1.2</code>.
                </p>
              </li>
            </ul>
          </div>

          <hr className="border-slate-100" />

          {/* O QUE FALTA FAZER */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ShieldAlert size={16} className="text-rose-500" />
              Bloqueios / O Que Falta
            </h3>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> Ajustar URL Base no Sistema
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Como as portas HTTP foram redirecionadas para <code className="bg-amber-100 px-1 py-0.5 rounded">59996</code>, vá nas <strong>Configurações da Loja</strong> e atualize a URL Base do Synology para: <br/> 
                <code className="bg-amber-100 font-bold px-1 py-0.5 rounded mt-2 inline-block">http://mdvvideos.i234.me:59996/videos/</code>
              </p>
            </div>

            <ul className="space-y-3 mt-4">
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Upload dos Vídeos Físicos:</strong> Mover os arquivos reais para dentro de <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">/web/videos</code> no Synology com o nome idêntico ao SKU (ex: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">MF-SUPOR-B.mp4</code>). Hoje não existe arquivo com esse nome lá dentro nem testando localmente.
                </p>
              </li>
            </ul>
          </div>

          <hr className="border-slate-100" />

          {/* SUGESTÕES FUTURAS */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Lightbulb size={16} className="text-amber-500" />
              Sugestões Futuras p/ o Synology
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-blue-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-blue-500 text-lg">☁️</span> Túnel Cloudflare
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Caso a operadora recuse a senha do roteador, podemos instalar o <strong>Cloudflared</strong> (docker) no Synology. Isso cria um túnel direto do seu servidor pra internet, bypassando totalmente a necessidade de abrir portas no ZTE, com SSL grátis blindado pelo Cloudflare.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-purple-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-purple-500 text-lg">🎬</span> Auto-Compressão
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Usar o <strong>FFmpeg</strong> nativo do Synology pra rodar um Script: Todo vídeo "cru" é reduzido e otimizado para web automaticamente, economizando banda sua e 4G do cliente que for assistir na loja.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-green-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-green-500 text-lg">🖼️</span> Auto-Capa de Vídeo
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O NAS tira um "print" do segundo 00:03 de cada vídeo e gera uma imagem JPEG. A loja usa essa imagem leve na vitrine e só baixa o vídeo original se o cliente der o play.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-sky-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-sky-500 text-lg">💾</span> Backup Diário Automático
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Agendar uma rotina no Synology para fazer o download completo do banco de dados na Nuvem (Supabase) e dos pedidos do Bling toda noite. Seus clientes e vendas 100% seguros dentro do NAS local.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-rose-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-rose-500 text-lg">🗂️</span> Storage Off-Cloud
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Em vez de pagar armazenamento premium pro Supabase em dólar por GB, o Synology pode ser o banco de imagens principal dos produtos, PDFs de garantias e notas fiscais. Tráfego ilimitado sem custo.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-indigo-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <span className="text-indigo-500 text-lg">📊</span> BI / Dashboards Locais
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Rodar um Metabase no Docker do seu Synology. Ele conecta direto no Supabase e gera gráficos, metas de equipe e análises de lucro profundas (BI) na sua intranet gratuitamente.
                </p>
              </div>

            </div>
          </div>

        </div>
      </section>


      {/* PRÓXIMAS REGRAS DE NEGÓCIO */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Próximas Regras de Negócio (Backlog do ERP)</h2>
            <p className="text-sm text-slate-500">Funcionalidades do núcleo administrativo a serem desenvolvidas.</p>
          </div>
        </div>

        <div className="p-0">
          <div className="divide-y divide-slate-100">
            
            <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded text-slate-400 mt-1"><Clock size={16} /></div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Controle de Devoluções (RMA)</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
                    Fluxo completo de assistência técnica e devoluções. Gerar laudo, conectar com o Bling para estorno de nota fiscal, ou abater créditos na próxima compra (carteira).
                  </p>
                </div>
              </div>
              <button className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded self-start md:self-center transition-colors">
                Trabalhar em breve
              </button>
            </div>

            <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded text-slate-400 mt-1"><Clock size={16} /></div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Níveis de Permissão (ACL)</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
                    Travar telas do sistema por tipo de usuário. O Vendedor "A" não pode ver lucro, nem alterar preços, apenas gerar pedido de venda ("Vendedor Invisível").
                  </p>
                </div>
              </div>
              <button className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded self-start md:self-center transition-colors">
                Trabalhar em breve
              </button>
            </div>

            <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded text-slate-400 mt-1"><Clock size={16} /></div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Dashboard Gerencial (KPIs Reais)</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
                    Gráficos vivos na tela inicial mostrando lucro bruto diário, curva ABC de produtos parados no estoque (para queima) e taxa de conversão do catálogo online.
                  </p>
                </div>
              </div>
              <button className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded self-start md:self-center transition-colors">
                Trabalhar em breve
              </button>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};

export default RoadmapPage;
