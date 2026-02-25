import React, { useState, useEffect } from 'react';
import { Bot, Copy, ExternalLink, Check, Sparkles } from 'lucide-react';

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
        prompt1: '',
        prompt2: '',
        prompt3: ''
    });
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setPrompts(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved prompts');
            }
        }
    }, []);

    // Save to localStorage when changed
    const handlePromptChange = (key: keyof typeof prompts, value: string) => {
        const newPrompts = { ...prompts, [key]: value };
        setPrompts(newPrompts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrompts));
    };

    const handleCopy = (text: string, index: number) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { id: 'prompt1' as const, label: 'Prompt 1 (Ex: Geração de Especificações)' },
                    { id: 'prompt2' as const, label: 'Prompt 2 (Ex: Descrição de Marketing)' },
                    { id: 'prompt3' as const, label: 'Prompt 3 (Ex: FAQ e Diferenciais)' },
                ].map((item, index) => (
                    <div key={item.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Bot size={16} className="text-indigo-500" />
                                {item.label}
                            </label>
                            <button
                                onClick={() => handleCopy(prompts[item.id], index)}
                                disabled={!prompts[item.id]}
                                className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                title="Copiar Prompt"
                            >
                                {copiedIndex === index ? (
                                    <>
                                        <Check size={14} className="text-green-600" />
                                        <span className="text-green-600">Copiado!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        <span>Copiar</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <textarea
                            value={prompts[item.id]}
                            onChange={(e) => handlePromptChange(item.id, e.target.value)}
                            placeholder={'Escreva seu prompt aqui. Ele será salvo automaticamente...'}
                            className="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none bg-slate-50 focus:bg-white transition-colors"
                        />
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-400 italic">
                * Os prompts são salvos localmente no seu navegador automaticamente.
            </p>
        </div>
    );
}
