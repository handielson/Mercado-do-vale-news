import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

interface ModelAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    section?: string;
    destructive?: boolean;
}

// Render outside the scrolling table so the last rows can open the full menu.
export function ModelActionsMenu({ modelName, actions }: { modelName: string; actions: ModelAction[] }) {
    const [position, setPosition] = useState<{ top: number; left: number; above: boolean; maxHeight: number } | null>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();
    const close = (restoreFocus = false) => {
        setPosition(null);
        if (restoreFocus) trigger.current?.focus();
    };

    useEffect(() => {
        if (!position) return;
        const dismiss = (event: Event) => {
            const target = event.target as Node;
            if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
        };
        const dismissOnScroll = (event: Event) => {
            if (!menu.current?.contains(event.target as Node)) close();
        };
        const resize = () => close();
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('focusin', dismiss);
        document.addEventListener('scroll', dismissOnScroll, true);
        window.addEventListener('resize', resize);
        menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('focusin', dismiss);
            document.removeEventListener('scroll', dismissOnScroll, true);
            window.removeEventListener('resize', resize);
        };
    }, [position]);

    function open() {
        const rect = trigger.current!.getBoundingClientRect();
        const width = Math.min(304, window.innerWidth - 16);
        const availableBelow = window.innerHeight - rect.bottom - 16;
        // Use the larger side, leaving room for the menu to scroll on short screens.
        const below = availableBelow >= Math.min(340, rect.top - 16);
        setPosition({
            left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
            top: below ? rect.bottom + 6 : rect.top - 6,
            above: !below,
            maxHeight: Math.max(0, below ? availableBelow : rect.top - 16),
        });
    }

    return <>
        <button ref={trigger} type="button" aria-label={`Mais ações de ${modelName}`} aria-haspopup="menu"
            aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
            onClick={() => position ? close() : open()}
            onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); open(); } }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <MoreHorizontal size={18} />
        </button>
        {position && createPortal(<div ref={menu} id={id} role="menu" aria-label={`Ações de ${modelName}`}
            style={{ top: position.top, left: position.left, width: 'min(304px, calc(100vw - 16px))', maxHeight: position.maxHeight, transform: position.above ? 'translateY(-100%)' : undefined }}
            className="fixed z-[100] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); close(true); }
                const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
                const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                    buttons[next]?.focus();
                }
            }}>
            {actions.map((action, index) => <React.Fragment key={action.label}>
                {action.section && <div role="presentation" className={`${index ? 'mt-1 border-t border-slate-100 pt-2' : 'pt-1'} px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400`}>{action.section}</div>}
                <button type="button" role="menuitem" disabled={action.disabled}
                    onClick={() => { close(true); action.onClick(); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium disabled:opacity-40 focus-visible:outline-none ${action.destructive ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'}`}>
                    <span className="shrink-0">{action.icon}</span>{action.label}
                </button>
            </React.Fragment>)}
        </div>, document.body)}
    </>;
}
