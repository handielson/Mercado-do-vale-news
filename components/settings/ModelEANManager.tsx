import React, { useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import type { ModelEAN } from '../../types/model-architecture';
import { modelEANsService } from '../../services/model-eans';

interface ModelEANManagerProps {
    eans: ModelEAN[];
    modelId?: string;
    onEANsChange: (eans: ModelEAN[]) => void;
    onError: (error: string) => void;
}

export const ModelEANManager: React.FC<ModelEANManagerProps> = ({
    eans,
    modelId,
    onEANsChange,
    onError
}) => {
    const [newEan, setNewEan] = useState('');
    const [newEanCountry, setNewEanCountry] = useState('BR');

    const handleAdd = async () => {
        if (!newEan || newEan.length !== 13) {
            onError('EAN deve ter exatamente 13 dígitos');
            return;
        }

        if (!modelEANsService.validateEAN13(newEan)) {
            onError('EAN inválido (checksum incorreto)');
            return;
        }

        if (!modelId) {
            // Adicionar à lista temporária
            onEANsChange([...eans, {
                id: `temp-${Date.now()}`,
                model_id: '',
                ean: newEan,
                country_code: newEanCountry,
                is_primary: eans.length === 0,
                created_at: new Date().toISOString()
            }]);
            setNewEan('');
            onError('');
            return;
        }

        try {
            const newEanRecord = await modelEANsService.add({
                model_id: modelId,
                ean: newEan,
                country_code: newEanCountry,
                is_primary: eans.length === 0
            });
            onEANsChange([...eans, newEanRecord]);
            setNewEan('');
            onError('');
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Erro ao adicionar EAN');
        }
    };

    const handleRemove = async (eanId: string) => {
        if (eanId.startsWith('temp-')) {
            onEANsChange(eans.filter(e => e.id !== eanId));
            return;
        }

        try {
            await modelEANsService.remove(eanId);
            onEANsChange(eans.filter(e => e.id !== eanId));
        } catch (err) {
            onError('Erro ao remover EAN');
        }
    };

    const handleSetPrimary = async (eanId: string) => {
        if (eanId.startsWith('temp-')) {
            onEANsChange(eans.map(e => ({ ...e, is_primary: e.id === eanId })));
            return;
        }

        try {
            await modelEANsService.setPrimary(eanId);
            onEANsChange(eans.map(e => ({ ...e, is_primary: e.id === eanId })));
        } catch (err) {
            onError('Erro ao definir EAN principal');
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                🏷️ Códigos EAN
            </h3>

            {/* Lista de EANs */}
            {eans.length > 0 && (
                <div className="space-y-2">
                    {eans.map((ean) => (
                        <div key={ean.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                            <button
                                onClick={() => handleSetPrimary(ean.id)}
                                className={`p-1 ${ean.is_primary ? 'text-yellow-500' : 'text-slate-300'}`}
                                title="Definir como principal"
                            >
                                <Star size={16} fill={ean.is_primary ? 'currentColor' : 'none'} />
                            </button>
                            <span className="flex-1 text-sm font-mono">{ean.ean}</span>
                            <span className="text-xs text-slate-500">{ean.country_code}</span>
                            <button
                                onClick={() => handleRemove(ean.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Adicionar EAN */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newEan}
                    onChange={(e) => setNewEan(e.target.value.replace(/\D/g, '').slice(0, 13))}
                    placeholder="Código EAN (13 dígitos)"
                    maxLength={13}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={newEanCountry}
                    onChange={(e) => setNewEanCountry(e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="BR">BR</option>
                    <option value="CN">CN</option>
                    <option value="IN">IN</option>
                    <option value="US">US</option>
                </select>
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus size={16} />
                    Adicionar
                </button>
            </div>
        </div>
    );
};
