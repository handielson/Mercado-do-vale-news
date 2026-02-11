import React, { useEffect } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../types/product';
import { ExternalLink, RefreshCw } from 'lucide-react';

interface ProductSEOProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors: any;
}

// Funções de geração automática
const generateSlug = (name: string): string => {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .replace(/-+/g, '-') // Remove hífens duplicados
        .replace(/^-|-$/g, ''); // Remove hífens no início/fim
};

const generateMetaTitle = (name: string): string => {
    if (!name) return '';
    const suffix = ' | Mercado do Vale';
    const maxLength = 60;
    const availableLength = maxLength - suffix.length;

    if (name.length + suffix.length <= maxLength) {
        return name + suffix;
    }

    return name.substring(0, availableLength - 3) + '...' + suffix;
};

const generateMetaDescription = (
    name: string,
    brand?: string,
    model?: string
): string => {
    if (!name) return '';

    const brandModel = [brand, model].filter(Boolean).join(' ');
    const template = brandModel
        ? `Compre ${name} na Mercado do Vale. ${brandModel} com garantia. Melhor preço e condições de pagamento.`
        : `Compre ${name} na Mercado do Vale. Produto com garantia. Melhor preço e condições de pagamento.`;

    if (template.length <= 160) {
        return template;
    }

    // Versão curta se ultrapassar
    const shortTemplate = brandModel
        ? `${name} na Mercado do Vale. ${brandModel}. Melhor preço.`
        : `${name} na Mercado do Vale. Melhor preço.`;

    return shortTemplate.substring(0, 160);
};

const generateKeywords = (
    name: string,
    brand?: string,
    model?: string,
    category?: string
): string[] => {
    const keywords = new Set<string>();

    // Adiciona marca
    if (brand) keywords.add(brand.toLowerCase());

    // Adiciona modelo
    if (model) keywords.add(model.toLowerCase());

    // Adiciona categoria
    if (category) keywords.add(category.toLowerCase());

    // Adiciona palavras do nome (> 3 caracteres)
    if (name) {
        name.split(/\s+/).forEach(word => {
            // Se contém barra (RAM/Storage), separa
            if (word.includes('/')) {
                word.split('/').forEach(part => {
                    const clean = part.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (clean.length > 2) keywords.add(clean);
                });
            } else {
                const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (clean.length > 3) keywords.add(clean);
            }
        });
    }

    // Adiciona loja
    keywords.add('mercado do vale');

    return Array.from(keywords).slice(0, 10); // Máximo 10 keywords
};

