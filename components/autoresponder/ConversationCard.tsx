import React from 'react';
import type { AutoResponderConversation, AutoResponderTag } from '../../types/autoResponder';
import TagPicker from './TagPicker';

export interface ConversationCardProps {
    conversation: AutoResponderConversation;
    conversationTags: AutoResponderTag[];
    selectedTagIds: number[];
    paused: boolean;
    busy?: boolean;
    formatDateTime: (value?: string | null) => string;
    formatNumber: (value: unknown) => string;
    onToggleTag: (sender: string, tagId: number) => void;
    onPause: (sender: string, minutes: number) => void;
    onResume: (sender: string) => void;
    onSaveTags: (sender: string) => void;
    onBlock: (conversation: AutoResponderConversation) => void;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({
    conversation,
    conversationTags,
    selectedTagIds,
    paused,
    busy = false,
    formatDateTime,
    formatNumber,
    onToggleTag,
    onPause,
    onResume,
    onSaveTags,
    onBlock,
}) => (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{conversation.contact_name || conversation.sender}</h3>
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${paused ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {paused ? 'Pausada' : 'Ativa'}
                    </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">{conversation.sender}</p>
            </div>
            <div className="text-left text-xs text-slate-500 sm:text-right">
                <p>Ultima mensagem</p>
                <p className="font-semibold text-slate-700">{formatDateTime(conversation.last_message_at)}</p>
            </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Ultima mensagem</p>
            <p className="mt-1 text-sm text-slate-700">{conversation.last_message || 'Sem mensagem registrada.'}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Mensagens</p>
                <p className="font-bold text-slate-900">{formatNumber(conversation.total_messages)}</p>
            </div>
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Respostas</p>
                <p className="font-bold text-slate-900">{formatNumber(conversation.reply_count)}</p>
            </div>
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Fallbacks</p>
                <p className="font-bold text-slate-900">{formatNumber(conversation.consecutive_fallbacks)}</p>
            </div>
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Pausa ate</p>
                <p className="font-bold text-slate-900">{paused ? formatDateTime(conversation.paused_until) : '-'}</p>
            </div>
        </div>

        <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Tags</p>
            <TagPicker
                tags={conversationTags}
                selectedTagIds={selectedTagIds}
                scope="conversation"
                size="sm"
                emptyLabel="Nenhuma tag de conversa cadastrada."
                onToggle={(tagId) => onToggleTag(conversation.sender, tagId)}
            />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onPause(conversation.sender, 60)} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Pausar 1h</button>
            <button type="button" onClick={() => onPause(conversation.sender, 240)} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Pausar 4h</button>
            <button type="button" onClick={() => onPause(conversation.sender, 1440)} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Pausar 24h</button>
            <button type="button" onClick={() => onResume(conversation.sender)} disabled={busy} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">Liberar</button>
            <button type="button" onClick={() => onSaveTags(conversation.sender)} disabled={busy} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">Salvar tags</button>
            <button type="button" onClick={() => onBlock(conversation)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Bloquear</button>
        </div>
    </div>
);

export default ConversationCard;
