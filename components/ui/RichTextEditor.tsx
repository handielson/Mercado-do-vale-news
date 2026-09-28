import { useEffect, useRef, useState } from 'react';

type RichTextEditorProps = { value: string; onChange: (value: string) => void; placeholder?: string };

function cleanEditorHtml(value: string) {
  if (typeof window === 'undefined') return value;
  const parsed = new DOMParser().parseFromString(value || '', 'text/html');
  parsed.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(node => node.remove());
  parsed.body.querySelectorAll('*').forEach(node => {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') node.removeAttribute(attribute.name);
      if ((attribute.name === 'href' || attribute.name === 'src') && /^\s*javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
    }
  });
  return parsed.body.innerHTML;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  useEffect(() => {
    if (mode !== 'visual' || !editorRef.current) return;
    const safeValue = cleanEditorHtml(value);
    if (editorRef.current.innerHTML !== safeValue) editorRef.current.innerHTML = safeValue;
  }, [value, mode]);
  const emit = () => onChange(cleanEditorHtml(editorRef.current?.innerHTML || ''));
  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    emit();
  };
  return <div className="mt-1 overflow-hidden rounded-md border border-slate-300 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
      <div className="flex flex-wrap gap-1">{mode === 'visual' && <>
        <button type="button" onClick={() => command('bold')} className="rounded px-2 py-1 text-xs font-bold hover:bg-slate-200">B</button>
        <button type="button" onClick={() => command('italic')} className="rounded px-2 py-1 text-xs italic hover:bg-slate-200">I</button>
        <button type="button" onClick={() => command('formatBlock', 'h2')} className="rounded px-2 py-1 text-xs font-semibold hover:bg-slate-200">Título</button>
        <button type="button" onClick={() => command('formatBlock', 'p')} className="rounded px-2 py-1 text-xs hover:bg-slate-200">Texto</button>
        <button type="button" onClick={() => command('insertUnorderedList')} className="rounded px-2 py-1 text-xs hover:bg-slate-200">• Lista</button>
        <button type="button" onClick={() => command('insertOrderedList')} className="rounded px-2 py-1 text-xs hover:bg-slate-200">1. Lista</button>
        <button type="button" onClick={() => command('removeFormat')} className="rounded px-2 py-1 text-xs hover:bg-slate-200">Limpar</button>
      </>}</div>
      <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
        <button type="button" onClick={() => setMode('visual')} className={`rounded px-2 py-1 ${mode === 'visual' ? 'bg-violet-100 font-semibold text-violet-800' : 'text-slate-500'}`}>Visual</button>
        <button type="button" onClick={() => setMode('html')} className={`rounded px-2 py-1 ${mode === 'html' ? 'bg-violet-100 font-semibold text-violet-800' : 'text-slate-500'}`}>HTML</button>
      </div>
    </div>
    {mode === 'visual' ? <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={emit} data-placeholder={placeholder}
      className="min-h-56 max-h-[32rem] overflow-auto px-3 py-3 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_ul]:list-disc" />
      : <textarea value={value} onChange={event => onChange(event.target.value)} className="min-h-56 w-full resize-y p-3 font-mono text-xs outline-none" placeholder={placeholder} />}
  </div>;
}
