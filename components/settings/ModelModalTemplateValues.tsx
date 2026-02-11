import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';

interface ModelModalTemplateValuesProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    model?: any | null;
}

export const ModelModalTemplateValues: React.FC<ModelModalTemplateValuesProps> = ({
    isOpen,
    onClose,
    onSave,
    model
}) => {
    const [name, setName] = useState('');
    const [brandId, setBrandId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [templateValues, setTemplateValues] = useState<Record<string, any>>({});

    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (model) {
            setName(model.name || '');
            setBrandId(model.brand_id || '');
            setCategoryId(model.category_id || '');
            setDescription(model.description || '');
            setTemplateValues(model.template_values || {});
        } else {
            resetForm();
        }
    }, [model, isOpen]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [brandsData, categoriesData] = await Promise.all([
                brandService.listActive(),
                categoryService.list()
            ]);
            setBrands(brandsData);
            setCategories(categoriesData);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setBrandId('');
        setCategoryId('');
        setDescription('');
        setTemplateValues({});
    };

    const handleTemplateValueChange = (key: string, value: any) => {
        setTemplateValues(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!name.trim() || !brandId) {
            alert('Nome e Marca são obrigatórios');
            return;
        }

        setSaving(true);
        try {
            await onSave({
                name: name.trim(),
                brand_id: brandId,
                category_id: categoryId || undefined,
                description: description.trim() || undefined,
                template_values: templateValues
            });
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Erro ao salvar modelo');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // Campos comuns de especificações
    const commonFields = [
        { key: 'processor', label: 'Processador', type: 'text' },
        { key: 'chipset', label: 'Chipset', type: 'text' },
        { key: 'battery_mah', label: 'Bateria (mAh)', type: 'number' },
        { key: 'display', label: 'Display (pol)', type: 'number' },
        { key: 'main_camera_mpx', label: 'Câmera Principal', type: 'text' },
        { key: 'selfie_camera_mpx', label: 'Câmera Frontal', type: 'text' },
        { key: 'nfc', label: 'NFC', type: 'select', options: ['Sim', 'Não'] },
        { key: 'network', label: 'Rede', type: 'select', options: ['4G', '5G'] },
        { key: 'resistencia', label: 'Resistência', type: 'text' },
        { key: 'antutu', label: 'Antutu', type: 'text' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-800">
                        {model ? 'Editar Modelo' : 'Novo Modelo'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Informações Básicas */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-700">Informações Básicas</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Marca *</label>
                                <select
                                    value={brandId}
                                    onChange={(e) => setBrandId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={loading}
                                >
                                    <option value="">Selecione...</option>
                                    {brands.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Nome do Modelo *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Ex: Poco C85"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Categoria</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={loading}
                            >
                                <option value="">Selecione...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Descrição</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={3}
                                placeholder="Descrição do modelo..."
                            />
                        </div>
                    </div>

                    {/* Especificações Técnicas */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-700">Especificações Técnicas</h3>

                        <div className="grid grid-cols-2 gap-4">
                            {commonFields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium mb-1">{field.label}</label>
                                    {field.type === 'select' ? (
                                        <select
                                            value={templateValues[field.key] || ''}
                                            onChange={(e) => handleTemplateValueChange(field.key, e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        >
                                            <option value="">Selecione...</option>
                                            {field.options?.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={templateValues[field.key] || ''}
                                            onChange={(e) => handleTemplateValueChange(field.key, e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder={`Digite ${field.label.toLowerCase()}...`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-slate-50 sticky bottom-0">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
