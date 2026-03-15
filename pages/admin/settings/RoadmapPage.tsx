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
            Túnel Instalado — Aguardando DNS
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
                  <strong className="text-slate-800">Configuração do Web Station e DDNS:</strong> Diretório <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">/web/videos</code> criado no Synology, portal Web Station na porta 80, CORS habilitado (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">Access-Control-Allow-Origin: *</code>) e DDNS em <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">mdvvideos.i234.me</code>.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">CGNAT Identificado (Leste/Vero):</strong> A operadora usa NAT de operadora (WAN IP <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">100.64.32.168</code>), bloqueando acesso externo mesmo com port forwarding e DMZ no roteador ZTE. Essa é a causa raiz do problema de acesso externo.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Cloudflare Tunnel instalado no Synology:</strong> Binário <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">cloudflared</code> v2026.3.0 (linux_amd64) instalado em <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">/usr/local/bin/cloudflared</code> via Agendador de Tarefas (root). Exit code: 0.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Túnel <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">mdv-videos</code> criado e conectado:</strong> ID <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">7680ed44-a7a9-4700-a37e-2026b3653360</code>, edge de São Paulo (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">gru08/gru17/gru19/gru21</code>), IP de saída <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">45.168.152.106</code>.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Zona mercadodovale.com.br criada no Cloudflare (conta Handielson):</strong> Account ID <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">8114558994545fcb1dac3536aad408a4</code>, Zone ID <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">e9e17e9e9d6d9ac89cf99f09fd70c34</code>, NS atribuídos: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">carlos.ns.cloudflare.com</code> + <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">jill.ns.cloudflare.com</code>.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Todos registros DNS já na zona Cloudflare:</strong> CNAME Tunnel (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">videos → mdv-videos</code>), MX ×2, A mail → 31.57.174.13, DKIM, SPF e registros cPanel/ftp/webmail importados. Zona pronta, só falta ativar os NS.
                </p>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p>
                  <strong className="text-slate-800">Tarefas no Agendador Synology:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">instalar-cloudflared</code> (instala e inicia o túnel) e <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-rose-600">update-tunnel-config</code> (atualiza config com múltiplos domínios). Ambas como root.
                </p>
              </li>
            </ul>
          </div>

          <hr className="border-slate-100" />

          {/* INFRAESTRUTURA ATUAL */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Settings size={16} className="text-blue-500" />
              Infraestrutura Atual Instalada
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🖥️ Synology NAS</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><span className="font-semibold">IP local:</span> <code className="bg-slate-100 px-1 rounded">192.168.1.2</code></li>
                  <li><span className="font-semibold">QuickConnect:</span> <code className="bg-slate-100 px-1 rounded">handielson.direct.quickconnect.to:5001</code></li>
                  <li><span className="font-semibold">cloudflared:</span> <code className="bg-slate-100 px-1 rounded">/usr/local/bin/cloudflared</code> v2026.3.0</li>
                  <li><span className="font-semibold">Credenciais túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/7680ed44-...json</code></li>
                  <li><span className="font-semibold">Config túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/config.yml</code></li>
                  <li><span className="font-semibold">Log túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/tunnel.log</code></li>
                  <li><span className="font-semibold">Vídeos:</span> <code className="bg-slate-100 px-1 rounded">/web/videos/</code> (Web Station porta 80)</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">☁️ Cloudflare Tunnel</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><span className="font-semibold">Conta:</span> Handielson@gmail.com</li>
                  <li><span className="font-semibold">Túnel:</span> <code className="bg-slate-100 px-1 rounded">mdv-videos</code></li>
                  <li><span className="font-semibold">ID:</span> <code className="bg-slate-100 px-1 rounded">7680ed44-a7a9-4700-a37e-2026b3653360</code></li>
                  <li><span className="font-semibold">Edge ativo:</span> São Paulo (gru08/gru17/gru19/gru21)</li>
                  <li><span className="font-semibold">NS desta conta:</span> <code className="bg-slate-100 px-1 rounded">carlos.ns.cloudflare.com</code></li>
                  <li><span className="font-semibold">NS desta conta:</span> <code className="bg-slate-100 px-1 rounded">jill.ns.cloudflare.com</code></li>
                  <li><span className="font-semibold">Zone ID:</span> <code className="bg-slate-100 px-1 rounded">e9e17e9e9d6d9ac89cf99f09fd70c34</code></li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🌐 Domínios (GoDaddy)</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><span className="font-semibold">mercadodovale.com.br NS:</span> amos + nora (outra conta CF) — site ativo</li>
                  <li><span className="font-semibold">mercadodovale.com NS:</span> ns77 + ns78 (GoDaddy) — só redireciona</li>
                  <li><span className="font-semibold">xiaomipetrolina.com.br NS:</span> ns77 + ns78 (GoDaddy) — em construção</li>
                  <li className="text-amber-700 font-semibold pt-1">⚠️ Email ativo: contato@mercadodovale.com.br → 31.57.174.13</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🚦 Portas Liberadas (Operadora)</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><code className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">59996</code> → HTTP → NAS :80</li>
                  <li><code className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">59997</code> → HTTPS → NAS :443</li>
                  <li><code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">60532</code> → Livre</li>
                  <li className="text-slate-500 text-xs mt-1">Configurado no ZTE, mas inutilizável externos por CGNAT.</li>
                </ul>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* BLOQUEIO ATUAL */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ShieldAlert size={16} className="text-rose-500" />
              Por Que Ainda Não Funciona
            </h3>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-3">
              <h4 className="font-semibold text-rose-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> Zona mercadodovale.com.br "Pending" no Cloudflare
              </h4>
              <p className="text-sm text-rose-700 mt-2">
                A zona exige NS <code className="bg-rose-100 px-1 rounded">carlos</code> + <code className="bg-rose-100 px-1 rounded">jill</code>, mas o domínio .com.br está em uso ativo — troca de NS agora pode derrubar o site. <br/>
                O <code className="bg-rose-100 px-1 rounded">mercadodovale.com</code> foi testado via CNAME no GoDaddy, mas o Cloudflare Tunnel só roteia tráfego de domínios <em>dentro da conta</em> — CNAME externo isolado não é suficiente.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> Registro <code className="bg-amber-100 px-1 rounded">mail</code> com Proxy ligado
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Na zona Cloudflare, o registro <code className="bg-amber-100 px-1 rounded">A mail → 31.57.174.13</code> está "Proxied". Antes de ativar os NS, mudar para <strong>DNS only</strong> (nuvem cinza) para não quebrar o email SMTP do <code className="bg-amber-100 px-1 rounded">contato@mercadodovale.com.br</code>.
              </p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* PRÓXIMOS PASSOS */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Rocket size={16} className="text-indigo-500" />
              Para Ativar — Passos Exatos (escolha uma opção)
            </h3>
            <div className="space-y-4">
              <div className="border border-indigo-200 rounded-lg overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200">
                  <h4 className="font-bold text-indigo-800 text-sm">🅰️ Opção A — Usar mercadodovale.com (mais rápida, menor risco)</h4>
                  <p className="text-xs text-indigo-600 mt-0.5">O .com só faz redirect para .com.br. Pode mover para Cloudflare replicando o redirect gratuitamente.</p>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    'No GoDaddy → domínio mercadodovale.com → alterar NS de ns77/ns78 para carlos.ns.cloudflare.com + jill.ns.cloudflare.com',
                    'No Cloudflare (conta Handielson), criar Redirect Rule: mercadodovale.com/* → https://mercadodovale.com.br/$1 (301) para substituir o redirect antigo',
                    'Aguardar propagação DNS (30min – 2h). Cloudflare ativa a zona automaticamente ao detectar os NS corretos.',
                    'No Synology: executar tarefa "update-tunnel-config" no Agendador de Tarefas',
                    'Testar: https://videos.mercadodovale.com/videos/ME-SUPOR-B.mp4',
                    'Atualizar URL base da loja para: https://videos.mercadodovale.com/videos/',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-emerald-200 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200">
                  <h4 className="font-bold text-emerald-800 text-sm">🅱️ Opção B — Usar xiaomipetrolina.com.br (quando for ao ar)</h4>
                  <p className="text-xs text-emerald-600 mt-0.5">Mover o domínio final da loja para Cloudflare — CDN + Túnel + SSL tudo integrado.</p>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    'Adicionar xiaomipetrolina.com.br ao Cloudflare (conta Handielson@gmail.com)',
                    'No GoDaddy → xiaomipetrolina.com.br → mudar NS de ns77/ns78 para carlos.ns.cloudflare.com + jill.ns.cloudflare.com',
                    'Aguardar propagação DNS e ativação no Cloudflare',
                    'Executar no Windows: cloudflared tunnel route dns mdv-videos videos.xiaomipetrolina.com.br',
                    'No Synology: executar tarefa "update-tunnel-config" (ela já inclui o hostname no config.yml)',
                    'Testar: https://videos.xiaomipetrolina.com.br/videos/ME-SUPOR-B.mp4',
                    'Atualizar URL base da loja para: https://videos.xiaomipetrolina.com.br/videos/',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">📄 Config atual do túnel (/volume1/.cloudflared/config.yml)</h4>
                <pre className="text-xs text-green-300 overflow-x-auto leading-relaxed">{`tunnel: 7680ed44-a7a9-4700-a37e-2026b3653360\ncredentials-file: /volume1/.cloudflared/7680ed44-...json\ningress:\n  - hostname: videos.mercadodovale.com.br\n    service: http://127.0.0.1:80\n  - hostname: videos.mercadodovale.com\n    service: http://127.0.0.1:80\n  - service: http_status:404`}</pre>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SUGESTÕES FUTURAS */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Lightbulb size={16} className="text-amber-500" />
              Sugestões Futuras p/ o Synology
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-purple-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-purple-500 text-lg">🎬</span> Auto-Compressão</h4>
                <p className="text-xs text-slate-600 leading-relaxed">FFmpeg nativo do Synology para comprimir vídeos crus automaticamente, economizando banda e melhorando carregamento no 4G do cliente.</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-green-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-green-500 text-lg">🖼️</span> Auto-Capa de Vídeo</h4>
                <p className="text-xs text-slate-600 leading-relaxed">NAS gera JPEG do frame 00:03 de cada vídeo. Loja exibe imagem leve na vitrine e baixa o vídeo só quando o cliente der play.</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-sky-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-sky-500 text-lg">💾</span> Backup Diário</h4>
                <p className="text-xs text-slate-600 leading-relaxed">Rotina noturna para backup do Supabase e pedidos Bling dentro do NAS. Segurança local caso a nuvem tenha indisponibilidade.</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-rose-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-rose-500 text-lg">🗂️</span> Storage Off-Cloud</h4>
                <p className="text-xs text-slate-600 leading-relaxed">NAS como banco de imagens e PDFs, eliminando custo de armazenamento premium no Supabase (cobrança em dólar por GB).</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-indigo-300 hover:shadow-md transition-all">
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-indigo-500 text-lg">📊</span> BI Local</h4>
                <p className="text-xs text-slate-600 leading-relaxed">Metabase no Docker do Synology conectando no Supabase para dashboards de lucro, curva ABC e conversão na intranet gratuitamente.</p>
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
