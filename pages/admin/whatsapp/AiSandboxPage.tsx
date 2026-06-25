import React from 'react';
import { 
  Send, 
  RefreshCw, 
  Sliders, 
  Download, 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Cpu, 
  Layers, 
  Play, 
  Clock, 
  AlertOctagon,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../../services/autoResponderService';

type ChatMessage = {
  id: string;
  role: 'customer' | 'bot' | 'system';
  text: string;
  timestamp: string;
  metrics?: {
    totalTime: number;
    skillsTime: number;
  };
};

type TraceItem = {
  sessionId: string;
  conversationId: string | null;
  createdAt: string;
  kernel: {
    message: string;
    channel: string;
    sender: string;
  };
  skills: Array<{ name: string; duration: number; timestamp: string }>;
  actions: Array<{
    name: string;
    query: string;
    params: any[];
    duration: number;
    timestamp: string;
    success: boolean;
    error: string | null;
  }>;
  policies: Array<{
    name: string;
    approved: boolean;
    violation: string | null;
    message: string;
  }>;
  timings: {
    total: number;
    kernel: number;
    skills: number;
    actions: number;
    policies: number;
  };
  warnings: string[];
  errors: string[];
};

type SandboxResponse = {
  response: string;
  context: any;
  routing: any;
  metrics: {
    totalTime: number;
    kernelTime: number;
    skillsTime: number;
    actionsTime: number;
    policiesTime: number;
  };
  trace: TraceItem;
  logs: Array<{
    timestamp: string;
    level: string;
    source: string;
    event: string;
    duration: number;
    details: any;
  }>;
};

const SKILLS_LIST = [
  { key: 'saudacao', label: 'Saudação' },
  { key: 'catalogo', label: 'Catálogo' },
  { key: 'produto', label: 'Produto' },
  { key: 'escolha_memoria', label: 'Escolha de Memória' },
  { key: 'escolha_cor', label: 'Escolha de Cor' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'resumo', label: 'Resumo' },
  { key: 'finalizacao', label: 'Finalização do Pedido' }
];

export function AiSandboxPage() {
  const [channel, setChannel] = React.useState('whatsapp');
  const [sender, setSender] = React.useState(() => `sandbox-${Math.floor(100000 + Math.random() * 900000)}`);
  const [draft, setDraft] = React.useState('');
  const [mockMode, setMockMode] = React.useState(true);
  
  // Feature Flags: active by default
  const [activeSkills, setActiveSkills] = React.useState<Record<string, boolean>>(() => {
    const flags: Record<string, boolean> = {};
    SKILLS_LIST.forEach(s => {
      flags[s.key] = true;
    });
    return flags;
  });

  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      text: 'Ambiente de Homologação AI Sandbox. Digite uma mensagem à esquerda para iniciar o atendimento simulado.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'context' | 'trace' | 'actions' | 'policies' | 'logs' | 'performance'>('context');
  
  // Keep trace details from the latest run
  const [latestResult, setLatestResult] = React.useState<SandboxResponse | null>(null);
  // Accumulate all runs in this session for exporter
  const [sessionHistory, setSessionHistory] = React.useState<any[]>([]);

  const chatEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleToggleSkill = (key: string) => {
    setActiveSkills(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSendMessage = async () => {
    const text = draft.trim();
    if (!text || loading) return;

    setDraft('');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'customer',
      text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response: SandboxResponse = await autoResponderService.sendSandboxMessage({
        message: text,
        channel,
        sender,
        options: {
          mockMode,
          activeSkills
        }
      });

      setLatestResult(response);
      setSessionHistory(prev => [...prev, { timestamp: new Date().toISOString(), ...response }]);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: response.response || '*(Sem resposta textual / Silêncio)*',
        timestamp: new Date().toLocaleTimeString(),
        metrics: {
          totalTime: response.metrics.totalTime,
          skillsTime: response.metrics.skillsTime
        }
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      toast.error('Falha ao processar mensagem');
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          text: `Erro de execução: ${err.message || 'Erro desconhecido'}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await autoResponderService.resetSandboxChat({ channel, sender });
      setLatestResult(null);
      setSessionHistory([]);
      setMessages([
        {
          id: `welcome-reset-${Date.now()}`,
          role: 'system',
          text: 'Conversa e contexto reiniciados com sucesso. O simulador está pronto para uma nova interação.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      toast.success('Simulação reiniciada');
    } catch (err: any) {
      toast.error(`Falha ao reiniciar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSession = () => {
    if (sessionHistory.length === 0) {
      toast.error('Nenhuma transação registrada nesta sessão');
      return;
    }

    const payload = {
      metadata: {
        channel,
        sender,
        exportedAt: new Date().toISOString(),
        mockMode,
        activeSkills
      },
      history: sessionHistory
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdv-sandbox-session-${sender}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Sessão exportada com sucesso!');
  };

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20 px-4">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-800">
            <Cpu className="text-teal-600" size={28} />
            AI Sandbox
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/15">
              Fase 1 (v1.0)
            </span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Ambiente interno de homologação do Mercado do Vale AI Framework. Teste fluxos, analise regras e monitore a telemetria em tempo real.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleReset}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Reiniciar Contexto
          </button>
          <button
            onClick={handleExportSession}
            disabled={sessionHistory.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Download size={16} />
            Exportar Sessão (JSON)
          </button>
        </div>
      </div>

      {/* Main Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SIMULATOR (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Channel and Sender configuration */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Configuração da Simulação</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Canal</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="telegram">Telegram</option>
                  <option value="webchat">WebChat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Remetente (Sender)</label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            {/* Toggle Database Mock */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Database size={16} className="text-slate-400" />
                Modo Banco de Dados Simulante (Mock Mode)
              </span>
              <button
                role="switch"
                aria-checked={mockMode}
                onClick={() => setMockMode(!mockMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-1 focus:ring-teal-500 ${
                  mockMode ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    mockMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Interactive Chat Widget */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 shadow-sm flex flex-col h-[480px]">
            <div className="border-b border-slate-200 bg-white px-4 py-3 rounded-t-xl flex justify-between items-center">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
                Console de Conversa
              </span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{channel}</span>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === 'customer'
                      ? 'justify-end'
                      : m.role === 'bot'
                        ? 'justify-start'
                        : 'justify-center'
                  }`}
                >
                  {m.role === 'system' ? (
                    <div className="max-w-[90%] rounded-lg bg-amber-50 border border-amber-100 p-3 text-center text-xs font-semibold text-amber-800 shadow-sm leading-relaxed">
                      {m.text}
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm border ${
                        m.role === 'customer'
                          ? 'bg-slate-800 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-medium">{m.text}</div>
                      
                      <div className="mt-1 flex items-center justify-between gap-4 text-[10px] opacity-60 font-semibold">
                        <span>{m.timestamp}</span>
                        {m.metrics && (
                          <span>Skill: {m.metrics.skillsTime}ms / Total: {m.metrics.totalTime}ms</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400 shadow-sm flex items-center gap-2">
                    <RefreshCw className="animate-spin text-teal-600" size={14} />
                    Kernel processando fluxo...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* User typing area */}
            <div className="border-t border-slate-200 bg-white p-3 rounded-b-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  disabled={loading}
                  placeholder="Envie uma mensagem simulando o cliente..."
                  className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !draft.trim()}
                  className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors shadow-sm"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Feature Flags / Skills switches */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="text-teal-600" size={18} />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Feature Flags (Skills Ativas)</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Desative skills dinamicamente para simular o redirecionamento automático do Kernel para a Saudação padrão.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SKILLS_LIST.map((skill) => (
                <label
                  key={skill.key}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-600">{skill.label}</span>
                  <input
                    type="checkbox"
                    checked={activeSkills[skill.key] !== false}
                    onChange={() => handleToggleSkill(skill.key)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: TECHNICAL PANEL (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-[750px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          
          {/* Tab Navigation header */}
          <div className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto">
            {[
              { id: 'context', label: 'Contexto', icon: Layers },
              { id: 'trace', label: 'Trace', icon: Play },
              { id: 'actions', label: 'Actions', icon: Database },
              { id: 'policies', label: 'Policies', icon: CheckCircle2 },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'performance', label: 'Performance', icon: Activity }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase border-b-2 tracking-wider transition-colors outline-none whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-teal-600 text-teal-600 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-955 text-slate-100 font-mono text-xs">
            
            {!latestResult ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <HelpCircle size={32} className="text-slate-600" />
                <p className="font-semibold text-sm">Nenhum trace gerado ainda</p>
                <p className="text-xs">Inicie a conversa simulada para inspecionar os detalhes técnicos.</p>
              </div>
            ) : (
              <>
                {/* 1. CONTEXT TAB */}
                {activeTab === 'context' && (
                  <pre className="whitespace-pre-wrap select-all">
                    {JSON.stringify(latestResult.context, null, 2)}
                  </pre>
                )}

                {/* 2. TRACE TAB */}
                {activeTab === 'trace' && (
                  <div className="space-y-4 font-sans select-text">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-2">Meta da Transação</p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                        <div><span className="text-slate-500">Session ID:</span> <span className="text-teal-400 font-mono">{latestResult.trace.sessionId}</span></div>
                        <div><span className="text-slate-500">Conversation ID:</span> <span className="text-teal-400 font-mono">{latestResult.trace.conversationId}</span></div>
                        <div><span className="text-slate-500">Timestamp:</span> <span className="text-slate-300">{new Date(latestResult.trace.createdAt).toLocaleString()}</span></div>
                        <div><span className="text-slate-500">Origem:</span> <span className="text-slate-300 uppercase">{latestResult.trace.kernel.channel} ({latestResult.trace.kernel.sender})</span></div>
                      </div>
                    </div>

                    {/* Sequential workflow timeline */}
                    <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-4 pt-1">
                      {/* Message received */}
                      <div className="relative">
                        <span className="absolute -left-[21px] top-1.5 bg-slate-900 border border-slate-700 h-3.5 w-3.5 rounded-full flex items-center justify-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                        </span>
                        <div className="text-xs font-semibold">
                          <span className="text-slate-500">[Kernel]</span> Mensagem recebida: <span className="text-slate-300 italic">"{latestResult.trace.kernel.message}"</span>
                        </div>
                      </div>

                      {/* Skill Routing */}
                      {latestResult.trace.skills.map((s, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[21px] top-1.5 bg-slate-900 border border-slate-700 h-3.5 w-3.5 rounded-full flex items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          </span>
                          <div className="text-xs font-semibold">
                            <span className="text-slate-500">[Skill]</span> Executou flow <span className="text-amber-400 font-mono font-bold uppercase">{s.name}</span> em <span className="text-slate-300">{s.duration}ms</span>
                          </div>
                        </div>
                      ))}

                      {/* Actions executed */}
                      {latestResult.trace.actions.map((a, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[21px] top-1.5 bg-slate-900 border border-slate-700 h-3.5 w-3.5 rounded-full flex items-center justify-center">
                            <span className={`h-1.5 w-1.5 rounded-full ${a.success ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          </span>
                          <div className="text-xs font-semibold">
                            <span className="text-slate-500">[Action]</span> Chamou <span className="text-indigo-400 font-mono font-bold">{a.name}</span> em <span className="text-slate-300">{a.duration}ms</span>
                            {a.error && <p className="text-red-400 text-[11px] font-mono mt-0.5">Erro: {a.error}</p>}
                          </div>
                        </div>
                      ))}

                      {/* Policies validated */}
                      {latestResult.trace.policies.map((p, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[21px] top-1.5 bg-slate-900 border border-slate-700 h-3.5 w-3.5 rounded-full flex items-center justify-center">
                            <span className={`h-1.5 w-1.5 rounded-full ${p.approved ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          </span>
                          <div className="text-xs font-semibold">
                            <span className="text-slate-500">[Policy]</span> Validação <span className="text-slate-300 font-mono">{p.name}</span>: <span className={p.approved ? 'text-emerald-400' : 'text-red-400 font-bold'}>{p.approved ? 'APROVADO' : `REJEITADO (${p.violation})`}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Warnings list */}
                    {latestResult.trace.warnings.length > 0 && (
                      <div className="p-3 bg-amber-955/20 border border-amber-900/50 rounded-lg text-amber-200">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2">
                          <AlertTriangle size={14} className="text-amber-500" />
                          Avisos do Kernel ({latestResult.trace.warnings.length})
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          {latestResult.trace.warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Errors list */}
                    {latestResult.trace.errors.length > 0 && (
                      <div className="p-3 bg-red-955/20 border border-red-900/50 rounded-lg text-red-200">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2">
                          <AlertOctagon size={14} className="text-red-500" />
                          Erros Fatais / Violações ({latestResult.trace.errors.length})
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          {latestResult.trace.errors.map((e, idx) => (
                            <li key={idx} className="font-semibold">{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. ACTIONS TAB */}
                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    {latestResult.trace.actions.length === 0 ? (
                      <p className="text-slate-500 text-center py-6">Nenhuma Action persistente ou de banco executada nesta rodada.</p>
                    ) : (
                      latestResult.trace.actions.map((act, index) => (
                        <div key={index} className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-indigo-400 font-bold">{act.name}</span>
                            <span className="text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">{act.duration}ms</span>
                          </div>
                          
                          <p className="text-slate-500 text-[10px] mb-1 font-bold uppercase">Query SQL / Lógica</p>
                          <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {act.query}
                          </pre>
                          
                          {act.params && act.params.length > 0 && (
                            <div className="mt-2">
                              <p className="text-slate-500 text-[10px] mb-1 font-bold uppercase">Parâmetros (Bind Values)</p>
                              <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono text-[11px] overflow-x-auto">
                                {JSON.stringify(act.params, null, 2)}
                              </pre>
                            </div>
                          )}

                          {act.error && (
                            <div className="mt-2 text-red-400 bg-red-955/20 p-2 rounded border border-red-900/30 font-semibold">
                              Erro: {act.error}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. POLICIES TAB */}
                {activeTab === 'policies' && (
                  <div className="space-y-3">
                    {latestResult.trace.policies.map((p, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          p.approved
                            ? 'bg-emerald-955/10 border-emerald-900/30 text-emerald-200'
                            : 'bg-red-955/10 border-red-900/30 text-red-200'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs opacity-75 mt-0.5">{p.message}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-extrabold tracking-wider ${
                            p.approved
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {p.approved ? 'PASSED' : `FAILED (${p.violation})`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5. LOGS TAB */}
                {activeTab === 'logs' && (
                  <div className="space-y-1.5">
                    {latestResult.logs.map((log, index) => (
                      <div key={index} className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] leading-relaxed">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${
                                log.level === 'INFO'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : log.level === 'WARNING'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {log.level}
                            </span>
                            <span className="text-slate-400 font-bold">{log.source} &rarr; {log.event}</span>
                          </div>
                          {log.duration > 0 && <span className="text-slate-500 font-semibold">{log.duration}ms</span>}
                        </div>
                        {log.details && (
                          <pre className="mt-1 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap select-all bg-slate-950 p-1.5 rounded">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. PERFORMANCE TAB */}
                {activeTab === 'performance' && (
                  <div className="space-y-6 select-none font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Metric Card 1: Total execution time */}
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tempo Total de Resposta</p>
                          <h4 className="text-2xl font-black text-teal-400 mt-1">{latestResult.metrics.totalTime} <span className="text-sm font-semibold">ms</span></h4>
                        </div>
                        <Clock size={32} className="text-teal-600" />
                      </div>

                      {/* Metric Card 2: Actions time */}
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tempo em Consultas/Ações</p>
                          <h4 className="text-2xl font-black text-indigo-400 mt-1">{latestResult.metrics.actionsTime} <span className="text-sm font-semibold">ms</span></h4>
                        </div>
                        <Database size={32} className="text-indigo-600" />
                      </div>

                    </div>

                    {/* Breakdown bars */}
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                      <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Breakdown das Operações</h4>
                      
                      <div className="space-y-4">
                        {[
                          { label: 'Universal Kernel (Geral / IO)', val: latestResult.metrics.kernelTime, max: latestResult.metrics.totalTime, color: 'bg-slate-400' },
                          { label: 'Skills Execution (Motor Cognitivo)', val: latestResult.metrics.skillsTime, max: latestResult.metrics.totalTime, color: 'bg-amber-500' },
                          { label: 'Actions Execution (Service Persistência)', val: latestResult.metrics.actionsTime, max: latestResult.metrics.totalTime, color: 'bg-indigo-500' },
                          { label: 'Policy Engine (Validações)', val: latestResult.metrics.policiesTime, max: latestResult.metrics.totalTime, color: 'bg-emerald-500' }
                        ].map((bar, index) => {
                          const percentage = bar.max > 0 ? (bar.val / bar.max) * 100 : 0;
                          return (
                            <div key={index}>
                              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                                <span>{bar.label}</span>
                                <span>{bar.val}ms ({percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                                <div className={`h-full ${bar.color} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

export default AiSandboxPage;
