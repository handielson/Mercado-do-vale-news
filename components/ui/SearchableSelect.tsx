import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SearchableSelectProps {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  renderLeading?: (option: string) => ReactNode;
  getOptionLabel?: (option: string) => string;
}

const defaultOptionLabel = (option: string) => option;
// Search text is not a new option: only a registered value can be selected.
export function SearchableSelect({ id, value, options, onChange, disabled = false, placeholder = 'Digite para buscar...', className, renderLeading, getOptionLabel = defaultOptionLabel }: SearchableSelectProps) {
  const [query, setQuery] = useState(getOptionLabel(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const filtered = options.filter(option => normalize(getOptionLabel(option)).includes(normalize(query)));
  useEffect(() => { if (!open) setQuery(getOptionLabel(value)); }, [value, open, getOptionLabel]);
  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const select = (option: string) => { onChange(option); setQuery(getOptionLabel(option)); setOpen(false); setActive(-1); };
  const close = () => { setOpen(false); setActive(-1); setQuery(getOptionLabel(value)); };
  return <div className="relative min-w-0">
    <input
      id={id} type="text" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={`${id}-options`}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      disabled={disabled} value={query} placeholder={placeholder}
      className={`${className || 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'} ${renderLeading ? 'pl-10' : ''}`}
      onFocus={() => { setQuery(''); setOpen(true); setActive(-1); }}
      onClick={() => { if (!open) { setQuery(''); setOpen(true); setActive(-1); } }}
      onBlur={close}
      onChange={event => {
        const text = event.target.value;
        setQuery(text); setOpen(true); setActive(-1);
        const exact = options.filter(option => normalize(getOptionLabel(option)) === normalize(text));
        onChange(exact.length === 1 ? exact[0] : '');
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          if (!open) { setQuery(''); setActive(-1); }
          else setActive(index => !filtered.length ? -1 : index < 0 ? (event.key === 'ArrowDown' ? 0 : filtered.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length);
        } else if (event.key === 'Enter' && open) {
          event.preventDefault();
          if (active >= 0 && filtered[active]) select(filtered[active]);
          else if (filtered.length === 1) select(filtered[0]);
        } else if (event.key === 'Escape') { event.preventDefault(); close(); }
      }}
    />
    {renderLeading && value && query === getOptionLabel(value) && <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">{renderLeading(value)}</span>}
    {open && !disabled && <ul ref={list} id={`${id}-options`} role="listbox" aria-label="Opções disponíveis" className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
      {filtered.map((option, index) => <li key={option} id={`${id}-option-${index}`} role="option" aria-selected={option === value}>
        <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => select(option)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50 ${index === active || option === value ? 'bg-violet-50 font-medium text-violet-800' : 'text-slate-700'}`}>
          {renderLeading && <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">{renderLeading(option)}</span>}
          <span>{getOptionLabel(option)}</span>
        </button>
      </li>)}
      {!filtered.length && <li role="presentation" className="px-3 py-2 text-sm text-slate-500">Nenhuma opção encontrada.</li>}
    </ul>}
  </div>;
}
