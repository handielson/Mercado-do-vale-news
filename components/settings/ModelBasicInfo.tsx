import React from 'react';

interface ModelBasicInfoProps {
    name: string;
    brandId: string;
    categoryId: string;
    description: string;
    brands: any[];
    categories: any[];
    loading: boolean;
    onNameChange: (value: string) => void;
    onBrandChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

export const ModelBasicInfo: React.FC<ModelBasicInfoProps> = ({
    name,
    brandId,
    categoryId,
    description,
    brands,
    categories,
    loading,
    onNameChange,
    onBrandChange,
    onCategoryChange,
    onDescriptionChange
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Informações Básicas
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Marca <span className="text-red-500">*</span>
                    </label>
                    {loading ? (
                        <div className="text-sm text-slate-500">Carregando...</div>
                    ) : (
                        <select
                            value={brandId}
                            onChange={(e) => onBrandChange(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            {brands.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Categoria
                    </label>
                    {loading ? (
                        <div className="text-sm text-slate-500">Carregando...</div>
                    ) : (
                        <select
                            value={categoryId}
                            onChange={(e) => onCategoryChange(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Modelo <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Ex: Xiaomi Redmi Note 15 Pro"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição (SEO: 300-350 palavras)
                </label>
                <textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="Descrição otimizada para SEO com 300-350 palavras..."
                    rows={6}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {(() => {
                    const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
                    const isOptimal = wordCount >= 300 && wordCount <= 350;
                    const isAcceptable = wordCount >= 250 && wordCount < 300;
                    const isTooShort = wordCount < 250;
                    const isTooLong = wordCount > 350;

                    let colorClass = 'text-slate-500';
                    let icon = '📝';
                    let message = `${wordCount} palavras`;

                    if (isOptimal) {
                        colorClass = 'text-green-600 font-semibold';
                        icon = '✅';
                        message = `${wordCount} palavras - Ótimo para SEO!`;
                    } else if (isAcceptable) {
                        colorClass = 'text-yellow-600';
                        icon = '⚠️';
                        message = `${wordCount} palavras - Adicione mais ${300 - wordCount} palavras`;
                    } else if (isTooShort) {
                        colorClass = 'text-red-600';
                        icon = '❌';
                        message = `${wordCount} palavras - Mínimo 300 para SEO`;
                    } else if (isTooLong) {
                        colorClass = 'text-orange-600';
                        icon = '⚠️';
                        message = `${wordCount} palavras - Reduza ${wordCount - 350} palavras`;
                    }

                    return (
                        <p className={`text-xs mt-1 ${colorClass}`}>
                            {icon} {message}
                        </p>
                    );
                })()}
            </div>
        </div>
    );
};
