import React from 'react';
import { Save, X } from 'lucide-react';
import type { AutoResponderRule, AutoResponderTag } from '../../types/autoResponder';
import AttachmentUpload from './AttachmentUpload';
import MessagePreview from './MessagePreview';
import TagPicker from './TagPicker';

export interface RuleEditorFormState {
    name: string;
    pattern: string;
    match_type: string;
    reply_type: string;
    reply_text: string;
    reply_tag_id: string;
    reply_search_query: string;
    attachment_url: string;
    attachment_caption: string;
    priority: string;
    active: boolean;
    tag_ids: number[];
}

export interface RuleTemplateOption {
    label: string;
    patch: Partial<RuleEditorFormState>;
}

export interface RuleEditorProps {
    editingRule: AutoResponderRule | null;
    ruleForm: RuleEditorFormState;
    tags: AutoResponderTag[];
    ruleTemplates: RuleTemplateOption[];
    isSaving: boolean;
    isUploadingAttachment: boolean;
    onChange: (patch: Partial<RuleEditorFormState>) => void;
    onToggleTag: (tagId: number) => void;
    onUploadAttachment: (file: File | null) => void;
    onRemoveAttachment: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
    editingRule,
    ruleForm,
    tags,
    ruleTemplates,
    isSaving,
    isUploadingAttachment,
    onChange,
    onToggleTag,
    onUploadAttachment,
    onRemoveAttachment,
    onClose,
    onSave,
}) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{editingRule ? 'Editar resposta' : 'Nova resposta'}</h2>
                    <p className="text-sm text-slate-500">Configure o gatilho e a resposta enviada pelo bot.</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Fechar">
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-5 px-5 py-5">
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Aplicar template</label>
                    <div className="flex flex-wrap gap-2">
                        {ruleTemplates.map((template) => (
                            <button key={template.label} type="button" onClick={() => onChange(template.patch)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                {template.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
                        <input value={ruleForm.name} onChange={(event) => onChange({ name: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Prioridade</span>
                        <input type="number" value={ruleForm.priority} onChange={(event) => onChange({ priority: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>
                    <label className="block md:col-span-2">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Palavras-chave</span>
                        <textarea value={ruleForm.pattern} onChange={(event) => onChange({ pattern: event.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de match</span>
                        <select value={ruleForm.match_type} onChange={(event) => onChange({ match_type: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="any_keyword">Qualquer palavra</option>
                            <option value="all_keywords">Todas as palavras</option>
                            <option value="contains">Contem texto</option>
                            <option value="exact">Exata</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de resposta</span>
                        <select value={ruleForm.reply_type} onChange={(event) => onChange({ reply_type: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="text">Texto</option>
                            <option value="product_by_tag">Produtos por tag</option>
                            <option value="product_search">Busca de produto</option>
                        </select>
                    </label>
                    {ruleForm.reply_type === 'product_by_tag' && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Tag de produto</span>
                            <select value={ruleForm.reply_tag_id} onChange={(event) => onChange({ reply_tag_id: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                <option value="">Selecione</option>
                                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                            </select>
                        </label>
                    )}
                    {ruleForm.reply_type === 'product_search' && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Busca fixa</span>
                            <input value={ruleForm.reply_search_query} onChange={(event) => onChange({ reply_search_query: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </label>
                    )}
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <input type="checkbox" checked={ruleForm.active} onChange={(event) => onChange({ active: event.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                        <span className="text-sm font-semibold text-slate-700">Resposta ativa</span>
                    </label>
                </div>

                <div>
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Tags da regra</span>
                    <TagPicker tags={tags} selectedTagIds={ruleForm.tag_ids} scope="rule" onToggle={onToggleTag} />
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Texto da resposta</span>
                    <textarea value={ruleForm.reply_text} onChange={(event) => onChange({ reply_text: event.target.value })} rows={5} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>

                <AttachmentUpload
                    attachmentUrl={ruleForm.attachment_url}
                    caption={ruleForm.attachment_caption}
                    isUploading={isUploadingAttachment}
                    onUpload={onUploadAttachment}
                    onCaptionChange={(attachment_caption) => onChange({ attachment_caption })}
                    onRemove={onRemoveAttachment}
                />

                <MessagePreview
                    text={ruleForm.reply_text}
                    replyType={ruleForm.reply_type}
                    attachmentUrl={ruleForm.attachment_url}
                    attachmentCaption={ruleForm.attachment_caption}
                />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !ruleForm.name.trim() || !ruleForm.pattern.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Salvar resposta
                </button>
            </div>
        </div>
    </div>
);

export default RuleEditor;
