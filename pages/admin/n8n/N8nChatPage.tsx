import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  MessageCircle,
  PlayCircle,
  Server,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

const N8N_URL = 'https://n8n.mercadodovale.com.br';
const EVOLUTION_URL = 'https://api-wa-test.mercadodovale.com.br';
const WEBHOOK_PATH = '/webhook/whatsapp-chat-test';

const statusItems = [
  {
    label: 'n8n',
    value: N8N_URL,
    detail: 'Fluxos do chat conversacional',
    icon: <Workflow size={18} />,
  },
  {
    label: 'Evolution Teste',
    value: EVOLUTION_URL,
    detail: 'Conexao do numero de teste',
    icon: <Server size={18} />,
  },
  {
    label: 'Webhook',
    value: WEBHOOK_PATH,
    detail: 'Entrada do evento do WhatsApp',
    icon: <GitBranch size={18} />,
  },
  {
    label: 'Escopo',
    value: 'Somente chat conversacional',
    detail: 'Sem depender do bot antigo',
    icon: <ShieldCheck size={18} />,
  },
];

const manualTests = [
  { message: 'oi', expected: 'Saudacao e menu curto do chat' },
  { message: 'tem iPhone?', expected: 'Pede modelo ou produto desejado' },
  { message: 'qual o horario?', expected: 'Encaminha horario/endereco para conferencia' },
  { message: 'faz entrega?', expected: 'Pede bairro para verificar entrega' },
  { message: 'quero falar com atendente', expected: 'Marca a conversa para atendimento humano' },
];

const rolloutSteps = [
  'Subir n8n e Evolution no EasyPanel',
  'Conectar Numero de teste na Evolution',
  'Importar workflow do chat',
  'Ativar webhook no n8n',
  'Rodar testes manuais antes de IA',
];

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
    >
      {children}
      <ExternalLink size={14} />
    </a>
  );
}

function StatusCard({ item }: { item: (typeof statusItems)[number] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {item.icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{item.value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{item.detail}</p>
    </div>
  );
}

export default function N8nChatPage() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            <Workflow className="text-blue-600" size={28} />
            n8n Chat
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Painel separado para construir o novo atendimento de chat via n8n com numero de teste, Evolution API e testes manuais antes da virada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExternalButton href={N8N_URL}>Abrir n8n</ExternalButton>
          <ExternalButton href={EVOLUTION_URL}>Abrir Evolution</ExternalButton>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">Area separada do WhatsApp atual</p>
            <p className="mt-1 text-sm">
              Somente chat conversacional no n8n. Numero de teste primeiro. Sem depender do bot antigo. Automacoes atuais preservadas no fluxo existente.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusItems.map((item) => (
          <StatusCard key={item.label} item={item} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <MessageCircle size={20} className="text-emerald-600" />
                Testes manuais do chat
              </h3>
              <p className="mt-1 text-sm text-slate-500">Use o numero de teste e confira cada resposta antes de adicionar IA.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Homologacao
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Mensagem</th>
                  <th className="px-4 py-3 font-bold">Resultado esperado</th>
                  <th className="w-24 px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualTests.map((test) => (
                  <tr key={test.message}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-900">{test.message}</td>
                    <td className="px-4 py-3 text-slate-600">{test.expected}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        <PlayCircle size={12} />
                        Testar
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CheckCircle2 size={20} className="text-blue-600" />
            Proximos passos
          </h3>
          <div className="mt-4 space-y-3">
            {rolloutSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  {index + 1}
                </div>
                <p className="text-sm font-medium text-slate-700">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-blue-900">Regra de seguranca</p>
            <p className="mt-1 text-sm text-blue-800">
              O numero oficial so entra depois dos testes manuais passarem. As mensagens automaticas atuais continuam separadas do chat n8n.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
