import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';

interface ModelModalExcelProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    model?: any | null;
}

export const ModelModalExcel: React.FC<ModelModalExcelProps> = ({
    isOpen,
    onClose,
    onSave,
    model
}) => {
    const [formData, setFormData] = useState<any>({
        name: '',
        brand_id: '',
        category_id: '',
        description: '',
        template_values: {}
    });

    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
            if (model) {
                setFormData({
                    name: model.name || '',
                    brand_id: model.brand_id || '',
                    category_id: model.category_id || '',
                    description: model.description || '',
                    template_values: model.template_values || {}
                });
            }
        }
    }, [isOpen, model]);

    const loadData = async () => {
        const [brandsData, categoriesData] = await Promise.all([
            brandService.listActive(),
            categoryService.list()
        ]);
        setBrands(brandsData);
        setCategories(categoriesData);
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const updateTemplateValue = (key: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            template_values: { ...prev.template_values, [key]: value }
        }));
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.brand_id) {
            alert('Nome e Marca são obrigatórios');
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (err) {
            alert('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const specs = [
        { key: 'processor', label: 'Processador' },
        { key: 'chipset', label: 'Chipset' },
        { key: 'battery_mah', label: 'Bateria (mAh)' },
        { key: 'display', label: 'Display (pol)' },
        { key: 'main_camera_mpx', label: 'Câmera Principal' },
        { key: 'selfie_camera_mpx', label: 'Câmera Frontal' },
        { key: 'nfc', label: 'NFC' },
        { key: 'network', label: 'Rede' },
        { key: 'resistencia', label: 'Resistência' },
        { key: 'antutu', label: 'Antutu' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                    <h2 className="text-lg font-bold">
                        {model ? 'Editar Modelo' : 'Novo Modelo'}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save size={16} />
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-100 sticky top-0">
                            <tr>
                                <th className="border p-2 text-left font-semibold w-48">Campo</th>
                                <th className="border p-2 text-left font-semibold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Informações Básicas */}
                            <tr className="bg-blue-50">
                                <td colSpan={2} className="border p-2 font-bold text-blue-900">
                                    📋 INFORMAÇÕES BÁSICAS
                                </td>
                            </tr>
                            <tr>
                                <td className="border p-2 font-medium">Nome do Modelo *</td>
                                <td className="border p-2">
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full px-2 py-1 border rounded"
                                        placeholder="Ex: Poco C85"
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className="border p-2 font-medium">Marca *</td>
                                <td className="border p-2">
                                    <select
                                        value={formData.brand_id}
                                        onChange={(e) => updateField('brand_id', e.target.value)}
                                        className="w-full px-2 py-1 border rounded"
                                    >
                                        <option value="">Selecione...</option>
                                        {brands.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <td className="border p-2 font-medium">Categoria</td>
                                <td className="border p-2">
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => updateField('category_id', e.target.value)}
                                        className="w-full px-2 py-1 border rounded"
                                    >
                                        <option value="">Selecione...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <td className="border p-2 font-medium">Descrição</td>
                                <td className="border p-2">
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => updateField('description', e.target.value)}
                                        className="w-full px-2 py-1 border rounded"
                                        rows={2}
                                    />
                                </td>
                            </tr>

                            {/* Especificações Técnicas */}
                            <tr className="bg-green-50">
                                <td colSpan={2} className="border p-2 font-bold text-green-900">
                                    ⚙️ ESPECIFICAÇÕES TÉCNICAS
                                </td>
                            </tr>
                            {specs.map(spec => (
                                <tr key={spec.key}>
                                    <td className="border p-2 font-medium">{spec.label}</td>
                                    <td className="border p-2">
                                        <input
                                            type="text"
                                            value={formData.template_values[spec.key] || ''}
                                            onChange={(e) => updateTemplateValue(spec.key, e.target.value)}
                                            className="w-full px-2 py-1 border rounded"
                                            placeholder={`Digite ${spec.label.toLowerCase()}...`}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
