import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

type MigrationStatus = 'done' | 'testing' | 'pending';

const items: Array<{ label: string; status: MigrationStatus; description: string }> = [
  {
    label: 'Conexao',
    status: 'testing',
    description: 'Entrada e saida oficiais pela Evolution, sem depender do AutoResponder WA.',
  },
  {
    label: 'Atendimento',
    status: 'testing',
    description: 'Fila de conversas, pausa para humano e historico de mensagens.',
  },
  {
    label: 'ChatGPT',
    status: 'testing',
    description: 'Atendente principal com limites, ferramentas oficiais e fallback seguro.',
  },
  {
    label: 'Lista de celulares',
    status: 'pending',
    description: 'Ferramenta oficial preservada para listar celulares reais do catalogo.',
  },
  {
    label: 'Curadoria',
    status: 'pending',
    description: 'Perguntas nao respondidas, treinamento e melhoria continua.',
  },
  {
    label: 'Configuracoes',
    status: 'pending',
    description: 'Parametros finos, chaves, horarios, politicas e seguranca.',
  },
];

function statusMeta(status: MigrationStatus) {
  if (status === 'done') {
    return {
      icon: <CheckCircle2 size={16} />,
      label: 'feito',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (status === 'testing') {
    return {
      icon: <Clock size={16} />,
      label: 'em teste',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }
  return {
    icon: <Circle size={16} />,
    label: 'pendente',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  };
}

export function WhatsAppMigrationChecklist() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Migracao para o Centro WhatsApp</h3>
        <p className="mt-1 text-xs text-slate-500">
          Acompanhamento das funcoes que saem do AutoResponder legado e entram nesta pagina.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const meta = statusMeta(item.status);
          return (
            <div key={item.label} className={`rounded-lg border p-3 ${meta.className}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                <span className="text-xs font-medium uppercase">{meta.label}</span>
              </div>
              <p className="mt-2 text-xs leading-5">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
