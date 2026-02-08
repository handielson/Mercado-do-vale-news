import { useState } from 'react';
import { AIProvider } from '../../../types/ai-provider';
import { Sparkles, Loader2 } from 'lucide-react';

interface ProductSEOProps {
    watch: any;
    setValue: any;
    errors: any;
    productName: string;
    productData: any;
}

export const ProductSEO: React.FC<ProductSEOProps> = ({
    watch,
    setValue,
    errors,
    productName,
    productData
}) => {
    const [selectedAI, setSelectedAI] = useState<AIProvider>('gemini');
    const [isGenerating, setIsGenerating] = useState(false);
    const [customPrompt, setCustomPrompt] = useState(
        'Gere conteúdo SEO otimizado para este produto. Inclua descrição detalhada (mínimo 300 palavras), título atrativo, meta descrição persuasiva e palavras-chave relevantes. Foque em benefícios e diferenciais do produto.'
    );

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const handleAIGeneration = async () => {
        if (!productName || !productData.brand || !productData.model) {
            alert('⚠️ Preencha Nome, Marca e Modelo antes de gerar SEO');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await fetch('/api/ai/generate-seo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedAI,
                    prompt: customPrompt,
                    productData
                })
            });

            if (!response.ok) {
                throw new Error('Erro na resposta da API');
            }

            const data = await response.json();

            // Preencher campos automaticamente
            setValue('description', data.description);
            setValue('slug', data.slug);
            setValue('meta_title', data.meta_title);
            setValue('meta_description', data.meta_description);
            setValue('keywords', data.keywords);

            alert('✅ Conteúdo SEO gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar SEO:', error);
            alert('❌ Erro ao gerar conteúdo SEO. Verifique se a API está configurada corretamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Seletor de IA + Botão Gerar */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-purple-600" size={20} />
                    <h3 className="font-semibold text-purple-900">Geração Automática por IA</h3>
                </div>

                {/* Seletor de Provedor */}
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Escolha a IA
                    </label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setSelectedAI('gemini')}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${selectedAI === 'gemini'
                                    ? 'border-purple-500 bg-purple-100 text-purple-900 font-semibold'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                                }`}
                        >
                            Gemini
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedAI('grok')}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${selectedAI === 'grok'
                                    ? 'border-purple-500 bg-purple-100 text-purple-900 font-semibold'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                                }`}
                        >
                            Grok
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedAI('chatgpt')}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${selectedAI === 'chatgpt'
                                    ? 'border-purple-500 bg-purple-100 text-purple-900 font-semibold'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                                }`}
                        >
                            ChatGPT
                        </button>
                    </div>
                </div>

                {/* Prompt Editável */}
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prompt para IA (Editável)
                    </label>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Descreva como a IA deve gerar o conteúdo..."
                    />
                </div>

                {/* Botão Gerar */}
                <button
                    type="button"
                    onClick={handleAIGeneration}
                    disabled={isGenerating || !productName}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Gerando com {selectedAI}...
                        </>
                    ) : (
                        <>
                            <Sparkles size={20} />
                            Gerar Conteúdo SEO com {selectedAI}
                        </>
                    )}
                </button>
            </div>

            {/* Campos SEO com Label (SEO) destacado */}

            {/* Descrição */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do Produto <span className="text-purple-600 font-bold">(SEO)</span> *
                </label>
                <textarea
                    value={watch('description') || ''}
                    onChange={(e) => setValue('description', e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-purple-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Descrição detalhada do produto para SEO e página de produto..."
                />
                <p className="text-xs text-gray-500 mt-1">
                    Descrição completa que aparecerá na página do produto. Importante para SEO (mínimo 300 palavras).
                </p>
            </div>

            {/* URL Slug */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Amigável <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={watch('slug') || ''}
                        onChange={(e) => setValue('slug', e.target.value)}
                        className="flex-1 rounded-md border border-purple-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="iphone-15-pro-max-256gb-preto"
                    />
                    <button
                        type="button"
                        onClick={() => setValue('slug', generateSlug(productName))}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-sm font-medium transition-colors"
                    >
                        Gerar
                    </button>
                </div>
                <p className="text-xs text-purple-600 mt-1">
                    URL: /produto/{watch('slug') || 'slug-do-produto'}
                </p>
            </div>

            {/* Meta Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título SEO <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
                <input
                    type="text"
                    value={watch('meta_title') || ''}
                    onChange={(e) => setValue('meta_title', e.target.value)}
                    maxLength={60}
                    className="w-full rounded-md border border-purple-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="iPhone 15 Pro Max 256GB Preto | Mercado do Vale"
                />
                <p className="text-xs text-purple-600 mt-1 font-medium">
                    {(watch('meta_title') || '').length}/60 caracteres
                </p>
            </div>

            {/* Meta Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Descrição <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
                <textarea
                    value={watch('meta_description') || ''}
                    onChange={(e) => setValue('meta_description', e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="w-full rounded-md border border-purple-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Compre iPhone 15 Pro Max 256GB Preto com melhor preço. Entrega rápida e garantia de 1 ano."
                />
                <p className="text-xs text-purple-600 mt-1 font-medium">
                    {(watch('meta_description') || '').length}/160 caracteres
                </p>
            </div>

            {/* Keywords */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palavras-chave <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
                <input
                    type="text"
                    value={(watch('keywords') || []).join(', ')}
                    onChange={(e) => setValue('keywords', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
                    className="w-full rounded-md border border-purple-300 p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="iphone, apple, smartphone, 5g"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Separe as palavras-chave com vírgulas
                </p>
            </div>
        </div>
    );
};
