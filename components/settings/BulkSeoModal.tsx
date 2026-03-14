import React, { useState } from 'react';
import { Sparkles, Copy, ExternalLink, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Model } from '../../types/model';
import { Brand } from '../../types/brand';
import { modelService } from '../../services/models';

interface BulkSeoModalProps {
    isOpen: boolean;
    onClose: () => void;
    models: Model[];
    brands: Brand[];
    onSuccess: () => void;
}

export function BulkSeoModal({ isOpen, onClose, models, brands, onSuccess }: BulkSeoModalProps) {
    const [jsonInput, setJsonInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    if (!isOpen) return null;

    const getBrandName = (brandId: string) => brands.find(b => b.id === brandId)?.name || 'Desconhecida';

    const getCategoryName = (categoryId?: string | null) => {
        // We aren't passing categories down right now, but we can just say "Categoria X" or omit
        return categoryId ? categoryId : 'Geral';
    };

    // Gera o prompt de listagem
    const promptText = `Atue como um Especialista em SEO de E-commerce. O usuário irá enviar uma lista de modelos de produtos. Para cada um, gere um JSON contendo os dados de SEO focados na intenção de busca transacional.

RETORNE APENAS UM ARRAY DE OBJETOS JSON, LIGADO PELO \`id\` DO MODELO.
NENHUM OUTRO TEXTO OU MARKDOWN (NÃO ENVIE \`\`\`json). O retorno tem que ser perfeitamente parseável por JSON.parse().

Modelo do Array:
[
  {
    "id": "UUID-DO-MODELO",
    "description": "Uma descrição comercial persuasiva (HTML Básico permitido como <b>, <br> <p>) destacando benefícios e diferenciais do aparelho/produto. Foco em conversão. Ao menos 3 parágrafos.",
    "slug": "url-amigavel-do-produto",
    "meta_title": "Título SEO atrativo com intenção de compra (Máx 60 caracteres)",
    "meta_description": "Meta descrição contendo gatilhos mentais e CTA (Máx 160 caracteres)",
    "keywords": "palavra1, palavra-chave dois, smartphone"
  }
]

Aqui está a lista de produtos para este processo em lote:

${models.map((m, i) => `--- MODELO ${i + 1} ---
ID: ${m.id}
Nome: ${m.name}
Marca: ${getBrandName(m.brand_id)}`).join('\n\n')}
`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(promptText);
        toast.success('Prompt copiado! Cole no Gemini.');
    };

    const handleApply = async () => {
        if (!jsonInput.trim()) {
            toast.error('Cole o JSON retornado pela IA primeiro.');
            return;
        }

        try {
            setSaving(true);
            const parsedArray = JSON.parse(jsonInput.replace(/```json/g, '').replace(/```/g, '').trim());

            if (!Array.isArray(parsedArray)) {
                throw new Error('O JSON retornado não é um array válido.');
            }

            let successCount = 0;
            let errorCount = 0;
            
            setProgress({ current: 0, total: parsedArray.length });

            // Lote de atualizações
            for (let i = 0; i < parsedArray.length; i++) {
                const seoData = parsedArray[i];
                const { id, description, slug, meta_title, meta_description, keywords } = seoData;
                
                if (!id) {
                    setProgress(p => ({ ...p, current: i + 1 }));
                    continue;
                }

                const model = models.find(m => m.id === id);
                if (!model) {
                    setProgress(p => ({ ...p, current: i + 1 }));
                    continue;
                }

                const currentValues = model.template_values || {};
                
                const updatedValues = {
                    ...currentValues,
                    slug: slug || currentValues['slug'],
                    meta_title: meta_title || currentValues['meta_title'],
                    meta_description: meta_description || currentValues['meta_description'],
                    keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : currentValues['keywords']
                };

                try {
                    await modelService.update(id, {
                        name: model.name,
                        brand_id: model.brand_id,
                        category_id: model.category_id,
                        description: description || model.description,
                        template_values: updatedValues
                    });
                    successCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Falha ao atualizar modelo', id, e);
                }
                
                setProgress(p => ({ ...p, current: i + 1 }));
            }

            toast.success(`SEO aplicado: ${successCount} atualizados, ${errorCount} erros.`);
            onSuccess();
            onClose();

        } catch (e: any) {
            toast.error('Erro ao interpretar o JSON: ' + (e.message || 'Formato inválido.'));
        } finally {
            setSaving(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Gerador SEO em Lote (Em Massa)</h2>
                            <p className="text-sm text-slate-500">Gere SEO para {models.length} modelos de uma vez usando IA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <Info size={18} /> Passo 1: Copie o Prompt
                        </h3>
                        <p className="text-sm text-blue-800 mb-3">
                            Este prompt contém todos os detalhes dos <strong>{models.length}</strong> modelos selecionados. Copie e cole na sua IA favorita.
                        </p>
                        <div className="relative">
                            <textarea
                                readOnly
                                value={promptText}
                                rows={6}
                                className="w-full text-xs font-mono bg-white border border-blue-200 rounded p-3 text-slate-700 outline-none"
                            />
                            <button
                                onClick={copyToClipboard}
                                className="absolute top-2 right-2 p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded flex items-center gap-1 text-xs font-semibold shadow-sm"
                            >
                                <Copy size={14} /> Copiar Prompt
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                                <ExternalLink size={16} /> Abrir Gemini
                            </a>
                            <a href="https://chat.openai.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm">
                                <ExternalLink size={16} /> Abrir ChatGPT
                            </a>
                        </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                        <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                            <Sparkles size={18} /> Passo 2: Cole o JSON Retornado
                        </h3>
                        <p className="text-sm text-purple-800 mb-3">
                            A IA deve ter gerado um Array (lista) JSON contendo os dados dos modelos. Cole-o no campo abaixo:
                        </p>
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-3 text-xs font-mono border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 bg-white"
                            placeholder='[\n  {\n    "id": "...",\n    "description": "...",\n    ...\n  }\n]'
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={saving || !jsonInput.trim()}
                        className="relative flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md overflow-hidden min-w-[200px]"
                    >
                        {saving && progress.total > 0 && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-purple-800/40 transition-all duration-300" 
                                style={{ width: `${(progress.current / progress.total) * 100}%` }} 
                            />
                        )}
                        <span className="relative flex items-center gap-2">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {saving && progress.total > 0 ? `Salvando (${progress.current}/${progress.total})...` : saving ? 'Aplicando...' : 'Aplicar SEO em Lote'}
                        </span>
                    </button>
                </div>

            </div>
        </div>
    );
}
