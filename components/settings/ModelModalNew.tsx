import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Model, ModelInput, ModelEAN } from '../../types/model-architecture';
import { modelsService } from '../../services/models-new';
import { modelEANsService } from '../../services/model-eans';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';
import { ModelBasicInfo } from './ModelBasicInfo';
import { ModelSpecifications } from './ModelSpecifications';
import { ModelEANManager } from './ModelEANManager';
import { ModelLogistics } from './ModelLogistics';
import { ModelCustomFields } from './ModelCustomFields';

interface ModelModalNewProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    model?: Model | null;
}

export const ModelModalNew: React.FC<ModelModalNewProps> = ({ isOpen, onClose, onSave, model }) => {
    // Basic info
    const [name, setName] = useState('');
    const [brandId, setBrandId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');

    // Specifications
    const [specs, setSpecs] = useState({
        processor: '',
        chipset: '',
        batteryMah: '',
        display: '',
        mainCameraMpx: '',
        selfieCameraMpx: '',
        nfc: '',
        network: '',
        resistencia: '',
        antutu: ''
    });

    // Logistics
    const [logistics, setLogistics] = useState({
        weight_kg: '',
        width_cm: '',
        height_cm: '',
        depth_cm: ''
    });

    // Custom Fields (dinâmicos)
    const [customValues, setCustomValues] = useState<Record<string, any>>({});

    // EANs
    const [eans, setEans] = useState<ModelEAN[]>([]);

    // UI States
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (model) {
            setName(model.name);
            setBrandId(model.brand_id);
            setCategoryId(model.category_id);
            setDescription(model.description || '');
            setSpecs({
                processor: model.processor || '',
                chipset: model.chipset || '',
                batteryMah: model.battery_mah?.toString() || '',
                display: model.display?.toString() || '',
                mainCameraMpx: model.main_camera_mpx || '',
                selfieCameraMpx: model.selfie_camera_mpx || '',
                nfc: model.nfc || '',
                network: model.network || '',
                resistencia: model.resistencia || '',
                antutu: model.antutu || ''
            });

            setLogistics({
                weight_kg: model.weight_kg?.toString() || '',
                width_cm: model.width_cm?.toString() || '',
                height_cm: model.height_cm?.toString() || '',
                depth_cm: model.depth_cm?.toString() || ''
            });

            setCustomValues(model.custom_specs || {});

            if (model.id) {
                loadEANs(model.id);
            }
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

    const loadEANs = async (modelId: string) => {
        try {
            const eansData = await modelEANsService.getByModelId(modelId);
            setEans(eansData);
        } catch (err) {
            console.error('Error loading EANs:', err);
        }
    };

    const resetForm = () => {
        setName('');
        setBrandId('');
        setCategoryId('');
        setDescription('');
        setSpecs({
            processor: '',
            chipset: '',
            batteryMah: '',
            display: '',
            mainCameraMpx: '',
            selfieCameraMpx: '',
            nfc: '',
            network: '',
            resistencia: '',
            antutu: ''
        });
        setLogistics({
            weight_kg: '',
            width_cm: '',
            height_cm: '',
            depth_cm: ''
        });
        setCustomValues({});
        setEans([]);
        setError('');
    };

    const handleSpecChange = (field: keyof typeof specs, value: string) => {
        setSpecs(prev => ({ ...prev, [field]: value }));
    };

    const handleLogisticsChange = (field: keyof typeof logistics, value: string) => {
        setLogistics(prev => ({ ...prev, [field]: value }));
    };

    const handleCustomFieldChange = (key: string, value: any) => {
        setCustomValues(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Nome do modelo é obrigatório');
            return;
        }

        if (!brandId) {
            setError('Marca é obrigatória');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const input: ModelInput = {
                brand_id: brandId,
                category_id: categoryId,
                name: name.trim(),
                description: description.trim() || undefined,
                processor: specs.processor || undefined,
                chipset: specs.chipset || undefined,
                battery_mah: specs.batteryMah ? parseInt(specs.batteryMah) : undefined,
                display: specs.display ? parseFloat(specs.display) : undefined,
                main_camera_mpx: specs.mainCameraMpx || undefined,
                selfie_camera_mpx: specs.selfieCameraMpx || undefined,
                nfc: specs.nfc || undefined,
                network: specs.network || undefined,
                resistencia: specs.resistencia || undefined,
                antutu: specs.antutu || undefined,
                weight_kg: logistics.weight_kg ? parseFloat(logistics.weight_kg) : undefined,
                width_cm: logistics.width_cm ? parseFloat(logistics.width_cm) : undefined,
                height_cm: logistics.height_cm ? parseFloat(logistics.height_cm) : undefined,
                depth_cm: logistics.depth_cm ? parseFloat(logistics.depth_cm) : undefined,
                custom_specs: Object.keys(customValues).length > 0 ? customValues : undefined
            };

            console.log('🔍 [ModelModalNew] Saving model with input:', input);
            console.log('📋 [ModelModalNew] Specs state:', specs);
            console.log('📦 [ModelModalNew] Logistics state:', logistics);

            let savedModel: Model;
            if (model) {
                savedModel = await modelsService.update(model.id, input);
            } else {
                savedModel = await modelsService.create(input);

                // Salvar EANs temporários
                for (const ean of eans.filter(e => e.id.startsWith('temp-'))) {
                    await modelEANsService.add({
                        model_id: savedModel.id,
                        ean: ean.ean,
                        country_code: ean.country_code,
                        is_primary: ean.is_primary
                    });
                }
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar modelo');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

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
                    <ModelBasicInfo
                        name={name}
                        brandId={brandId}
                        categoryId={categoryId}
                        description={description}
                        brands={brands}
                        categories={categories}
                        loading={loading}
                        onNameChange={setName}
                        onBrandChange={setBrandId}
                        onCategoryChange={setCategoryId}
                        onDescriptionChange={setDescription}
                    />

                    <ModelSpecifications
                        specs={specs}
                        onChange={handleSpecChange}
                    />

                    <ModelLogistics
                        logistics={logistics}
                        onChange={handleLogisticsChange}
                    />

                    <ModelCustomFields
                        categoryId={categoryId}
                        values={customValues}
                        onChange={handleCustomFieldChange}
                    />

                    <ModelEANManager
                        eans={eans}
                        modelId={model?.id}
                        onEANsChange={setEans}
                        onError={setError}
                    />

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
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
