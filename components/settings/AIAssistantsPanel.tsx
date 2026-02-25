import React, { useState, useEffect } from 'react';
import { Bot, Copy, ExternalLink, Check, Sparkles, Edit2 } from 'lucide-react';

const AI_LINKS = [
    { name: 'ChatGPT', url: 'https://chat.openai.com/', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
    { name: 'Gemini', url: 'https://gemini.google.com/', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai/', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border-cyan-200' },
    { name: 'Grok', url: 'https://grok.x.ai/', color: 'bg-slate-800 text-white hover:bg-slate-700 border-slate-700' },
    { name: 'Claude', url: 'https://claude.ai/', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' },
];

const STORAGE_KEY = 'mv_admin_ai_prompts';

export function AIAssistantsPanel() {
    const [prompts, setPrompts] = useState({
        prompt1: { title: 'Geração de Especificações', content: '' },
        prompt2: { title: 'Descrição de Marketing', content: '' },
        prompt3: { title: 'FAQ e Diferenciais', content: '' }
    });
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Migrate from old string format if necessary
                if (parsed.prompt1 !== undefined && typeof parsed.prompt1 === 'string') {
                    setPrompts({
                        prompt1: { title: 'Geração de Especificações', content: parsed.prompt1 || '' },
                        prompt2: { title: 'Descrição de Marketing', content: parsed.prompt2 || '' },
                        prompt3: { title: 'FAQ e Diferenciais', content: parsed.prompt3 || '' }
                    });
                } else if (parsed.prompt1 && typeof parsed.prompt1 === 'object') {
                    setPrompts(parsed);
                }
            } catch (e) {
                console.error('Failed to parse saved prompts');
            }
        }
    }, []);

    // Save to localStorage when changed
    const handlePromptChange = (key: keyof typeof prompts, field: 'title' | 'content', value: string) => {
        const newPrompts = {
            ...prompts,
            [key]: { ...prompts[key], [field]: value }
        };
        setPrompts(newPrompts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrompts));
    };

    const handleCopy = (text: string, index: number) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const promptKeys = ['prompt1', 'prompt2', 'prompt3'] as const;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Sparkles size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Assistentes de Inteligência Artificial</h2>
                    <p className="text-sm text-slate-500">Atalhos rápidos e seus prompts salvos para gerar descrições de modelos.</p>
                </div>
            </div>

            {/* AI Links */}
            <div className="flex flex-wrap gap-3">
                {AI_LINKS.map((ai) => (
                    <a
                        key={ai.name}
                        href={ai.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors ${ai.color}`}
                    >
                        {ai.name}
                        <ExternalLink size={16} />
                    </a>
                ))}
            </div>

            {/* Prompts Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {promptKeys.map((item, index) => (
                    <div key={item} className="flex flex-col h-full bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
                        {/* Header with Title Input & Copy Button */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-200">
                                <Bot size={16} className="text-indigo-500 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={prompts[item].title}
                                    onChange={(e) => handlePromptChange(item, 'title', e.target.value)}
                                    placeholder="Nome do Prompt (Ex: SEO)"
                                    className="w-full text-sm font-semibold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                />
                                <Edit2 size={12} className="text-slate-400 flex-shrink-0 opacity-50" />
                            </div>

                            <button
                                onClick={() => handleCopy(prompts[item].content, index)}
                                disabled={!prompts[item].content}
                                className="flex-shrink-0 text-xs flex items-center gap-1 px-3 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm font-medium"
                                title="Copiar Prompt"
                            >
                                {copiedIndex === index ? (
                                    <>
                                        <Check size={14} className="text-green-600" />
                                        <span className="text-green-600">Copiado!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} className="text-slate-500" />
                                        <span>Copiar</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Textarea */}
                        <textarea
                            value={prompts[item].content}
                            onChange={(e) => handlePromptChange(item, 'content', e.target.value)}
                            placeholder={'Escreva seu prompt aqui.\nEle será salvo automaticamente...'}
                            className="w-full flex-1 min-h-[160px] px-3 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-indigo-400 resize-none"
                        />
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 w-fit">
                <Check size={14} className="text-green-500" />
                Os prompts são salvos localmente no seu navegador automaticamente.
            </div>
        </div>
    );
}
