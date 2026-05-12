import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService, type PdpSectionHeader } from '@/services/vpsApiService';

/**
 * Gerencia a lista de frases que viram cabeçalhos com negrito + linha em branco
 * na descrição pública dos produtos (PublicProductPage). Persistido na VPS em
 * `pdp_section_headers`.
 */
export const PdpSectionHeadersPanel: React.FC = () => {
    const [items, setItems] = useState<PdpSectionHeader[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPhrase, setNewPhrase] = useState('');
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const rows = await vpsApiService.getPdpSectionHeaders();
        setItems(Array.isArray(rows) ? rows : []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        const phrase = newPhrase.trim();
        if (!phrase) return;
        setSaving(true);
        const maxOrder = items.reduce((acc, it) => Math.max(acc, it.sort_order || 0), 0);
        const result = await vpsApiService.createPdpSectionHeader({
            phrase,
            sort_order: maxOrder + 10,
        });
        setSaving(false);
        if (result && 'error' in result) {
            toast.error(result.error);
            return;
        }
        toast.success('Cabeçalho adicionado');
        setNewPhrase('');
        await load();
    };

    const handleRemove = async (item: PdpSectionHeader) => {
        if (!confirm(`Remover "${item.phrase}"?`)) return;
        setBusyId(item.id);
        const ok = await vpsApiService.deletePdpSectionHeader(item.id);
        setBusyId(null);
        if (!ok) {
            toast.error('Não foi possível remover');
            return;
        }
        toast.success('Cabeçalho removido');
        setItems(items.filter(i => i.id !== item.id));
    };

    const handleMove = async (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const a = items[index];
        const b = items[target];
        setBusyId(a.id);
        // Troca sort_order entre os dois vizinhos.
        const r1 = await vpsApiService.updatePdpSectionHeader(a.id, { sort_order: b.sort_order });
        const r2 = await vpsApiService.updatePdpSectionHeader(b.id, { sort_order: a.sort_order });
        setBusyId(null);
        if ('error' in r1 || 'error' in r2) {
            toast.error('Falha ao reordenar');
            return;
        }
        await load();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Cabeçalhos da Descrição</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
                Quando uma dessas frases aparecer na descrição do produto, ela vira um título
                em negrito com uma linha em branco antes — útil para organizar descrições
                vindas do Bling como bloco único.
            </p>

            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                    placeholder='Ex: "Garantia", "Especificações Técnicas"'
                    maxLength={255}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    onClick={handleAdd}
                    disabled={saving || !newPhrase.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Adicionar
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 py-6">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Carregando...
                </div>
            ) : items.length === 0 ? (
                <div className="text-center text-gray-500 py-6 border border-dashed rounded-lg">
                    Nenhum cabeçalho cadastrado.
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {items.map((item, idx) => (
                        <li key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                            <span className="font-medium text-gray-800">{item.phrase}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleMove(idx, -1)}
                                    disabled={idx === 0 || busyId === item.id}
                                    title="Mover para cima"
                                    className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleMove(idx, 1)}
                                    disabled={idx === items.length - 1 || busyId === item.id}
                                    title="Mover para baixo"
                                    className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleRemove(item)}
                                    disabled={busyId === item.id}
                                    title="Remover"
                                    className="p-2 text-red-500 hover:text-red-700 disabled:opacity-30"
                                >
                                    {busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
