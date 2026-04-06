
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { Color, ColorInput } from '../../types/color';
import { colorService } from '../../services/colors';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';

interface ColorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    color?: Color | null;
}

// Paleta completa de cores em português com hex codes
const COLOR_PALETTE: { name: string; hex: string }[] = [
    // Pretos e Cinzas
    { name: 'Preto', hex: '#000000' },
    { name: 'Preto Fosco', hex: '#1C1C1C' },
    { name: 'Carvão', hex: '#36454F' },
    { name: 'Grafite', hex: '#2F4F4F' },
    { name: 'Cinza Escuro', hex: '#4A4A4A' },
    { name: 'Cinza', hex: '#6B7280' },
    { name: 'Cinza Médio', hex: '#9CA3AF' },
    { name: 'Cinza Claro', hex: '#D1D5DB' },
    { name: 'Cinza Prata', hex: '#C0C0C0' },
    { name: 'Prata', hex: '#9CA3AF' },
    // Brancos
    { name: 'Branco', hex: '#FFFFFF' },
    { name: 'Off White', hex: '#FAF9F6' },
    { name: 'Branco Perolado', hex: '#F5F5F5' },
    { name: 'Creme', hex: '#FFFDD0' },
    { name: 'Marfim', hex: '#FFFFF0' },
    { name: 'Champagne', hex: '#F7E7CE' },
    // Amarelos e Dourados
    { name: 'Amarelo', hex: '#EAB308' },
    { name: 'Amarelo Claro', hex: '#FEF08A' },
    { name: 'Amarelo Ouro', hex: '#FFD700' },
    { name: 'Ouro', hex: '#FFD700' },
    { name: 'Dourado', hex: '#F59E0B' },
    { name: 'Mel', hex: '#FFC30B' },
    { name: 'Mostarda', hex: '#FFDB58' },
    { name: 'Baunilha', hex: '#F3E5AB' },
    // Laranjas
    { name: 'Laranja', hex: '#F97316' },
    { name: 'Laranja Escuro', hex: '#EA580C' },
    { name: 'Tangerina', hex: '#F28500' },
    { name: 'Coral', hex: '#FF7F50' },
    { name: 'Pêssego', hex: '#FFCBA4' },
    { name: 'Salmão', hex: '#FA8072' },
    { name: 'Terracota', hex: '#E2725B' },
    { name: 'Ferrugem', hex: '#C23B22' },
    // Vermelhos
    { name: 'Vermelho', hex: '#EF4444' },
    { name: 'Vermelho Escuro', hex: '#B91C1C' },
    { name: 'Vermelho Vivo', hex: '#FF0000' },
    { name: 'Cereja', hex: '#DE3163' },
    { name: 'Framboesa', hex: '#C72C6B' },
    { name: 'Bordô', hex: '#800020' },
    { name: 'Vinho', hex: '#722F37' },
    { name: 'Borgonha', hex: '#800000' },
    // Rosas
    { name: 'Rosa', hex: '#EC4899' },
    { name: 'Rosa Claro', hex: '#FBCFE8' },
    { name: 'Rosa Bebê', hex: '#FFB6C1' },
    { name: 'Rosa Chique', hex: '#FF69B4' },
    { name: 'Rosa Escuro', hex: '#C2185B' },
    { name: 'Fúcsia', hex: '#FF77FF' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Nude', hex: '#F5CBA7' },
    // Roxos e Lilás
    { name: 'Roxo', hex: '#8B5CF6' },
    { name: 'Roxo Escuro', hex: '#6D28D9' },
    { name: 'Violeta', hex: '#EE82EE' },
    { name: 'Lilás', hex: '#C8A2C8' },
    { name: 'Lavanda', hex: '#E6E6FA' },
    { name: 'Índigo', hex: '#4B0082' },
    { name: 'Anil', hex: '#233E8B' },
    // Azuis
    { name: 'Azul', hex: '#3B82F6' },
    { name: 'Azul Claro', hex: '#93C5FD' },
    { name: 'Azul Celeste', hex: '#87CEEB' },
    { name: 'Azul Bebê', hex: '#89CFF0' },
    { name: 'Azul Bebê Escuro', hex: '#6CB4E4' },
    { name: 'Azul Royal', hex: '#4169E1' },
    { name: 'Azul Cobalto', hex: '#0047AB' },
    { name: 'Azul Marinho', hex: '#001F5B' },
    { name: 'Azul Petróleo', hex: '#005F6B' },
    { name: 'Azul Meia-Noite', hex: '#191970' },
    { name: 'Azul Safira', hex: '#0F52BA' },
    { name: 'Ciano', hex: '#00FFFF' },
    { name: 'Azul Turquesa', hex: '#00CED1' },
    // Verdes
    { name: 'Verde', hex: '#10B981' },
    { name: 'Verde Claro', hex: '#86EFAC' },
    { name: 'Verde Limão', hex: '#32CD32' },
    { name: 'Verde Menta', hex: '#98FF98' },
    { name: 'Verde Musgo', hex: '#8A9A5B' },
    { name: 'Verde Oliva', hex: '#808000' },
    { name: 'Verde Militar', hex: '#4B5320' },
    { name: 'Verde Esmeralda', hex: '#50C878' },
    { name: 'Verde Água', hex: '#00CED1' },
    { name: 'Verde Floresta', hex: '#228B22' },
    { name: 'Pistache', hex: '#93C572' },
    { name: 'Turquesa', hex: '#40E0D0' },
    { name: 'Tiffany', hex: '#0ABAB5' },
    // Marrons e Terrosos
    { name: 'Marrom', hex: '#8B4513' },
    { name: 'Marrom Claro', hex: '#A0785A' },
    { name: 'Caramelo', hex: '#AF6E2C' },
    { name: 'Khaki', hex: '#C3B091' },
    { name: 'Bege', hex: '#F5F5DC' },
    { name: 'Cobre', hex: '#B87333' },
    { name: 'Bronze', hex: '#CD7F32' },
    { name: 'Caramel', hex: '#C68642' },
    { name: 'Cacau', hex: '#5C3D2E' },
    { name: 'Canela', hex: '#D2691E' },
];

export const ColorModal: React.FC<ColorModalProps> = ({ isOpen, onClose, onSave, color }) => {
    const [name, setName] = useState('');
    const [hexCode, setHexCode] = useState('');
    const [active, setActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (color) {
            setName(color.name);
            setHexCode(color.hex_code || '');
            setActive(color.active);
        } else {
            setName('');
            setHexCode('');
            setActive(true);
        }
        setError('');
        setSearch('');
    }, [color, isOpen]);

    // Filtra paleta por pesquisa
    const filteredColors = useMemo(() => {
        if (!search.trim()) return [];
        const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return COLOR_PALETTE.filter(c =>
            c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
        ).slice(0, 24);
    }, [search]);

    const handleSave = async () => {
        if (!name.trim()) { setError('Nome da cor é obrigatório'); return; }
        if (name.trim().length < 2) { setError('Nome deve ter pelo menos 2 caracteres'); return; }
        if (hexCode && !/^#[0-9A-Fa-f]{6}$/.test(hexCode)) { setError('Código hexadecimal inválido (use formato #RRGGBB)'); return; }

        setSaving(true);
        setError('');
        try {
            const input: ColorInput = { name: name.trim(), hex_code: hexCode || undefined, active };
            if (color) { await colorService.update(color.id, input); }
            else { await colorService.create(input); }
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar cor');
        } finally {
            setSaving(false);
        }
    };

    const selectPaletteColor = (c: { name: string; hex: string }) => {
        setName(c.name);
        setHexCode(c.hex);
        setSearch('');
    };

    const currentHex = hexCode;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">
                        {color ? 'Editar Cor' : 'Nova Cor'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">

                    {/* Busca de cor por nome */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            🔍 Buscar Cor na Paleta
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Digite para buscar: azul, verde, rosa..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>

                        {/* Resultados da busca */}
                        {filteredColors.length > 0 && (
                            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <p className="text-xs text-slate-500 mb-2">{filteredColors.length} cor(es) encontrada(s) — clique para selecionar:</p>
                                <div className="flex flex-wrap gap-2">
                                    {filteredColors.map((c) => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => selectPaletteColor(c)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-xs font-medium shadow-sm"
                                            title={c.hex}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                                                style={{ backgroundColor: c.hex }}
                                            />
                                            {c.name}
                                            <span className="text-slate-400 font-mono">{c.hex}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {search.trim() && filteredColors.length === 0 && (
                            <p className="text-xs text-slate-500 mt-2 px-1">
                                Nenhuma cor encontrada para "{search}". Preencha o nome e hex manualmente abaixo.
                            </p>
                        )}
                    </div>

                    {/* Preview da cor selecionada */}
                    {currentHex && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div
                                className="w-12 h-12 rounded-xl border-2 border-white shadow-md shrink-0"
                                style={{ backgroundColor: currentHex }}
                            />
                            <div>
                                <p className="font-semibold text-slate-800 text-sm">{name || 'Cor selecionada'}</p>
                                <p className="font-mono text-xs text-slate-500">{currentHex}</p>
                            </div>
                        </div>
                    )}

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nome da Cor <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => {
                                const cursorPosition = e.target.selectionStart || 0;
                                const rawValue = e.target.value;
                                const fieldDef = getFieldDefinition('nome_cor');
                                const format = fieldDef?.format || 'titlecase';
                                const formatted = applyFieldFormat(rawValue, format);
                                setName(formatted);
                                setTimeout(() => {
                                    if (inputRef.current) inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                                }, 0);
                            }}
                            placeholder="Ex: Azul Meia-Noite, Verde Esmeralda..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Hex Code Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Código Hexadecimal
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={hexCode}
                                onChange={(e) => setHexCode(e.target.value)}
                                placeholder="#000000"
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            {/* Native color picker */}
                            <input
                                type="color"
                                value={currentHex || '#000000'}
                                onChange={(e) => setHexCode(e.target.value)}
                                className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                title="Escolher cor"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Formato: #RRGGBB — ou use o seletor de cor →</p>
                    </div>

                    {/* Active Checkbox */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="color-active"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="color-active" className="text-sm text-slate-700 cursor-pointer">
                            Cor Ativa (visível no cadastro de produtos)
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? 'Salvando...' : (color ? 'Salvar Alterações' : `Cadastrar ${name || 'Cor'}`)}
                    </button>
                </div>
            </div>
        </div>
    );
};
