import React from 'react';
import { Bot, Edit3, FileText, Plus, RefreshCw, Save, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { RuleEditor, type RuleEditorFormState, type RuleTemplateOption } from '../autoresponder/RuleEditor';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderRule, AutoResponderSettings, AutoResponderTag } from '../../types/autoResponder';

type StandardMessageKey =
  | 'greeting_prefix'
  | 'fallback_message'
  | 'auto_pause_fallback_message'
  | 'human_message_in_hours'
  | 'human_message_out_of_hours'
  | 'signature_message';

const standardMessages: Array<{ key: StandardMessageKey; title: string; description: string; rows?: number }> = [
  {
    key: 'greeting_prefix',
    title: 'Saudacao',
    description: 'Prefixo usado quando o cliente chega com oi, bom dia ou saudacao parecida.',
    rows: 2,
  },
  {
    key: 'fallback_message',
    title: 'Fallback',
    description: 'Mensagem quando o bot nao achou resposta pronta, produto ou fluxo confiavel.',
  },
  {
    key: 'auto_pause_fallback_message',
    title: 'Pausa por falhas',
    description: 'Mensagem enviada quando o bot desiste e passa para atendimento humano.',
  },
  {
    key: 'human_message_in_hours',
    title: 'Atendimento humano em horario',
    description: 'Resposta quando o cliente pede uma pessoa durante o horario de atendimento.',
  },
  {
    key: 'human_message_out_of_hours',
    title: 'Atendimento humano fora do horario',
    description: 'Resposta quando o cliente pede uma pessoa fora do horario.',
  },
  {
    key: 'signature_message',
    title: 'Assinatura',
    description: 'Fechamento padrao acrescentado nas respostas quando a assinatura esta ligada.',
    rows: 2,
  },
];

const ruleTemplates: RuleTemplateOption[] = [
  {
    label: 'Texto simples',
    patch: {
      match_type: 'any_keyword',
      reply_type: 'text',
      priority: '50',
      active: false,
    },
  },
  {
    label: 'Carrinho abandonado',
    patch: {
      name: 'Carrinho abandonado',
      match_type: 'any_keyword',
      pattern: 'continuar compra, finalizar compra, carrinho, comprar depois',
      reply_type: 'text',
      reply_text: 'Oi! Vi que voce se interessou pelo produto. O que achou? Vamos seguir com sua compra?',
      priority: '70',
      active: false,
    },
  },
  {
    label: 'Humano',
    patch: {
      name: 'Chamar atendente',
      match_type: 'any_keyword',
      pattern: 'atendente, humano, pessoa, vendedor',
      reply_type: 'text',
      reply_text: 'Claro, vou chamar nossa equipe para continuar seu atendimento por aqui.',
      priority: '90',
      active: false,
    },
  },
];

function createEmptyRuleForm(): RuleEditorFormState {
  return {
    name: '',
    pattern: '',
    match_type: 'any_keyword',
    reply_type: 'text',
    reply_text: '',
    reply_tag_id: '',
    reply_search_query: '',
    attachment_url: '',
    attachment_caption: '',
    priority: '50',
    active: false,
    tag_ids: [],
  };
}

function parseRuleTagIds(value: AutoResponderRule['tag_ids']): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return value.split(',').map(Number).filter(Number.isFinite);
    }
  }
  return [];
}

function ruleToForm(rule: AutoResponderRule): RuleEditorFormState {
  return {
    name: rule.name || '',
    pattern: rule.pattern || '',
    match_type: rule.match_type || 'any_keyword',
    reply_type: rule.reply_type || 'text',
    reply_text: rule.reply_text || '',
    reply_tag_id: rule.reply_tag_id ? String(rule.reply_tag_id) : '',
    reply_search_query: rule.reply_search_query || '',
    attachment_url: rule.attachment_url || '',
    attachment_caption: rule.attachment_caption || '',
    priority: String(rule.priority ?? 50),
    active: rule.active === true || Number(rule.active) === 1,
    tag_ids: parseRuleTagIds(rule.tag_ids),
  };
}

function buildRuleInput(form: RuleEditorFormState) {
  return {
    name: form.name.trim(),
    match_type: form.match_type,
    pattern: form.pattern.trim(),
    reply_type: form.reply_type,
    reply_text: form.reply_text,
    reply_tag_id: form.reply_tag_id ? Number(form.reply_tag_id) : null,
    reply_search_query: form.reply_search_query.trim() || null,
    next_state: null,
    attachment_url: form.attachment_url.trim() || null,
    attachment_caption: form.attachment_caption.trim() || null,
    auto_apply_tag_id: null,
    tag_ids: form.tag_ids,
    priority: Math.round(Number(form.priority) || 50),
    active: form.active,
  };
}

function isActive(value: AutoResponderRule['active']): boolean {
  return value === true || Number(value) === 1;
}

