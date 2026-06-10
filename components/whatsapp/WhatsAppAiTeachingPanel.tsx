import React from 'react';
import { BookOpen, ClipboardList, Database, MapPin, Pencil, Plus, Save, Smartphone, Trash2, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderAiTraining, AutoResponderAiTrainingType } from '../../types/autoResponder';

const trainingTypes: Array<{ value: AutoResponderAiTrainingType; label: string }> = [
  { value: 'category_guidance', label: 'Consulta ao estoque' },
  { value: 'store_instruction', label: 'Procedimento da loja' },
  { value: 'faq', label: 'Pergunta frequente' },
  { value: 'policy', label: 'Politica comercial' },
];

const emptyForm = {
  title: '',
  training_type: 'category_guidance' as AutoResponderAiTrainingType,
  keywords: '',
  content: '',
  priority: 0,
  active: true,
};

const procedureExamples = [
  {
    title: 'Lista de celulares',
    type: 'category_guidance' as AutoResponderAiTrainingType,
    icon: Smartphone,
    keywords: 'celular, celulares, smartphone, smartphones, quais celulares tem, lista de celulares, modelos disponiveis',
    content: [
      'Quando a IA deve usar:',
      'Use quando o cliente pedir celulares disponiveis, modelos em estoque ou lista de smartphones.',
      '',
      'Campos do sistema:',
      'consultar produtos ativos em estoque na categoria Smartphones, agrupando por marca/modelo, preco, memoria, cores e link do produto.',
      '',
      'Regra importante:',
      'manter o padrao da lista de celulares ja aprovado. Nao trocar a estrutura, nao inventar campos e nao remover informacoes principais.',
      '',
      'Formato padrao da resposta:',
      'Encontrei estas opcoes para Smartphones:',
      '',
      '{marca}',
      '',
      '1. {modelo}',
      '{memoria}',
      'Preco no Pix: {preco_pix}',
      'Cartao: {parcelamento}',
      'Cores: {cores_disponiveis}',
      'Ver produto: {link_produto}',
      '',
      'Se quiser ver mais detalhes de algum, me diga o numero ou o modelo.',
      '',
      'Se nao encontrar:',
      'No momento nao encontrei celulares disponiveis no estoque. Vou chamar um atendente para conferir uma alternativa para voce.',
    ].join('\n'),
  },
  {
    title: 'Celulares com NFC',
    type: 'category_guidance' as AutoResponderAiTrainingType,
    icon: Smartphone,
    keywords: 'nfc, pagamento por aproximacao, aproximacao, Google Pay, Samsung Pay, celular com NFC',
    content: [
      'Quando a IA deve usar:',
      'Use quando o cliente perguntar quais celulares possuem NFC, pagamento por aproximacao ou carteira digital.',
      '',
      'Campos do sistema:',
      'consultar produtos ativos em estoque na categoria Smartphones e usar o campo de especificacoes NFC.',
      '',
      'Formato padrao da resposta:',
      'Temos essas opcoes com NFC disponiveis:',
      '',
      '1. {nome_do_produto}',
      'Preco no Pix: {preco_pix}',
      'Parcelamento: {parcelamento}',
      'Memoria: {memoria}',
      'Cores: {cores_disponiveis}',
      '',
      'Quer que eu te mande mais detalhes de algum deles?',
      '',
      'Se nao encontrar:',
      'No momento nao encontrei celular com NFC disponivel no estoque. Vou chamar um atendente para conferir uma alternativa para voce.',
    ].join('\n'),
  },
  {
    title: 'Entrega por CEP',
    type: 'store_instruction' as AutoResponderAiTrainingType,
    icon: Truck,
    keywords: 'entrega, delivery, frete, motoboy, cep, taxa de entrega',
    content: [
      'Quando a IA deve usar:',
      'Use quando o cliente perguntar se fazemos entrega, pedir frete ou enviar CEP.',
      '',
      'Campos do sistema:',
      'calcular frete pelo CEP informado quando houver CEP valido. Se ainda nao houver CEP, pedir apenas o CEP.',
      '',
      'Formato padrao da resposta sem CEP:',
      'Fazemos entrega sim. Me envie seu CEP para eu consultar o valor certinho.',
      '',
      'Formato padrao da resposta com CEP calculado:',
      'Consultei a entrega para {cep}:',
      '',
      'Valor da entrega: {valor_frete}',
      'Prazo estimado: {prazo_entrega}',
      '',
      'Voce prefere seguir com entrega ou retirada na loja?',
    ].join('\n'),
  },
  {
    title: 'Endereco da loja',
    type: 'store_instruction' as AutoResponderAiTrainingType,
    icon: MapPin,
    keywords: 'endereco, localizacao, onde fica, loja fisica, como chegar, retirada',
    content: [
      'Quando a IA deve usar:',
      'Use quando o cliente perguntar onde fica a loja, como chegar ou onde retirar.',
      '',
      'Campos do sistema:',
      'usar o endereco cadastrado no sistema, telefone da loja e horario atual quando estiver disponivel.',
      '',
      'Formato padrao da resposta:',
      'Estamos neste endereco:',
      '',
      '{endereco_loja}',
      '',
      'Horario de atendimento: {horario_atendimento}',
      '',
      'Se quiser, posso te mandar tambem a rota ou confirmar se o produto esta disponivel para retirada.',
    ].join('\n'),
  },
];

