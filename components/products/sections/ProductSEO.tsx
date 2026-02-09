import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../types/product';
import { ExternalLink } from 'lucide-react';

interface ProductSEOProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors: any;
}

export const ProductSEO: React.FC<ProductSEOProps> = ({
    watch,
    setValue,
    errors
}) => {
    const description = watch('description') || '';
    const metaTitle = watch('meta_title') || '';
    const metaDescription = watch('meta_description') || '';
    const slug = watch('slug') || '';

    return (
        <div className="space-y-6">
            {/* Seção de Ajuda com Links para IAs */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <ExternalLink size={18} />
                    💡 Gerar Conteúdo SEO com IA
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                    Use uma das ferramentas abaixo para gerar conteúdo SEO otimizado. Copie e cole o conteúdo gerado nos campos.
                </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Amigável <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título SEO <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Descrição <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palavras-chave <span className="text-purple-600 font-bold">(SEO)</span>
                </label>
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
