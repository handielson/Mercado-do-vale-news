import React from 'react';
import {
  Rocket,
  CheckCircle2,
  Clock,
  Settings,
  AlertCircle,
  Package,
  Database,
  ArrowRight
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
      {/* IMPORTAÇÃO LEGADA MV-GESTÃO */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Importação do MV-Gestão (Sistema Legado)</h2>
              <p className="text-sm text-slate-500">Histórico de vendas migrado do sistema antigo para o novo ERP.</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wider whitespace-nowrap self-start md:self-auto">
            Concluído — Abr/2026
          </span>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-500" />
              O Que Foi Feito
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p><strong className="text-slate-800">208 vendas importadas</strong> do MV-Gestão para o novo sistema, vinculadas aos clientes pelo CPF. As 27 restantes não tinham cliente cadastrado no novo sistema.</p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p><strong className="text-slate-800">Dados do aparelho preservados:</strong> IMEI 1, IMEI 2, modelo, marca, cor, RAM e memória salvos em cada item da venda via campos <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">product_sku</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">product_name</code> e <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">product_brand</code>.</p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p><strong className="text-slate-800">Botão "Ver Comprovante" no histórico do cliente:</strong> Gera PDF do comprovante de venda com dados do aparelho diretamente no browser (sem depender de CDN), usando os dados já salvos no banco.</p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p><strong className="text-slate-800">Termo de Garantia corrigido:</strong> Para vendas importadas, o termo agora exibe corretamente IMEI, modelo e marca lidos dos campos do item, sem exigir produto cadastrado no catálogo.</p>
              </li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2 mb-2">
              <AlertCircle size={15} /> Pendência — Migração Supabase
            </h4>
            <p className="text-sm text-amber-700">
              As migrations <code className="bg-amber-100 px-1 rounded text-xs">20260414000001</code> e <code className="bg-amber-100 px-1 rounded text-xs">20260414000002</code> foram criadas mas ainda precisam ser aplicadas no Supabase Dashboard (SQL Editor) para adicionar as colunas <code className="bg-amber-100 px-1 rounded text-xs">legacy_sale_id</code>, <code className="bg-amber-100 px-1 rounded text-xs">product_specs</code>, <code className="bg-amber-100 px-1 rounded text-xs">product_brand</code> e <code className="bg-amber-100 px-1 rounded text-xs">product_model</code>. Após aplicar, reimportar as vendas para capturar RAM, memória e cor corretamente.
            </p>
          </div>
        </div>
      </section>

      {/* ARQUITETURA DE DADOS — VPS vs SUPABASE */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Arquitetura de Dados — VPS vs Supabase</h2>
              <p className="text-sm text-slate-500">Mapa atual de onde cada módulo busca/salva dados. Controlado em <code className="bg-slate-200 px-1 rounded text-xs">config/migration.ts</code>.</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full border border-blue-200 uppercase tracking-wider whitespace-nowrap self-start md:self-auto">
            Migração em andamento
          </span>
        </div>
        <div className="p-6 space-y-6">

          {/* Grid VPS vs Supabase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* VPS MySQL - já migrados */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="font-bold text-emerald-800 text-sm">VPS MySQL — <code className="font-mono text-xs">api.xiaomipetrolina.com.br</code></h4>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { module: 'products', label: 'Produtos', detail: 'Catálogo, estoque, preços, variações, SKU' },
                  { module: 'categories', label: 'Categorias', detail: 'Árvore de categorias e multi-categoria' },
                  { module: 'brands', label: 'Marcas', detail: 'Marcas de produtos' },
                  { module: 'versions', label: 'Versões', detail: 'Variações de produto (cor, RAM, memória)' },
                  { module: 'banners', label: 'Banners', detail: 'Carrossel do storefront' },
                  { module: 'shipping', label: 'Entrega', detail: 'Taxas e zonas de entrega' },
                  { module: 'coupons', label: 'Cupons', detail: 'Cupons de desconto' },
                  { module: 'paymentFees', label: 'Taxas', detail: 'Taxas por forma de pagamento' },
                  { module: 'company', label: 'Empresa', detail: 'Nome, CNPJ, horários, template garantia' },
                ].map(({ module, label, detail }) => (
                  <div key={module} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <code className="text-rose-600 bg-slate-100 px-1 rounded">{module}</code>
                      <p className="text-slate-500 mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supabase - ainda não migrados */}
            <div className="border border-amber-200 rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="font-bold text-amber-800 text-sm">Supabase PostgreSQL — <code className="font-mono text-xs">cqbdyxxzm...supabase.co</code></h4>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { module: 'customers', label: 'Clientes', detail: 'Cadastro, CPF, endereço. Usa Supabase Auth para login no storefront — migração requer solução de autenticação alternativa' },
                  { module: 'orders', label: 'Pedidos', detail: 'Pedidos online do storefront (status, itens, entrega)' },
                  { module: 'sales', label: 'Vendas / PDV', detail: 'Histórico de vendas do caixa físico e importações do MV-Gestão' },
                  { module: 'pdv', label: 'Caixa (PDV)', detail: 'Abertura/fechamento de caixa, sangrias e suprimentos' },
                ].map(({ module, label, detail }) => (
                  <div key={module} className="flex items-start gap-2 text-xs">
                    <Clock size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <code className="text-rose-600 bg-slate-100 px-1 rounded">{module}</code>
                      <p className="text-slate-500 mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border-t border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-700"><strong>Prioridade de migração:</strong> orders → sales/pdv → customers (último, pois depende de auth).</p>
              </div>
            </div>
          </div>

          {/* Endpoints principais da VPS */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Endpoints principais da VPS</h3>
            <div className="bg-slate-900 rounded-xl p-4 space-y-1.5 font-mono text-xs overflow-x-auto">
              {[
                ['GET/POST', '/products', 'Catálogo de produtos (MySQL)'],
                ['GET/POST', '/categories', 'Categorias e sub-categorias'],
                ['GET',      '/brands', 'Marcas de produtos'],
                ['GET/POST', '/banners', 'Banners do carrossel'],
                ['GET/POST', '/company-settings', 'Configurações da empresa'],
                ['GET/POST', '/shipping', 'Taxas de entrega'],
                ['GET/POST', '/coupons', 'Cupons de desconto'],
                ['GET/POST', '/synology/files?folder=imagens|videos|arquivos', 'CDN Synology — lista arquivos'],
                ['POST',     '/synology/upload?folder=...', 'CDN Synology — upload de arquivo'],
                ['GET',      '/video/:filename', 'Streaming de vídeo do Synology'],
                ['GET',      '/images/:filename', 'Proxy de imagem do Synology'],
                ['GET',      '/check-video?sku=SKU', 'Verifica se produto tem vídeo no CDN'],
              ].map(([method, path, desc]) => (
                <div key={path} className="flex items-start gap-3">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${method.includes('POST') ? 'bg-emerald-900 text-emerald-300' : 'bg-blue-900 text-blue-300'}`}>
                    {method.split('/')[0]}
                  </span>
                  <span className="text-green-400 shrink-0">{path}</span>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Proxy de roteamento */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <ArrowRight size={15} className="text-blue-500" />
              Como o Frontend Roteia as Chamadas
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p><strong>Desenvolvimento (localhost:3000):</strong> Vite proxy roteia <code className="bg-slate-200 px-1 rounded">/vps-proxy?path=...</code> → <code className="bg-slate-200 px-1 rounded">api.xiaomipetrolina.com.br</code> com header <code className="bg-slate-200 px-1 rounded">x-sync-key</code> injetado automaticamente.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p><strong>Produção (Vercel):</strong> <code className="bg-slate-200 px-1 rounded">vpsClient.ts</code> usa <code className="bg-slate-200 px-1 rounded">VPS_PROXY_BASE</code> = <code className="bg-slate-200 px-1 rounded">https://api.xiaomipetrolina.com.br</code> diretamente. Header <code className="bg-slate-200 px-1 rounded">x-sync-key</code> vem de <code className="bg-slate-200 px-1 rounded">VITE_VPS_SYNC_KEY</code> (env var no Vercel).</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p><strong>Autenticação VPS:</strong> Header <code className="bg-slate-200 px-1 rounded">x-sync-key: {'{SYNC_SECRET}'}</code> em todas as chamadas. Valor compartilhado entre <code className="bg-slate-200 px-1 rounded">.env</code> do servidor e <code className="bg-slate-200 px-1 rounded">VITE_VPS_SYNC_KEY</code> do frontend.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <p><strong>Supabase (clientes/pedidos/vendas):</strong> Chamadas diretas via <code className="bg-slate-200 px-1 rounded">@supabase/supabase-js</code> com <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_URL</code> + <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.</p>
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
