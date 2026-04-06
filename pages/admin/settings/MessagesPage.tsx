import React, { useState, useEffect } from 'react';
import { MessageCircle, Save, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { welcomeMessageService, buildMessage } from '../../../services/welcomeMessageService';
import { Customer } from '../../../types/customer';
import { getCompanyData } from '../../../services/companyService';

const PREVIEW_CUSTOMER: Customer = {
    id: 'preview',
    company_id: 'preview',
    name: 'Maria Silva',
    cpf_cnpj: '123.456.789-00',
    phone: '(11) 99999-9999',
    email: 'maria@exemplo.com',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const VARIABLES = [
    { key: '{nome}', desc: 'Nome completo do cliente' },
    { key: '{cpf}', desc: 'CPF formatado' },
    { key: '{senha}', desc: '5 primeiros dígitos do CPF' },
    { key: '{link}', desc: 'Link do portal do cliente' },
];

export default function MessagesPage() {
    const [template, setTemplate] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState('Mercado do Vale');

    useEffect(() => {
        Promise.all([
            welcomeMessageService.getTemplate(),
            getCompanyData(),
        ]).then(([t, company]) => {
            setTemplate(t);
            setCompanyLogo(company.logo || company.logoUrl || null);
            setCompanyName(company.name || 'Mercado do Vale');
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            await welcomeMessageService.saveTemplate(template);
            toast.success('Mensagem salva com sucesso!');
        } catch (err) {
            toast.error('Erro ao salvar mensagem');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setTemplate(welcomeMessageService.getDefaultTemplate());
        toast.info('Template restaurado para o padrão');
    };

    const insertVariable = (key: string) => {
        setTemplate((prev) => prev + key);
    };

    const preview = template ? buildMessage(template, PREVIEW_CUSTOMER) : '';

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Mensagem de Boas-Vindas</h1>
                        <p className="text-sm text-slate-600">
                            Template enviado ao cadastrar cliente via WhatsApp
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar Padrão
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Variables */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-blue-900 mb-2">Variáveis disponíveis — clique para inserir no template:</p>
                <div className="flex flex-wrap gap-2">
                    {VARIABLES.map(({ key, desc }) => (
                        <button
                            key={key}
                            onClick={() => insertVariable(key)}
                            title={desc}
                            className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded-full text-sm font-mono hover:bg-blue-100 transition-colors"
                        >
                            {key}
                            <span className="ml-2 text-xs text-blue-500 font-sans">{desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Banner Moedas do Vale */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-4">
                <span className="text-2xl">🪙</span>
                <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800 mb-1">
                        Programa Moedas do Vale já incluso no template padrão
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        O template padrão já apresenta o programa de fidelidade ao novo cliente.
                        O link do regulamento é gerado automaticamente junto com o link do portal.
                    </p>
                    <a
                        href="/moedas-do-vale"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                    >
                        Visualizar página de regulamento →
                    </a>
                </div>
            </div>

            {/* Editor + Preview */}

            <div className="grid grid-cols-2 gap-6">
                {/* Editor */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Template</span>
                    </div>
                    <textarea
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows={20}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Digite o template da mensagem..."
                    />
                </div>

                {/* Preview */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                            Preview — dados fictícios de exemplo
                        </span>
                    </div>
                    <div className="bg-[#e5ddd5] rounded-lg overflow-hidden">
                        {/* WhatsApp Business header */}
                        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
                            {companyLogo ? (
                                <img
                                    src={companyLogo}
                                    alt={companyName}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                                    {companyName.charAt(0)}
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-sm">{companyName}</p>
                                <p className="text-[11px] text-white/70">mv.mercadodovale.com.br</p>
                            </div>
                        </div>
                        {/* Message bubble */}
                        <div className="p-4 min-h-[320px]">
                            <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm max-w-sm">
                                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                                    {preview || <span className="text-slate-400">Preview aparece aqui...</span>}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