export const ProductSEO: React.FC<ProductSEOProps> = ({
    watch,
    setValue,
    errors
}) => {
    const description = watch('description') || '';
    const metaTitle = watch('meta_title') || '';
    const metaDescription = watch('meta_description') || '';
    const slug = watch('slug') || '';

    const name = watch('name') || '';
    const brand = watch('brand') || '';
    const model = watch('model') || '';
    const category = watch('category') || '';

    // Template de prompt padrão
    const defaultPrompt = `Gere conteúdo SEO otimizado para o seguinte produto:

Nome: ${name || '[Nome do Produto]'}
Marca: ${brand || '[Marca]'}
Modelo: ${model || '[Modelo]'}
Categoria: ${category || '[Categoria]'}

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
    "description": "descrição detalhada do produto com mínimo 300 palavras, destacando benefícios, especificações técnicas e diferenciais",
    "slug": "url-amigavel-sem-acentos-minusculas",
    "meta_title": "título SEO com máximo 60 caracteres incluindo nome da loja",
    "meta_description": "meta descrição persuasiva com máximo 160 caracteres destacando benefícios",
    "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}`;

    const [aiPrompt, setAiPrompt] = React.useState(defaultPrompt);
    const [promptCopied, setPromptCopied] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    // Atualizar prompt quando dados do produto mudarem
    React.useEffect(() => {
        setAiPrompt(defaultPrompt);
    }, [name, brand, model, category]);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(aiPrompt);
            setPromptCopied(true);

            // Clear previous timeout to prevent accumulation
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setPromptCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } catch (err) {
            console.error('Erro ao copiar prompt:', err);
        }
    };

    // Auto-preencher campos SEO quando dados do produto mudarem
    useEffect(() => {
        // Auto-preencher apenas se campo estiver vazio
        if (name && !slug) {
            setValue('slug', generateSlug(name));
        }

        if (name && !metaTitle) {
            setValue('meta_title', generateMetaTitle(name));
        }

        if (name && !metaDescription) {
            setValue('meta_description', generateMetaDescription(name, brand, model));
        }

        if (name && (!watch('keywords') || watch('keywords')?.length === 0)) {
            setValue('keywords', generateKeywords(name, brand, model, category));
        }
    }, [name, brand, model, category]); // Roda quando esses campos mudarem

    // Funções para regenerar manualmente
    const handleRegenerateSlug = () => {
        setValue('slug', generateSlug(name));
    };

    const handleRegenerateMetaTitle = () => {
        setValue('meta_title', generateMetaTitle(name));
    };

    const handleRegenerateMetaDescription = () => {
        setValue('meta_description', generateMetaDescription(name, brand, model));
    };

    const handleRegenerateKeywords = () => {
        setValue('keywords', generateKeywords(name, brand, model, category));
    };

    return (
        <div className="space-y-6">
            {/* Seção de Ajuda com Links para IAs */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <ExternalLink size={18} />
                    💡 Gerar Conteúdo SEO com IA
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                    Use uma das ferramentas abaixo para gerar conteúdo SEO otimizado. Copie o prompt e cole na IA escolhida.
                </p>

                {/* Campo de Prompt Editável */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-blue-900">
                            Prompt para IA (editável)
                        </label>
                        <button
                            type="button"
                            onClick={handleCopyPrompt}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                            {promptCopied ? '✓ Copiado!' : '📋 Copiar Prompt'}
                        </button>
                    </div>
                    <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 text-xs font-mono border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                        placeholder="Edite o prompt conforme necessário..."
                    />
                    <p className="text-xs text-blue-600 mt-1">
                        💡 Dica: Edite o prompt para personalizar a geração. O prompt é atualizado automaticamente quando você preenche os dados do produto.
                    </p>
                </div>

                {/* Botões de Links para IAs */}
                <div className="flex flex-wrap gap-2">
                    <a
                        href="https://gemini.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                        <ExternalLink size={16} />
                        Abrir Gemini
                    </a>
                    <a
                        href="https://www.perplexity.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
                    >
                        <ExternalLink size={16} />
                        Abrir Perplexity
                    </a>
                    <a
                        href="https://x.com/i/grok"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
                    >
                        <ExternalLink size={16} />
                        Abrir Grok
                    </a>
                    <a
                        href="https://chat.openai.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                    >
                        <ExternalLink size={16} />
                        Abrir ChatGPT
                    </a>
                </div>
            </div>

            {/* Campo: Descrição do Produto */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do Produto <span className="text-purple-600 font-bold">(SEO)</span> *
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setValue('description', e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Descrição detalhada do produto para SEO (mínimo 300 palavras recomendado)"
                />
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">
                        Mínimo recomendado: 300 palavras
                    </span>
                    <span className={`text-xs font-medium ${description.length >= 300 ? 'text-green-600' : 'text-gray-500'}`}>
                        {description.split(/\s+/).filter(w => w.length > 0).length} palavras
                    </span>
                </div>
                {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
            </div>

            {/* Campo: URL Amigável (Slug) */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                        URL Amigável <span className="text-purple-600 font-bold">(SEO)</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleRegenerateSlug}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title="Regenerar automaticamente"
                    >
                        <RefreshCw size={12} />
                        Regenerar
                    </button>
                </div>
                <input
                    type="text"
                    value={slug}
                    onChange={(e) => setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="produto-exemplo-slug"
                />
                {slug && (
                    <p className="mt-1 text-xs text-gray-500">
                        Preview: <span className="font-mono text-blue-600">mercadodovale.com.br/produto/{slug}</span>
                    </p>
                )}
                {errors.slug && (
                    <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
                )}
            </div>

            {/* Campo: Título SEO */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                        Título SEO <span className="text-purple-600 font-bold">(SEO)</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleRegenerateMetaTitle}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title="Regenerar automaticamente"
                    >
                        <RefreshCw size={12} />
                        Regenerar
                    </button>
                </div>
                <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setValue('meta_title', e.target.value)}
                    maxLength={60}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Título otimizado para motores de busca"
                />
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">
                        Máximo: 60 caracteres
                    </span>
                    <span className={`text-xs font-medium ${metaTitle.length > 60 ? 'text-red-600' : metaTitle.length > 50 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {metaTitle.length}/60
                    </span>
                </div>
                {errors.meta_title && (
                    <p className="mt-1 text-sm text-red-600">{errors.meta_title.message}</p>
                )}
            </div>

            {/* Campo: Meta Descrição */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                        Meta Descrição <span className="text-purple-600 font-bold">(SEO)</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleRegenerateMetaDescription}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title="Regenerar automaticamente"
                    >
                        <RefreshCw size={12} />
                        Regenerar
                    </button>
                </div>
                <textarea
                    value={metaDescription}
                    onChange={(e) => setValue('meta_description', e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Descrição persuasiva que aparecerá nos resultados de busca"
                />
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">
                        Máximo: 160 caracteres
                    </span>
                    <span className={`text-xs font-medium ${metaDescription.length > 160 ? 'text-red-600' : metaDescription.length > 150 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {metaDescription.length}/160
                    </span>
                </div>
                {errors.meta_description && (
                    <p className="mt-1 text-sm text-red-600">{errors.meta_description.message}</p>
                )}
            </div>

            {/* Campo: Palavras-chave */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                        Palavras-chave <span className="text-purple-600 font-bold">(SEO)</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleRegenerateKeywords}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title="Regenerar automaticamente"
                    >
                        <RefreshCw size={12} />
                        Regenerar
                    </button>
                </div>
                <input
                    type="text"
                    value={watch('keywords')?.join(', ') || ''}
                    onChange={(e) => {
                        const keywords = e.target.value
                            .split(',')
                            .map(k => k.trim())
                            .filter(k => k.length > 0);
                        setValue('keywords', keywords);
                    }}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="palavra1, palavra2, palavra3, palavra4, palavra5"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Separe as palavras-chave com vírgulas. Recomendado: 5-10 palavras-chave relevantes.
                </p>
                {errors.keywords && (
                    <p className="mt-1 text-sm text-red-600">{errors.keywords.message}</p>
                )}
            </div>
        </div>
    );
};
