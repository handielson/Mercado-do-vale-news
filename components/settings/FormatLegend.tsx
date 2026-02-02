import React from 'react';
import { FieldFormat } from '../../config/field-dictionary';

interface FormatLegendProps {
    formatOptions: { value: FieldFormat; label: string; color: string }[];
}

/**
 * FormatLegend
 * Documentation of all available field formats with examples
 */
export function FormatLegend({ formatOptions }: FormatLegendProps) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">📖 Legenda de Formatações</h2>
            <p className="text-sm text-slate-600 mb-4">
                Entenda o que cada tipo de formatação faz e quando usar:
            </p>

            {/* Text Formats */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">📝 Formatações de Texto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormatExample
                        label="Capitalize"
                        description="Primeira letra maiúscula"
                        example='"iphone" → "Iphone"'
                        color="bg-blue-50 border-blue-200 text-blue-700"
                        badgeColor="bg-blue-100 text-blue-800"
                    />
                    <FormatExample
                        label="UPPERCASE"
                        description="Tudo maiúsculo"
                        example='"abc123" → "ABC123"'
                        color="bg-purple-50 border-purple-200 text-purple-700"
                        badgeColor="bg-purple-100 text-purple-800"
                    />
                    <FormatExample
                        label="lowercase"
                        description="Tudo minúsculo"
                        example='"EMAIL@EXAMPLE.COM" → "email@example.com"'
                        color="bg-green-50 border-green-200 text-green-700"
                        badgeColor="bg-green-100 text-green-800"
                    />
                    <FormatExample
                        label="Title Case"
                        description="Cada palavra maiúscula"
                        example='"iphone 14 pro" → "Iphone 14 Pro"'
                        color="bg-indigo-50 border-indigo-200 text-indigo-700"
                        badgeColor="bg-indigo-100 text-indigo-800"
                    />
                    <FormatExample
                        label="Sentence"
                        description="Primeira de cada frase"
                        example='"hello. world" → "Hello. World"'
                        color="bg-cyan-50 border-cyan-200 text-cyan-700"
                        badgeColor="bg-cyan-100 text-cyan-800"
                    />
                    <FormatExample
                        label="slug-case"
                        description="URL amigável"
                        example='"iPhone 14 Pró" → "iphone-14-pro"'
                        color="bg-teal-50 border-teal-200 text-teal-700"
                        badgeColor="bg-teal-100 text-teal-800"
                    />
                </div>
            </div>

            {/* Number/Document Formats */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">🔢 Formatações de Números e Documentos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormatExample
                        label="Telefone"
                        description="Formato brasileiro"
                        example='"11987654321" → "(11) 98765-4321"'
                        color="bg-orange-50 border-orange-200 text-orange-700"
                        badgeColor="bg-orange-100 text-orange-800"
                    />
                    <FormatExample
                        label="CPF"
                        description="Formato CPF"
                        example='"12345678901" → "123.456.789-01"'
                        color="bg-rose-50 border-rose-200 text-rose-700"
                        badgeColor="bg-rose-100 text-rose-800"
                    />
                    <FormatExample
                        label="CNPJ"
                        description="Formato CNPJ"
                        example='"12345678000190" → "12.345.678/0001-90"'
                        color="bg-pink-50 border-pink-200 text-pink-700"
                        badgeColor="bg-pink-100 text-pink-800"
                    />
                    <FormatExample
                        label="CEP"
                        description="Formato CEP"
                        example='"12345678" → "12345-678"'
                        color="bg-amber-50 border-amber-200 text-amber-700"
                        badgeColor="bg-amber-100 text-amber-800"
                    />
                    <FormatExample
                        label="R$ (Real)"
                        description="Moeda brasileira"
                        example='"123456" → "R$ 1.234,56"'
                        color="bg-emerald-50 border-emerald-200 text-emerald-700"
                        badgeColor="bg-emerald-100 text-emerald-800"
                    />
                    <FormatExample
                        label="Numérico"
                        description="Apenas números"
                        example='"ABC-123-XYZ" → "123"'
                        color="bg-lime-50 border-lime-200 text-lime-700"
                        badgeColor="bg-lime-100 text-lime-800"
                    />
                    <FormatExample
                        label="Alfanumérico"
                        description="Letras e números"
                        example='"ABC-123-XYZ!" → "ABC123XYZ"'
                        color="bg-sky-50 border-sky-200 text-sky-700"
                        badgeColor="bg-sky-100 text-sky-800"
                    />
                </div>
            </div>

            {/* Date Formats */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">📅 Formatações de Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormatExample
                        label="📅 DD/MM/YYYY"
                        description="Data brasileira completa"
                        example='"31012026" → "31/01/2026"'
                        color="bg-blue-50 border-blue-200 text-blue-700"
                        badgeColor="bg-blue-100 text-blue-800"
                    />
                    <FormatExample
                        label="📅 DD/MM/YY"
                        description="Data brasileira curta"
                        example='"310126" → "31/01/26"'
                        color="bg-indigo-50 border-indigo-200 text-indigo-700"
                        badgeColor="bg-indigo-100 text-indigo-800"
                    />
                    <FormatExample
                        label="📅 YYYY-MM-DD"
                        description="Data ISO (bancos de dados)"
                        example='"20260131" → "2026-01-31"'
                        color="bg-cyan-50 border-cyan-200 text-cyan-700"
                        badgeColor="bg-cyan-100 text-cyan-800"
                    />
                </div>
            </div>

            {/* Fiscal Formats */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 Formatações Fiscais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormatExample
                        label="📋 NCM (8 dígitos)"
                        description="Nomenclatura Mercosul"
                        example='"ABC12345678XYZ" → "12345678"'
                        color="bg-slate-50 border-slate-200 text-slate-700"
                        badgeColor="bg-slate-100 text-slate-800"
                    />
                    <FormatExample
                        label="📋 EAN-13 (13 dígitos)"
                        description="Código de barras"
                        example='"ABC7891234567890XYZ" → "7891234567890"'
                        color="bg-gray-50 border-gray-200 text-gray-700"
                        badgeColor="bg-gray-100 text-gray-800"
                    />
                    <FormatExample
                        label="📋 CEST (7 dígitos)"
                        description="Código tributário"
                        example='"ABC1234567XYZ" → "1234567"'
                        color="bg-zinc-50 border-zinc-200 text-zinc-700"
                        badgeColor="bg-zinc-100 text-zinc-800"
                    />
                </div>
            </div>

            {/* Specialized Components */}
            <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">⚙️ Componentes Especializados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormatExample
                        label="💰 CurrencyInput"
                        description="Protocolo 02"
                        example="Armazena como INTEGER CENTS (1050 = R$ 10,50)"
                        color="bg-yellow-50 border-yellow-200 text-yellow-700"
                        badgeColor="bg-yellow-100 text-yellow-800"
                    />
                    <FormatExample
                        label="📱 IMEIInput"
                        description="15 dígitos"
                        example="Validação especializada de IMEI"
                        color="bg-violet-50 border-violet-200 text-violet-700"
                        badgeColor="bg-violet-100 text-violet-800"
                    />
                    <FormatExample
                        label="🎯 Selector"
                        description="Componente dedicado"
                        example="ColorSelect, BrandSelect, VersionSelect, etc."
                        color="bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700"
                        badgeColor="bg-fuchsia-100 text-fuchsia-800"
                    />
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
    );
}

// Helper component for format examples
function FormatExample({
    label,
    description,
    example,
    color,
    badgeColor
}: {
    label: string;
    description: string;
    example: string;
    color: string;
    badgeColor: string;
}) {
    return (
        <div className={`p-3 rounded-lg border ${color}`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                    {label}
                </span>
                <span className="text-xs">{description}</span>
            </div>
            <code className="text-xs">{example}</code>
        </div>
    );
}
