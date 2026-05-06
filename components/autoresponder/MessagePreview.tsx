import React from 'react';

export interface MessagePreviewProps {
    text?: string | null;
    replyType?: string;
    attachmentUrl?: string | null;
    attachmentCaption?: string | null;
}

export const MessagePreview: React.FC<MessagePreviewProps> = ({
    text,
    replyType = 'text',
    attachmentUrl,
    attachmentCaption,
}) => {
    const fallback = replyType === 'text'
        ? 'Digite o texto da resposta.'
        : 'O bot montara a lista de produtos automaticamente.';
    const body = (text || '').trim() || fallback;

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Preview ao vivo</p>
            <div className="max-w-lg rounded-lg bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
                {attachmentUrl && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img src={attachmentUrl} alt={attachmentCaption || 'Anexo da resposta'} className="max-h-64 w-full object-cover" />
                    </div>
                )}
                <p className="whitespace-pre-wrap">{attachmentCaption || body}</p>
            </div>
        </div>
    );
};

export default MessagePreview;