function isEnabled(value: unknown): boolean {
  return value === true || Number(value) === 1 || String(value) === 'true';
}

function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function useAutoResizeTextarea(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  React.useLayoutEffect(() => {
    autoResizeTextarea(ref.current);
  }, [ref, value]);
}

export function WhatsAppAiTeachingPanel() {
  const [entries, setEntries] = React.useState<AutoResponderAiTraining[]>([]);
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const keywordsRef = React.useRef<HTMLTextAreaElement | null>(null);
  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);

  useAutoResizeTextarea(keywordsRef, form.keywords);
  useAutoResizeTextarea(contentRef, form.content);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    try {
      const rows = await autoResponderService.listAiTraining({});
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar ensino da IA.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadEntries();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editEntry(entry: AutoResponderAiTraining) {
    setEditingId(entry.id);
    setForm({
      title: entry.title || '',
      training_type: entry.training_type || 'category_guidance',
      keywords: String(entry.keywords || ''),
      content: entry.content || '',
      priority: Number(entry.priority || 0),
      active: isEnabled(entry.active),
    });
  }

  function useProcedureExample(example: (typeof procedureExamples)[number]) {
    setEditingId(null);
    setForm({
      title: example.title,
      training_type: example.type,
      keywords: example.keywords,
      content: example.content,
      priority: 10,
      active: true,
    });
  }

  async function saveEntry() {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setError('Informe o nome e a instrucao para IA.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        training_type: form.training_type,
        keywords: form.keywords.trim(),
        content,
        priority: Number(form.priority || 0),
        active: form.active,
      };
      if (editingId) {
        await autoResponderService.updateAiTraining(editingId, payload);
        toast.success('Ensino da IA atualizado');
      } else {
        await autoResponderService.createAiTraining(payload);
        toast.success('Ensino da IA criado');
      }
      resetForm();
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar ensino da IA.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: number) {
    setSaving(true);
    setError(null);
    try {
      await autoResponderService.deleteAiTraining(id);
      if (editingId === id) resetForm();
      setEntries((current) => current.filter((entry) => entry.id !== id));
      toast.success('Ensino da IA removido');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover ensino da IA.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <ClipboardList size={15} />
            Procedimentos IA
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Modelos guiados com dados dinamicos</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            O procedimento nao envia mensagem sozinho. Ele entra no prompt para a IA conversar com autonomia,
            consultar os dados certos do sistema e manter a mesma formatacao nas respostas importantes.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus size={16} />
          Novo procedimento
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-3">
          {procedureExamples.map((example) => {
            const Icon = example.icon;
            return (
              <button
                key={example.title}
                type="button"
                onClick={() => useProcedureExample(example)}
                className="group rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-emerald-600">
                    <Icon size={16} />
                  </span>
                  {example.title}
                </span>
                <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Plus size={13} />
                  Usar exemplo
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Nome do procedimento
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value.slice(0, 120) }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block text-xs font-semibold uppercase text-slate-500">
              Tipo
              <select
                value={form.training_type}
                onChange={(event) => setForm((current) => ({ ...current, training_type: event.target.value as AutoResponderAiTrainingType }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {trainingTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Quando a IA deve usar
            <textarea
              ref={keywordsRef}
              value={form.keywords}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value.slice(0, 1000) }))}
              rows={1}
              placeholder="nfc, pagamento por aproximacao, onde fica, entrega, cep"
              className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="mt-1 block text-[11px] font-medium normal-case text-slate-400">
              Use palavras e frases que indicam esse assunto. Elas ajudam o sistema a anexar o procedimento certo ao prompt.
            </span>
          </label>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Campos do sistema e Formato padrao da resposta
            <textarea
              ref={contentRef}
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value.slice(0, 8000) }))}
              rows={8}
              placeholder="Quando a IA deve usar:
Use quando...

Campos do sistema:
consultar produtos ativos em estoque...

Formato padrao da resposta:
..."
              className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Ordem
              <input
                type="number"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value || 0) }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="mt-1 block text-[11px] font-medium normal-case text-slate-400">
                Maior numero aparece primeiro.
              </span>
            </label>

            <label className="mt-6 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              Ativo
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void saveEntry();
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar procedimento'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X size={16} />
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[240px] rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 rounded-lg border border-emerald-100 bg-white p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database size={15} className="text-emerald-600" />
              Por que isso nao vira o chatbot antigo?
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              O cadastro abaixo nao dispara resposta fixa. Ele vira contexto do prompt: a IA escolhe quando usar,
              conversa naturalmente e preenche o formato com dados oficiais do sistema.
            </p>
          </div>
          {loading ? (
            <p className="text-sm font-semibold text-slate-500">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">Nenhum procedimento cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {trainingTypes.find((type) => type.value === entry.training_type)?.label || entry.training_type}
                        {isEnabled(entry.active) ? ' ativo' : ' inativo'} - ordem {Number(entry.priority || 0)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => editEntry(entry)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        aria-label="Editar procedimento"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteEntry(entry.id);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                        aria-label="Remover procedimento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {entry.keywords && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">{entry.keywords}</p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{entry.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
