import React, { useState } from 'react';
import { BookOpen, Calendar, FileCode, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface DiaryEntry {
    date: string;
    title: string;
    description: string;
    filesModified: string[];
    features: string[];
    status: 'completed' | 'in-progress' | 'planned';
}

/**
 * Development Diary Page
 * Historical log of daily development activities
 * 
 * PURPOSE:
 * - Track what was done each day
 * - Document modified files
 * - Provide security and traceability
 * - Facilitate project handover
 */
export function DevDiaryPage() {
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

    // Diary entries (can be moved to localStorage or database later)
    const entries: DiaryEntry[] = [
        {
            date: '2026-01-30',
            title: 'Implementação IMEI Dual + Campos Customizados Editáveis',
            description: 'Substituído campo único IMEI por IMEI1 e IMEI2 com validação rigorosa de 15 dígitos. Adicionada funcionalidade de edição para campos customizados.',
            filesModified: [
                'types/category.ts',
                'services/categories.ts',
                'components/categories/CategoryEditModal.tsx',
                'components/ui/IMEIInput.tsx',
                'components/products/ProductForm.tsx',
                'components/categories/CustomFieldsEditor.tsx',
                'pages/admin/GovernancePage.tsx'
            ],
            features: [
                'IMEI1 e IMEI2 com validação de 15 dígitos numéricos',
                'Componente IMEIInput com feedback visual em tempo real',
                'Bloqueio automático de letras e símbolos',
                'Edição de campos customizados com modal reutilizável',
                'Protocolo 05 adicionado à Governança',
                'Matriz de configuração atualizada'
            ],
            status: 'completed'
        },
        {
            date: '2026-01-29',
            title: 'Gestão de Modelos e Campos Dinâmicos',
            description: 'Implementação completa do sistema de modelos de produtos e campos customizados dinâmicos por categoria.',
            filesModified: [
                'types/category.ts',
                'services/models.ts',
                'components/categories/CustomFieldsEditor.tsx',
                'components/products/ProductForm.tsx',
                'pages/admin/ModelsPage.tsx'
            ],
            features: [
                'CRUD completo de modelos de produtos',
                'Campos customizados dinâmicos por categoria',
                'Traffic Light Pattern para campos customizados',
                'Validação de tipos (text, number, dropdown, textarea)'
            ],
            status: 'completed'
        },
        {
            date: '2026-01-28',
            title: 'Sistema de Marcas e Categorias',
            description: 'Implementação do gerenciamento de marcas e refinamento do sistema de categorias com Traffic Light Pattern.',
            filesModified: [
                'types/brand.ts',
                'services/brands.ts',
                'components/brands/BrandModal.tsx',
                'pages/admin/BrandsPage.tsx',
                'components/categories/CategoryEditModal.tsx'
            ],
            features: [
                'CRUD de marcas com logo upload',
                'Traffic Light Pattern para configuração de campos',
                'Interface de 3 estados: Oculto/Opcional/Obrigatório',
                'Validação de slugs únicos'
            ],
            status: 'completed'
        }
    ];

    const getStatusBadge = (status: DiaryEntry['status']) => {
        switch (status) {
            case 'completed':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">✅ Concluído</span>;
            case 'in-progress':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">🔄 Em Andamento</span>;
            case 'planned':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">📋 Planejado</span>;
        }
    };

    const toggleEntry = (date: string) => {
        setExpandedEntry(expandedEntry === date ? null : date);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <BookOpen size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Diário de Desenvolvimento</h1>
                    <p className="text-slate-500">Registro histórico de todas as implementações e mudanças no sistema.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">
                                {entries.filter(e => e.status === 'completed').length}
                            </p>
                            <p className="text-xs text-slate-500">Implementações Concluídas</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FileCode size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">
                                {entries.reduce((acc, e) => acc + e.filesModified.length, 0)}
                            </p>
                            <p className="text-xs text-slate-500">Arquivos Modificados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{entries.length}</p>
                            <p className="text-xs text-slate-500">Dias de Desenvolvimento</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Entries Timeline */}
            <div className="space-y-4">
                {entries.map((entry) => (
                    <div
                        key={entry.date}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                        {/* Entry Header */}
                        <button
                            onClick={() => toggleEntry(entry.date)}
                            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Calendar size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-slate-800">{entry.title}</h3>
                                        {getStatusBadge(entry.status)}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Clock size={14} />
                                        <span>{new Date(entry.date).toLocaleDateString('pt-BR', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}</span>
                                    </div>
                                </div>
                            </div>
                            {expandedEntry === entry.date ? (
                                <ChevronUp size={20} className="text-slate-400" />
                            ) : (
                                <ChevronDown size={20} className="text-slate-400" />
                            )}
                        </button>

                        {/* Entry Details */}
                        {expandedEntry === entry.date && (
                            <div className="px-6 pb-6 space-y-4 border-t border-slate-100">
                                {/* Description */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">📝 Descrição</h4>
                                    <p className="text-sm text-slate-600">{entry.description}</p>
                                </div>

                                {/* Features */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">✨ Funcionalidades Implementadas</h4>
                                    <ul className="space-y-1">
                                        {entry.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                                <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Files Modified */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                        📂 Arquivos Modificados ({entry.filesModified.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {entry.filesModified.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <FileCode size={14} className="text-blue-500 flex-shrink-0" />
                                                <code className="text-xs text-slate-700 truncate">{file}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <BookOpen size={16} />
                    Sobre o Diário de Desenvolvimento
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                    <p>• Registro completo de todas as mudanças no sistema</p>
                    <p>• Rastreabilidade de arquivos modificados</p>
                    <p>• Facilita handover e manutenção futura</p>
                    <p>• Documentação viva do projeto</p>
                </div>
            </div>
        </div>
    );
}