export function WhatsAppResponseCenterPanel() {
  const [settings, setSettings] = React.useState<AutoResponderSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = React.useState<Partial<Record<StandardMessageKey, string>>>({});
  const [rules, setRules] = React.useState<AutoResponderRule[]>([]);
  const [tags, setTags] = React.useState<AutoResponderTag[]>([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [savingRule, setSavingRule] = React.useState(false);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AutoResponderRule | null>(null);
  const [ruleForm, setRuleForm] = React.useState<RuleEditorFormState | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, nextRules, nextTags] = await Promise.all([
        autoResponderService.getSettings(),
        autoResponderService.listRules({}),
        autoResponderService.listTags({ scope: 'rule' }),
      ]);
      setSettings(nextSettings);
      setSettingsDraft(
        standardMessages.reduce<Partial<Record<StandardMessageKey, string>>>((draft, item) => {
          draft[item.key] = String(nextSettings?.[item.key] || '');
          return draft;
        }, {}),
      );
      setRules(nextRules);
      setTags(nextTags);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar Centro de Respostas.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRules = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rules;
    return rules.filter((rule) => (
      rule.name?.toLowerCase().includes(term)
      || rule.pattern?.toLowerCase().includes(term)
      || rule.reply_text?.toLowerCase().includes(term)
    ));
  }, [query, rules]);

  async function saveStandardMessages() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const payload = standardMessages.reduce<Record<string, string>>((next, item) => {
        next[item.key] = settingsDraft[item.key] || '';
        return next;
      }, {});
      const saved = await autoResponderService.updateSettings(payload);
      setSettings(saved);
      toast.success('Mensagens padrao salvas na VPS');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar mensagens padrao.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveRule() {
    if (!ruleForm) return;
    setSavingRule(true);
    try {
      const input = buildRuleInput(ruleForm);
      if (editingRule) {
        await autoResponderService.updateRule(editingRule.id, input);
        toast.success('Resposta atualizada');
      } else {
        await autoResponderService.createRule(input);
        toast.success('Resposta criada como regra');
      }
      setEditingRule(null);
      setRuleForm(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar resposta.');
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRule(rule: AutoResponderRule) {
    try {
      await autoResponderService.updateRule(rule.id, { active: !isActive(rule.active) });
      setRules((current) => current.map((item) => (
        item.id === rule.id ? { ...item, active: !isActive(rule.active) } : item
      )));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alterar status da resposta.');
    }
  }

  async function uploadAttachment(file: File | null) {
    if (!file || !ruleForm) return;
    setUploadingAttachment(true);
    try {
      const uploaded = await autoResponderService.uploadAttachment(file);
      setRuleForm({
        ...ruleForm,
        attachment_url: uploaded.url,
        attachment_caption: ruleForm.attachment_caption || uploaded.filename,
      });
      toast.success('Anexo enviado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar anexo.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  function openNewRule() {
    setEditingRule(null);
    setRuleForm(createEmptyRuleForm());
  }

  function openEditRule(rule: AutoResponderRule) {
    setEditingRule(rule);
    setRuleForm(ruleToForm(rule));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <FileText size={15} />
            Centro de respostas
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Mensagens editaveis do bot</h3>
          <p className="mt-1 text-sm text-slate-500">
            Todas salvas na VPS: mensagens padrao e respostas por gatilho, revisaveis antes de ativar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={openNewRule}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nova resposta
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Mensagens padrao</p>
              <p className="mt-1 text-sm text-slate-500">Textos globais usados pelo motor.</p>
            </div>
            <button
              type="button"
              onClick={() => void saveStandardMessages()}
              disabled={loading || savingSettings || !settings}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {savingSettings ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {standardMessages.map((item) => (
            <label key={item.key} className="block rounded-lg border border-slate-200 p-3">
              <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
              <textarea
                value={settingsDraft[item.key] || ''}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, [item.key]: event.target.value }))}
                rows={item.rows || 4}
                disabled={loading}
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Respostas por gatilho</p>
              <p className="mt-1 text-sm text-slate-500">{filteredRules.length} de {rules.length} respostas</p>
            </div>
            <label className="relative block sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar resposta"
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
            {filteredRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{rule.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive(rule.active) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isActive(rule.active) ? 'Ativa' : 'Rascunho'}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {rule.reply_type}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{rule.pattern}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleRule(rule)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {isActive(rule.active) ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      {isActive(rule.active) ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditRule(rule)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Edit3 size={15} />
                      Editar
                    </button>
                  </div>
                </div>
                {rule.reply_text && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {rule.reply_text}
                  </p>
                )}
              </div>
            ))}
            {!loading && filteredRules.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhuma resposta encontrada.
              </div>
            )}
            {loading && (
              <div className="rounded-lg border border-slate-200 p-6 text-center text-sm font-medium text-slate-500">
                Carregando respostas...
              </div>
            )}
          </div>
        </div>
      </div>

      {ruleForm && (
        <RuleEditor
          editingRule={editingRule}
          ruleForm={ruleForm}
          tags={tags}
          ruleTemplates={ruleTemplates}
          isSaving={savingRule}
          isUploadingAttachment={uploadingAttachment}
          onChange={(patch) => setRuleForm((current) => current ? { ...current, ...patch } : current)}
          onToggleTag={(tagId) => {
            setRuleForm((current) => {
              if (!current) return current;
              const hasTag = current.tag_ids.includes(tagId);
              return {
                ...current,
                tag_ids: hasTag
                  ? current.tag_ids.filter((id) => id !== tagId)
                  : [...current.tag_ids, tagId],
              };
            });
          }}
          onUploadAttachment={(file) => void uploadAttachment(file)}
          onRemoveAttachment={() => setRuleForm((current) => current ? { ...current, attachment_url: '', attachment_caption: '' } : current)}
          onClose={() => {
            setEditingRule(null);
            setRuleForm(null);
          }}
          onSave={() => void saveRule()}
        />
      )}
    </section>
  );
}
