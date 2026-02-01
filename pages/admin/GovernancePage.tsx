import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, FileCode, Database, Activity, Zap, Package } from 'lucide-react';
import { categoryService } from '../../services/categories';
import { Category } from '../../types/category';

/**
 * Governance Dashboard
 * Living documentation of development standards and category configuration audit
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Documents Anti-NaN patterns
 * - Shows Traffic Light configuration matrix
 * - Serves as development reference
 */
export function GovernancePage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await categoryService.list();
                setCategories(data);
            } catch (error) {
                console.error('Error loading categories:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const systemFields = [
        { key: 'imei1', label: 'IMEI 1', type: 'Estoque' },
        { key: 'imei2', label: 'IMEI 2', type: 'Estoque' },
        { key: 'serial', label: 'Serial', type: 'Estoque' },
        { key: 'color', label: 'Cor', type: 'Produto' },
        { key: 'storage', label: 'Armazenamento', type: 'Produto' },
        { key: 'ram', label: 'Memória RAM', type: 'Produto' },
        { key: 'version', label: 'Versão', type: 'Produto' },
        { key: 'battery_health', label: 'Saúde Bateria', type: 'Estoque' }
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'required':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">🟢 Obrigatório</span>;
            case 'optional':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">🟡 Opcional</span>;
            default:
                return <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">⚪ Oculto</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Shield size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Governança do Sistema</h1>
                    <p className="text-slate-500">Protocolos de desenvolvimento e auditoria de campos.</p>
                </div>
            </div>

            {/* Development Protocols */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Protocol 01: Anti-NaN */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <FileCode size={20} className="text-blue-500" />
                        Protocolo 01: Padrão Numérico (Anti-NaN)
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">z.coerce.number()</code> nos Schemas Zod.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Inicie valores numéricos com <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">0</code>, nunca <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">undefined</code>.</span>
                        </li>
                        <li className="flex gap-2">
                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <span>Evite <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">valueAsNumber: true</code> em inputs HTML.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">.transform()</code> para converter vazios em <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">undefined</code>.</span>
                        </li>
                    </ul>
                </div>

                {/* Protocol 02: Currency */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Zap size={20} className="text-emerald-500" />
                        Protocolo 02: Valores Monetários
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>SEMPRE use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">&lt;CurrencyInput /&gt;</code> para dinheiro.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Armazene valores como <strong>INTEGER CENTS</strong> (1050 = R$ 10,50).</span>
                        </li>
                        <li className="flex gap-2">
                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <span>NUNCA use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">type="number"</code> para valores monetários.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Formatação automática ao sair do campo (onBlur).</span>
                        </li>
                    </ul>
                </div>

                {/* Protocol 03: New Fields */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Database size={20} className="text-purple-500" />
                        Protocolo 03: Adicionar Novos Campos
                    </h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                        <li>Adicionar chave em <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">CategoryConfig</code> (types).</li>
                        <li>Definir padrão em <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">defaultCategories</code> (services).</li>
                        <li>Adicionar controle em <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">CategoryEditModal</code>.</li>
                        <li>Atualizar <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">ProductForm</code> com renderização condicional.</li>
                    </ol>
                </div>

                {/* Protocol 04: localStorage */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Package size={20} className="text-orange-500" />
                        Protocolo 04: Persistência Local
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Chaves: <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">antigravity_*_v1</code></span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Salvar após cada operação CRUD (create, update, delete).</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Carregar na inicialização com fallback para defaults.</span>
                        </li>
                        <li className="flex gap-2">
                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <span>Sempre usar <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">try/catch</code> ao acessar localStorage.</span>
                        </li>
                    </ul>
                </div>

                {/* Protocol 05: IMEI Validation */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Shield size={20} className="text-indigo-500" />
                        Protocolo 05: Validação IMEI (15 Dígitos)
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>SEMPRE use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">&lt;IMEIInput /&gt;</code> para campos IMEI.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Validação: <strong>Exatamente 15 dígitos numéricos</strong>.</span>
                        </li>
                        <li className="flex gap-2">
                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <span>Bloqueia automaticamente letras, símbolos e espaços.</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Feedback visual: Contador (X/15), cores (cinza/laranja/verde).</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span>Campos: <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">imei1</code> e <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">imei2</code> (dual IMEI).</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Configuration Matrix */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-500" />
                        Matriz de Configuração (Traffic Light)
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Auditoria visual das configurações de campos por categoria
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3 sticky left-0 bg-slate-50 z-10">Campo</th>
                                {categories.map(cat => (
                                    <th key={cat.id} className="px-6 py-3 text-center border-l border-slate-200">
                                        {cat.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {systemFields.map(field => (
                                <tr key={field.key} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700 sticky left-0 bg-white z-10">
                                        {field.label}
                                        <span className="text-[10px] text-slate-400 uppercase ml-2 font-normal">
                                            {field.type}
                                        </span>
                                    </td>
                                    {categories.map(cat => (
                                        <td key={cat.id} className="px-6 py-4 text-center border-l border-slate-200">
                                            {/* @ts-ignore */}
                                            {getStatusIcon(cat.config[field.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Shield size={16} />
                    Legenda do Traffic Light
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-green-600 font-bold">🟢 Obrigatório:</span>
                        <span className="text-slate-600">Campo deve ser preenchido</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-yellow-600 font-bold">🟡 Opcional:</span>
                        <span className="text-slate-600">Campo pode ser vazio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">⚪ Oculto:</span>
                        <span className="text-slate-600">Campo não aparece no formulário</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
