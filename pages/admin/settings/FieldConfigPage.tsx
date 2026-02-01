import React, { useState, useEffect } from 'react';
import { FileText, Save, RotateCcw, Plus, Trash2, X } from 'lucide-react';
import {
    getRuntimeFieldDictionary,
    updateFieldFormat,
    resetFieldDictionary,
    createCustomField,
    deleteCustomField,
    isCustomField,
    applyFieldFormat,
    FieldFormat,
    FieldDefinition
} from '../../../config/field-dictionary';

/**
 * Field Configuration Page
 * Edit field formatting rules with live updates
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Editable field format configuration
 * - Persists changes to localStorage
 * - Real-time updates to SmartInput components
 * - Create custom fields with personalized formatting
 */
export function FieldConfigPage() {
    const [dictionary, setDictionary] = useState(getRuntimeFieldDictionary());
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
    const [customFieldForm, setCustomFieldForm] = useState({
        key: '',
        label: '',
        placeholder: '',
        format: 'none' as FieldFormat,
        required: false,
        description: '',
        minLength: undefined as number | undefined,
        maxLength: undefined as number | undefined
    });
    const [testText, setTestText] = useState('');

    const fields = Object.entries(dictionary);

    const formatOptions: { value: FieldFormat; label: string; color: string }[] = [
        // Text formats
        { value: 'capitalize', label: 'Capitalize', color: 'bg-blue-100 text-blue-800' },
        { value: 'uppercase', label: 'UPPERCASE', color: 'bg-purple-100 text-purple-800' },
        { value: 'lowercase', label: 'lowercase', color: 'bg-green-100 text-green-800' },
        { value: 'titlecase', label: 'Title Case', color: 'bg-indigo-100 text-indigo-800' },
        { value: 'sentence', label: 'Sentence case', color: 'bg-cyan-100 text-cyan-800' },
        { value: 'slug', label: 'slug-case', color: 'bg-teal-100 text-teal-800' },
        // Number/Document formats
        { value: 'phone', label: 'Telefone', color: 'bg-orange-100 text-orange-800' },
        { value: 'cpf', label: 'CPF', color: 'bg-rose-100 text-rose-800' },
        { value: 'cnpj', label: 'CNPJ', color: 'bg-pink-100 text-pink-800' },
        { value: 'cep', label: 'CEP', color: 'bg-amber-100 text-amber-800' },
        { value: 'brl', label: 'R$ (Real)', color: 'bg-emerald-100 text-emerald-800' },
        { value: 'numeric', label: 'Numérico', color: 'bg-lime-100 text-lime-800' },
        { value: 'alphanumeric', label: 'Alfanumérico', color: 'bg-sky-100 text-sky-800' },
        // Date formats
        { value: 'date_br', label: '📅 DD/MM/YYYY', color: 'bg-blue-100 text-blue-800' },
        { value: 'date_br_short', label: '📅 DD/MM/YY', color: 'bg-indigo-100 text-indigo-800' },
        { value: 'date_iso', label: '📅 YYYY-MM-DD', color: 'bg-cyan-100 text-cyan-800' },
        // Fiscal formats
        { value: 'ncm', label: '📋 NCM (8 dígitos)', color: 'bg-slate-100 text-slate-800' },
        { value: 'ean13', label: '📋 EAN-13 (13 dígitos)', color: 'bg-gray-100 text-gray-800' },
        { value: 'cest', label: '📋 CEST (7 dígitos)', color: 'bg-zinc-100 text-zinc-800' },
        // Specialized components
        { value: 'currency', label: '💰 CurrencyInput', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'imei', label: '📱 IMEIInput', color: 'bg-violet-100 text-violet-800' },
        { value: 'selector', label: '🎯 Selector', color: 'bg-fuchsia-100 text-fuchsia-800' },
        { value: 'none', label: 'None', color: 'bg-slate-100 text-slate-600' }
    ];

    const getFormatBadge = (format: FieldFormat) => {
        const option = formatOptions.find(opt => opt.value === format);
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${option?.color}`}>
                {option?.label || format.toUpperCase()}
            </span>
        );
    };

    const handleFormatChange = (fieldKey: string, newFormat: FieldFormat) => {
        const success = updateFieldFormat(fieldKey, newFormat);
        if (success) {
            setDictionary(getRuntimeFieldDictionary());
            setHasChanges(true);
        }
    };

    const handleReset = () => {
        if (!confirm('Tem certeza que deseja restaurar todas as formatações para os valores padrão?')) {
            return;
        }
        resetFieldDictionary();
        setDictionary(getRuntimeFieldDictionary());
        setHasChanges(false);
    };

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            setHasChanges(false);
            alert('✅ Configurações salvas com sucesso!');
        }, 500);
    };

    const handleCreateCustomField = () => {
        // Validate form
        if (!customFieldForm.key || !customFieldForm.label) {
            alert('❌ Preencha a chave e o label do campo!');
            return;
        }

        const success = createCustomField(customFieldForm.key, {
            label: customFieldForm.label,
            placeholder: customFieldForm.placeholder || '',
            format: customFieldForm.format,
            required: customFieldForm.required,
            description: customFieldForm.description || '',
            minLength: customFieldForm.minLength,
            maxLength: customFieldForm.maxLength
        });

        if (success) {
            setDictionary(getRuntimeFieldDictionary());
            setShowCustomFieldModal(false);
            setCustomFieldForm({
                key: '',
                label: '',
                placeholder: '',
                format: 'none',
                required: false,
                description: '',
                minLength: undefined,
                maxLength: undefined
            });
            alert('✅ Campo customizado criado com sucesso!');
        } else {
            alert('❌ Erro ao criar campo. Verifique se a chave já existe ou contém caracteres inválidos.');
        }
    };

    const handleDeleteCustomField = (key: string) => {
        if (!confirm(`Tem certeza que deseja deletar o campo "${key}"?`)) {
            return;
        }

        const success = deleteCustomField(key);
        if (success) {
            setDictionary(getRuntimeFieldDictionary());
            alert('✅ Campo deletado com sucesso!');
        } else {
            alert('❌ Não é possível deletar campos padrão do sistema.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                        <FileText size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Dicionário de Campos</h1>
                        <p className="text-slate-500">Configure as regras de formatação de todos os campos do sistema</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCustomFieldModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Plus size={18} />
                        Adicionar Campo
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RotateCcw size={18} />
                        Restaurar Padrões
                    </button>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    )}
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-blue-900">Sobre o Dicionário de Campos</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            Este dicionário centraliza as definições de todos os campos de texto do sistema.
                            A formatação é aplicada automaticamente ao digitar nos formulários.
                            <strong className="ml-1">As alterações são salvas localmente e aplicadas em tempo real.</strong>
                        </p>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                            <p className="text-xs text-blue-600">
                                <strong>ℹ️ Sobre "Obrigatório":</strong> A coluna "Obrigatório" indica se o campo é marcado como obrigatório
                                no sistema. Campos com ✓ vermelho são obrigatórios para salvar o formulário.
                                Esta é uma informação <strong>somente leitura</strong> - a validação é definida no código do formulário.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Format Tester */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🧪</span>
                    <div>
                        <h3 className="text-lg font-bold text-purple-900">Testador de Formatações</h3>
                        <p className="text-sm text-purple-700">Digite um texto e veja como cada formatação transforma em tempo real!</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Test Input */}
                    <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">
                            Digite seu texto de teste:
                        </label>
                        <input
                            type="text"
                            value={testText}
                            onChange={(e) => setTestText(e.target.value)}
                            placeholder="Ex: iPhone 14 PRO max, 11987654321, email@EXAMPLE.com"
                            className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        />
                    </div>

                    {/* Live Preview Grid */}
                    {testText && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {formatOptions.filter(opt => opt.value !== 'none').map(option => (
                                <div key={option.value} className="bg-white rounded-lg border-2 border-purple-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${option.color}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                    <code className="block px-3 py-2 bg-purple-50 rounded border border-purple-200 text-sm font-mono text-purple-900 break-all">
                                        {applyFieldFormat(testText, option.value)}
                                    </code>
                                </div>
                            ))}
                        </div>
                    )}

                    {!testText && (
                        <div className="text-center py-8 text-purple-400">
                            <p className="text-sm">👆 Digite algo acima para ver as formatações em ação!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Fields Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Chave do Campo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Label Padrão
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Placeholder
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Formatação
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Obrigatório
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {fields.map(([key, definition]) => (
                            <tr key={key} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-sm">
                                    <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-800">
                                        {key}
                                    </code>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                    {definition.label}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    <span className="italic">{definition.placeholder}</span>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <select
                                        value={definition.format}
                                        onChange={(e) => handleFormatChange(key, e.target.value as FieldFormat)}
                                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        {formatOptions.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-sm text-center">
                                    {definition.required ? (
                                        <span className="text-red-600 font-bold">✓</span>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-center">
                                    {isCustomField(key) ? (
                                        <button
                                            onClick={() => handleDeleteCustomField(key)}
                                            className="text-red-600 hover:text-red-800 transition-colors"
                                            title="Deletar campo customizado"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Total de Campos</p>
                    <p className="text-2xl font-bold text-slate-800">{fields.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Capitalize</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {fields.filter(([, def]) => def.format === 'capitalize').length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Uppercase</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {fields.filter(([, def]) => def.format === 'uppercase').length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Obrigatórios</p>
                    <p className="text-2xl font-bold text-red-600">
                        {fields.filter(([, def]) => def.required).length}
                    </p>
                </div>
            </div>

            {/* Format Legend */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">📖 Legenda de Formatações</h2>
                <p className="text-sm text-slate-600 mb-4">
                    Entenda o que cada tipo de formatação faz e quando usar:
                </p>

                {/* Text Formats */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">📝 Formatações de Texto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Capitalize</span>
                                <span className="text-xs text-blue-700">Primeira letra maiúscula</span>
                            </div>
                            <code className="text-xs">"iphone" → "Iphone"</code>
                        </div>

                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">UPPERCASE</span>
                                <span className="text-xs text-purple-700">Tudo maiúsculo</span>
                            </div>
                            <code className="text-xs">"abc123" → "ABC123"</code>
                        </div>

                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">lowercase</span>
                                <span className="text-xs text-green-700">Tudo minúsculo</span>
                            </div>
                            <code className="text-xs">"EMAIL@EXAMPLE.COM" → "email@example.com"</code>
                        </div>

                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Title Case</span>
                                <span className="text-xs text-indigo-700">Cada palavra maiúscula</span>
                            </div>
                            <code className="text-xs">"iphone 14 pro" → "Iphone 14 Pro"</code>
                        </div>

                        <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">Sentence</span>
                                <span className="text-xs text-cyan-700">Primeira de cada frase</span>
                            </div>
                            <code className="text-xs">"hello. world" → "Hello. World"</code>
                        </div>

                        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">slug-case</span>
                                <span className="text-xs text-teal-700">URL amigável</span>
                            </div>
                            <code className="text-xs">"iPhone 14 Pró" → "iphone-14-pro"</code>
                        </div>
                    </div>
                </div>

                {/* Number/Document Formats */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">🔢 Formatações de Números e Documentos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Telefone</span>
                                <span className="text-xs text-orange-700">Formato brasileiro</span>
                            </div>
                            <code className="text-xs">"11987654321" → "(11) 98765-4321"</code>
                        </div>

                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">CPF</span>
                                <span className="text-xs text-rose-700">Formato CPF</span>
                            </div>
                            <code className="text-xs">"12345678901" → "123.456.789-01"</code>
                        </div>

                        <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">CNPJ</span>
                                <span className="text-xs text-pink-700">Formato CNPJ</span>
                            </div>
                            <code className="text-xs">"12345678000190" → "12.345.678/0001-90"</code>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">CEP</span>
                                <span className="text-xs text-amber-700">Formato CEP</span>
                            </div>
                            <code className="text-xs">"12345678" → "12345-678"</code>
                        </div>

                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">R$ (Real)</span>
                                <span className="text-xs text-emerald-700">Moeda brasileira</span>
                            </div>
                            <code className="text-xs">"123456" → "R$ 1.234,56"</code>
                        </div>

                        <div className="p-3 bg-lime-50 rounded-lg border border-lime-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">Numérico</span>
                                <span className="text-xs text-lime-700">Apenas números</span>
                            </div>
                            <code className="text-xs">"ABC-123-XYZ" → "123"</code>
                        </div>

                        <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">Alfanumérico</span>
                                <span className="text-xs text-sky-700">Letras e números</span>
                            </div>
                            <code className="text-xs">"ABC-123-XYZ!" → "ABC123XYZ"</code>
                        </div>
                    </div>
                </div>

                {/* Date Formats */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">📅 Formatações de Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">📅 DD/MM/YYYY</span>
                                <span className="text-xs text-blue-700">Data brasileira completa</span>
                            </div>
                            <code className="text-xs">"31012026" → "31/01/2026"</code>
                        </div>

                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">📅 DD/MM/YY</span>
                                <span className="text-xs text-indigo-700">Data brasileira curta</span>
                            </div>
                            <code className="text-xs">"310126" → "31/01/26"</code>
                        </div>

                        <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">📅 YYYY-MM-DD</span>
                                <span className="text-xs text-cyan-700">Data ISO (bancos de dados)</span>
                            </div>
                            <code className="text-xs">"20260131" → "2026-01-31"</code>
                        </div>
                    </div>
                </div>

                {/* Fiscal Formats */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 Formatações Fiscais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">📋 NCM (8 dígitos)</span>
                                <span className="text-xs text-slate-700">Nomenclatura Mercosul</span>
                            </div>
                            <code className="text-xs">"ABC12345678XYZ" → "12345678"</code>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">📋 EAN-13 (13 dígitos)</span>
                                <span className="text-xs text-gray-700">Código de barras</span>
                            </div>
                            <code className="text-xs">"ABC7891234567890XYZ" → "7891234567890"</code>
                        </div>

                        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">📋 CEST (7 dígitos)</span>
                                <span className="text-xs text-zinc-700">Código tributário</span>
                            </div>
                            <code className="text-xs">"ABC1234567XYZ" → "1234567"</code>
                        </div>
                    </div>
                </div>

                {/* Specialized Components */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">⚙️ Componentes Especializados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">💰 CurrencyInput</span>
                                <span className="text-xs text-yellow-700">Protocolo 02</span>
                            </div>
                            <code className="text-xs">Armazena como INTEGER CENTS (1050 = R$ 10,50)</code>
                        </div>

                        <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">📱 IMEIInput</span>
                                <span className="text-xs text-violet-700">15 dígitos</span>
                            </div>
                            <code className="text-xs">Validação especializada de IMEI</code>
                        </div>

                        <div className="p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-fuchsia-100 text-fuchsia-800">🎯 Selector</span>
                                <span className="text-xs text-fuchsia-700">Componente dedicado</span>
                            </div>
                            <code className="text-xs">ColorSelect, BrandSelect, VersionSelect, etc.</code>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div>
                            <h3 className="text-sm font-semibold text-amber-900 mb-1">Dica Importante</h3>
                            <p className="text-xs text-amber-700">
                                A formatação é aplicada <strong>automaticamente enquanto você digita</strong> nos formulários.
                                Você não precisa se preocupar em digitar corretamente - o sistema formata para você!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Field Modal */}
            {showCustomFieldModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">Adicionar Campo Customizado</h2>
                            <button
                                onClick={() => setShowCustomFieldModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Info Alert */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-xs text-blue-700">
                                    <strong>💡 Dica:</strong> Campos customizados são úteis para adicionar informações específicas do seu negócio
                                    que não existem nos campos padrão do sistema. Eles funcionam com o componente SmartInput.
                                </p>
                            </div>

                            {/* Key */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Chave do Campo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customFieldForm.key}
                                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') })}
                                    placeholder="Ex: numero_serie"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    📌 <strong>Identificador único</strong> do campo no código. Apenas letras minúsculas e underscores (_).
                                    Exemplo: <code className="px-1 bg-slate-100 rounded">numero_serie</code>, <code className="px-1 bg-slate-100 rounded">data_garantia</code>
                                </p>
                            </div>

                            {/* Label */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Label <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customFieldForm.label}
                                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, label: e.target.value })}
                                    placeholder="Ex: Número de Série"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    🏷️ <strong>Texto que aparece</strong> acima do campo no formulário. Use um nome claro e descritivo para o usuário.
                                </p>
                            </div>

                            {/* Placeholder */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Placeholder
                                </label>
                                <input
                                    type="text"
                                    value={customFieldForm.placeholder}
                                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, placeholder: e.target.value })}
                                    placeholder="Ex: Digite o número de série..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    💬 <strong>Texto de ajuda</strong> que aparece dentro do campo quando está vazio. Dê um exemplo ou instrução.
                                </p>
                            </div>

                            {/* Format */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Formatação
                                </label>
                                <select
                                    value={customFieldForm.format}
                                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, format: e.target.value as FieldFormat })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                >
                                    {formatOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    ✨ <strong>Como o texto será formatado</strong> automaticamente ao digitar:
                                </p>
                                <ul className="text-xs text-slate-600 mt-1 ml-4 space-y-0.5">
                                    <li>• <strong>Capitalize:</strong> Primeira letra maiúscula → "Iphone 14"</li>
                                    <li>• <strong>UPPERCASE:</strong> Tudo maiúsculo → "ABC-123"</li>
                                    <li>• <strong>lowercase:</strong> Tudo minúsculo → "email@exemplo.com"</li>
                                    <li>• <strong>None:</strong> Sem formatação (mantém como digitado)</li>
                                </ul>

                                {/* Real-time Preview */}
                                <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                                    <p className="text-xs font-semibold text-green-800 mb-2">🔍 Preview em Tempo Real:</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-600 w-20">Entrada:</span>
                                            <code className="flex-1 px-2 py-1 bg-white rounded border border-green-200 text-xs font-mono text-slate-700">
                                                {customFieldForm.format === 'phone' && '"11987654321"'}
                                                {customFieldForm.format === 'cpf' && '"12345678901"'}
                                                {customFieldForm.format === 'cnpj' && '"12345678000190"'}
                                                {customFieldForm.format === 'cep' && '"12345678"'}
                                                {customFieldForm.format === 'brl' && '"123456"'}
                                                {customFieldForm.format === 'numeric' && '"ABC-123-XYZ"'}
                                                {customFieldForm.format === 'alphanumeric' && '"ABC-123-XYZ!"'}
                                                {customFieldForm.format === 'slug' && '"iPhone 14 Pró Max"'}
                                                {customFieldForm.format === 'date_br' && '"31012026"'}
                                                {customFieldForm.format === 'date_br_short' && '"310126"'}
                                                {customFieldForm.format === 'date_iso' && '"20260131"'}
                                                {customFieldForm.format === 'ncm' && '"ABC12345678XYZ"'}
                                                {customFieldForm.format === 'ean13' && '"ABC7891234567890XYZ"'}
                                                {customFieldForm.format === 'cest' && '"ABC1234567XYZ"'}
                                                {!['phone', 'cpf', 'cnpj', 'cep', 'brl', 'numeric', 'alphanumeric', 'slug', 'date_br', 'date_br_short', 'date_iso', 'ncm', 'ean13', 'cest'].includes(customFieldForm.format) && '"iPhone 14 PRO max"'}
                                            </code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-green-700 w-20 font-semibold">Saída:</span>
                                            <code className="flex-1 px-2 py-1 bg-white rounded border border-green-300 text-xs font-mono text-green-800 font-bold">
                                                {customFieldForm.format === 'capitalize' && '"Iphone 14 pro max"'}
                                                {customFieldForm.format === 'uppercase' && '"IPHONE 14 PRO MAX"'}
                                                {customFieldForm.format === 'lowercase' && '"iphone 14 pro max"'}
                                                {customFieldForm.format === 'titlecase' && '"Iphone 14 Pro Max"'}
                                                {customFieldForm.format === 'sentence' && '"Iphone 14 pro max"'}
                                                {customFieldForm.format === 'slug' && '"iphone-14-pro-max"'}
                                                {customFieldForm.format === 'phone' && '"(11) 98765-4321"'}
                                                {customFieldForm.format === 'cpf' && '"123.456.789-01"'}
                                                {customFieldForm.format === 'cnpj' && '"12.345.678/0001-90"'}
                                                {customFieldForm.format === 'cep' && '"12345-678"'}
                                                {customFieldForm.format === 'brl' && '"R$ 1.234,56"'}
                                                {customFieldForm.format === 'numeric' && '"123"'}
                                                {customFieldForm.format === 'alphanumeric' && '"ABC123XYZ"'}
                                                {customFieldForm.format === 'date_br' && '"31/01/2026"'}
                                                {customFieldForm.format === 'date_br_short' && '"31/01/26"'}
                                                {customFieldForm.format === 'date_iso' && '"2026-01-31"'}
                                                {customFieldForm.format === 'ncm' && '"12345678"'}
                                                {customFieldForm.format === 'ean13' && '"7891234567890"'}
                                                {customFieldForm.format === 'cest' && '"1234567"'}
                                                {customFieldForm.format === 'none' && '"iPhone 14 PRO max"'}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Descrição
                                </label>
                                <textarea
                                    value={customFieldForm.description}
                                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, description: e.target.value })}
                                    placeholder="Ex: Número de série do fabricante para rastreamento de garantia"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    📝 <strong>Descrição técnica</strong> do campo (opcional). Aparece como ajuda no formulário.
                                </p>
                            </div>

                            {/* Character Length Validation */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Min Length */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Mínimo de Caracteres
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={customFieldForm.minLength ?? ''}
                                        onChange={(e) => setCustomFieldForm({
                                            ...customFieldForm,
                                            minLength: e.target.value ? parseInt(e.target.value) : undefined
                                        })}
                                        placeholder="Ex: 3"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        📏 <strong>Mínimo</strong> de caracteres permitidos (opcional)
                                    </p>
                                </div>

                                {/* Max Length */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Máximo de Caracteres
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={customFieldForm.maxLength ?? ''}
                                        onChange={(e) => setCustomFieldForm({
                                            ...customFieldForm,
                                            maxLength: e.target.value ? parseInt(e.target.value) : undefined
                                        })}
                                        placeholder="Ex: 50"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        📏 <strong>Máximo</strong> de caracteres permitidos (opcional)
                                    </p>
                                </div>
                            </div>

                            {/* Validation Example */}
                            {(customFieldForm.minLength || customFieldForm.maxLength) && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-800">
                                        <strong>✓ Validação configurada:</strong>
                                        {customFieldForm.minLength && customFieldForm.maxLength && (
                                            <> O campo deve ter entre <strong>{customFieldForm.minLength}</strong> e <strong>{customFieldForm.maxLength}</strong> caracteres.</>
                                        )}
                                        {customFieldForm.minLength && !customFieldForm.maxLength && (
                                            <> O campo deve ter no mínimo <strong>{customFieldForm.minLength}</strong> caracteres.</>
                                        )}
                                        {!customFieldForm.minLength && customFieldForm.maxLength && (
                                            <> O campo deve ter no máximo <strong>{customFieldForm.maxLength}</strong> caracteres.</>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Required Checkbox */}
                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="required"
                                        checked={customFieldForm.required}
                                        onChange={(e) => setCustomFieldForm({ ...customFieldForm, required: e.target.checked })}
                                        className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500 mt-0.5"
                                    />
                                    <div>
                                        <label htmlFor="required" className="text-sm font-medium text-slate-700 cursor-pointer">
                                            Campo obrigatório
                                        </label>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            ⚠️ Se marcado, o campo será obrigatório no formulário (aparece com asterisco vermelho *)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCustomFieldModal(false)}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateCustomField}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Criar Campo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
