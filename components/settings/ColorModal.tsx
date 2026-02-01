
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Color, ColorInput } from '../../types/color';
import { colorService, COLOR_MAP } from '../../services/colors';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';

// Force recompilation - Color name formatting with cursor preservation
interface ColorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    color?: Color | null;
}

/**
 * Color Modal Component
 * Add/Edit color with form validation and hex preview
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Simple form (name + hex_code + active status)
 * - Auto-generate slug on save
 * - Follows BrandModal pattern
 * - Visual hex color preview
 */
export const ColorModal: React.FC<ColorModalProps> = ({ isOpen, onClose, onSave, color }) => {
    const [name, setName] = useState('');
    const [hexCode, setHexCode] = useState('');
    const [active, setActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
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
    }, [color, isOpen]);

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setError('Nome da cor é obrigatório');
            return;
        }

        if (name.trim().length < 2) {
            setError('Nome deve ter pelo menos 2 caracteres');
            return;
        }

        // Validate hex code if provided
        if (hexCode && !/^#[0-9A-Fa-f]{6}$/.test(hexCode)) {
            setError('Código hexadecimal inválido (use formato #RRGGBB)');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const input: ColorInput = {
                name: name.trim(),
                hex_code: hexCode || undefined,
                active
            };

            if (color) {
                await colorService.update(color.id, input);
            } else {
                await colorService.create(input);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar cor');
        } finally {
            setSaving(false);
        }
    };

    const selectKnownColor = (colorName: string) => {
        setName(colorName);
        setHexCode(COLOR_MAP[colorName]);
    };

    const currentHex = hexCode || COLOR_MAP[name];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {color ? 'Editar Cor' : 'Nova Cor'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
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

                                // Get format from field dictionary
                                const fieldDef = getFieldDefinition('nome_cor');
                                const format = fieldDef?.format || 'titlecase';
                                const formatted = applyFieldFormat(rawValue, format);

                                setName(formatted);

                                // Restore cursor position after formatting
                                setTimeout(() => {
                                    if (inputRef.current) {
                                        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                                    }
                                }, 0);
                            }}
                            placeholder="Ex: Azul Meia-Noite, Preto..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Hex Code Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Código Hexadecimal (opcional)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={hexCode}
                                onChange={(e) => setHexCode(e.target.value)}
                                placeholder="#000000"
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            {currentHex && (
                                <div
                                    className="w-10 h-10 rounded-lg border-2 border-slate-300 shadow-sm"
                                    style={{ backgroundColor: currentHex }}
                                    title={currentHex}
                                />
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Formato: #RRGGBB (ex: #3B82F6)
                        </p>
                    </div>

                    {/* Quick Color Picker */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Cores Rápidas
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(COLOR_MAP).map(([colorName, hex]) => (
                                <button
                                    key={colorName}
                                    type="button"
                                    onClick={() => selectKnownColor(colorName)}
                                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                                    title={`${colorName} (${hex})`}
                                >
                                    <div
                                        className="w-4 h-4 rounded-full border border-slate-300"
                                        style={{ backgroundColor: hex }}
                                    />
                                    {colorName}
                                </button>
                            ))}
                        </div>
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
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
