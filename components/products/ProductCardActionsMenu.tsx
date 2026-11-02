import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { cn } from '../../utils/cn';

// Celular: as ações secundárias do card ficam num menu "⋯" (folha que sobe de baixo),
// com nome escrito em cada uma. Excluir fica no fim, separado e em vermelho.
// No computador o menu não aparece: os ícones continuam na linha do card.

export interface ProductCardAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: (event: React.MouseEvent) => void;
  danger?: boolean;
  disabled?: boolean;
  /** Texto pequeno ao lado (ex.: "3 tags", "está oculto"). */
  hint?: string;
}

interface Props {
  title: string;
  actions: ProductCardAction[];
}

export const ProductCardActionsMenu: React.FC<Props> = ({ title, actions }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const regular = actions.filter(action => !action.danger);
  const danger = actions.filter(action => action.danger);

  const renderItem = (action: ProductCardAction) => (
    <button
      key={action.key}
      type="button"
      data-card-action={action.key}
      disabled={action.disabled}
      onClick={event => {
        event.stopPropagation();
        setOpen(false);
        action.onSelect(event);
      }}
      className={cn(
        'flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition disabled:opacity-50',
        action.danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-800 hover:bg-slate-100',
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">{action.icon}</span>
      <span className="min-w-0 flex-1">{action.label}</span>
      {action.hint && <span className="shrink-0 text-xs font-semibold text-slate-500">{action.hint}</span>}
    </button>
  );

  return (
    <>
      <button
        type="button"
        data-card-actions-toggle
        onClick={event => { event.stopPropagation(); setOpen(true); }}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
        title="Mais ações"
        aria-label="Mais ações do produto"
        aria-haspopup="dialog"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && createPortal(
        // Portais do React repassam o clique ao card: o stopPropagation evita marcar/desmarcar na seleção.
        <div
          className="fixed inset-0 z-[90] flex items-end bg-black/40 md:hidden"
          data-card-actions-sheet
          onClick={event => { event.stopPropagation(); setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ações: ${title}`}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-2 flex items-start gap-2 px-1">
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{title}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-0.5">{regular.map(renderItem)}</div>
            {danger.length > 0 && (
              <div className="mt-3 space-y-0.5 border-t border-slate-200 pt-3">{danger.map(renderItem)}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
