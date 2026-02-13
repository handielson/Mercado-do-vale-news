import React, { useState, useEffect } from 'react';
import { UseFormWatch, UseFormSetValue, Control, FieldErrors, Controller } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { Color } from '../../../types/color';
import { Ram } from '../../../types/ram';
import { Storage } from '../../../types/storage';
import { Version } from '../../../types/version';
import { EANInput } from '../../ui/EANInput';
import { ModelSelect } from '../selectors/ModelSelect';
import { CategorySelect } from '../selectors/CategorySelect';
import { BatchEntryGrid } from '../entry/components/BatchEntryGrid';
import { BatchProductRow } from '../entry/ProductEntryWizard';
import { Package, Search } from 'lucide-react';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { colorService } from '../../../services/colors';
import { storageService } from '../../../services/storages-supabase';
import { ramService } from '../../../services/rams-supabase';
import { versionService } from '../../../services/versions-supabase';
import { UNIQUE_FIELDS } from '../../../config/product-fields';

interface ProductBasicInfoProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    control: Control<ProductInput>;
    errors: FieldErrors<ProductInput>;
}

export function ProductBasicInfo({
    watch,
    setValue,
    control,
    errors
}: ProductBasicInfoProps) {
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(false);

    // Reference data for lookups (Supabase)
    const [versions, setVersions] = useState<Version[]>([]);
    const [colors, setColors] = useState<Color[]>([]);
    const [storages, setStorages] = useState<Storage[]>([]);
    const [rams, setRams] = useState<Ram[]>([]);

    // Batch products for grid
    const [batchProducts, setBatchProducts] = useState<BatchProductRow[]>([
        { id: crypto.randomUUID(), isValid: false, errors: {} }
    ]);

    const selectedModelName = watch('model');

    // Load reference data on mount
    useEffect(() => {
        loadReferenceData();
    }, []);

    // Load model data when model is selected
    useEffect(() => {
        if (selectedModelName) {
            loadModelData(selectedModelName);
        } else {
            setSelectedModel(null);
            setSelectedBrand(null);
        }
    }, [selectedModelName]);

    const loadReferenceData = async () => {
        try {
            const [versionsData, colorsData, storagesData, ramsData] = await Promise.all([
                versionService.list(),
                colorService.list(),
                storageService.list(),
                ramService.list()
            ]);
            setVersions(versionsData);
            setColors(colorsData);
            setStorages(storagesData);
            setRams(ramsData);
        } catch (error) {
            console.error('Error loading reference data:', error);
        }
    };

    const loadModelData = async (modelName: string) => {
        try {
            setIsLoadingModel(true);
            const models = await modelService.listActive();
            const model = models.find(m => m.name === modelName);
            if (model) {
                setSelectedModel(model);
                // Auto-fill brand from model
                if (model.brand_id) {
                    setValue('brand_id', model.brand_id);
                    // Load brand name
                    const brands = await brandService.listActive();
                    const brand = brands.find(b => b.id === model.brand_id);
                    if (brand) {
                        setSelectedBrand(brand);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading model:', error);
        } finally {
            setIsLoadingModel(false);
        }
    };


    // Map technical field names to readable Portuguese labels
    const getFieldLabel = (key: string): string => {
        const fieldLabels: Record<string, string> = {
            // Dimensions
            'dimensions.height_cm': 'Altura',
            'dimensions.width_cm': 'Largura',
            'dimensions.depth_cm': 'Profundidade',
            'dimensions.weight_kg': 'Peso',
            'weight_kg': 'Peso',

            // Camera
            'cam_principal_mp': 'Câmera Principal',
            'cam_principal_mpx': 'Câmera Principal',
            'cam_selfie_mp': 'Câmera Frontal',
            'cam_selfie_mpx': 'Câmera Frontal',

            // Battery
            'battery_mah': 'Bateria',
            'carregamento': 'Carregamento',

            // Display
            'display': 'Tela',

            // Processor
            'processador': 'Processador',
            'chipset': 'Chipset',

            // Network
            'rede_operadora': 'Rede',

            // Other
            'resistencia': 'Resistência',
            'nfc': 'NFC',
            'versao': 'Versão',
            'antifurt': 'Antifurto'
        };

        return fieldLabels[key] || key;
    };

    const formatTemplateValue = (key: string, value: any): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
        if (typeof value === 'number') return value.toString();

        // Check if this is an ID field and try to find the name
        const stringValue = String(value);

        // Check if it looks like a UUID (has dashes and is long)
        const isUUID = stringValue.includes('-') && stringValue.length > 30;

        // Version lookup
        if (key.toLowerCase().includes('versao') || key.toLowerCase().includes('version')) {
            const version = versions.find(v => v.id === stringValue || v.name === stringValue);
            if (version) return version.name;
            // If not found and looks like UUID, show truncated ID
            if (isUUID) return `${stringValue.substring(0, 8)}...`;
        }

        // Color lookup
        if (key.toLowerCase().includes('cor') || key.toLowerCase().includes('color')) {
            const color = colors.find(c => c.id === stringValue || c.name === stringValue);
            if (color) return color.name;
            if (isUUID) return `${stringValue.substring(0, 8)}...`;
        }

        // Storage lookup
        if (key.toLowerCase().includes('armazenamento') || key.toLowerCase().includes('storage')) {
            const storage = storages.find(s => s.id === stringValue || s.capacity === stringValue);
            if (storage) return storage.capacity;
            if (isUUID) return `${stringValue.substring(0, 8)}...`;
        }

        // RAM lookup
        if (key.toLowerCase().includes('ram') || key.toLowerCase().includes('memoria')) {
            const ram = rams.find(r => r.id === stringValue || r.capacity === stringValue);
            if (ram) return ram.capacity;
            if (isUUID) return `${stringValue.substring(0, 8)}...`;
        }

        return stringValue;
    };

    const templateData = selectedModel?.template_values || {};

    return (
        <>
            {/* Scanner EAN & Model Selector - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scanner EAN */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Scanner EAN/TR
                        <span className="ml-2 text-xs text-slate-400 font-mono">models.eans[]</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Escaneie ou digite o código de barras"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                            type="button"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                        >
                            Buscar
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Pressione Enter ao escanear o código
                    </p>
                </div>

                {/* Model Selector */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Modelo
                        <span className="ml-2 text-xs text-slate-400 font-mono">model_id</span>
                    </label>
                    <ModelSelect
                        value={selectedModelName || ''}
                        onChange={(val) => setValue('model', val)}
                        error={errors.model?.message}
                    />
                </div>
            </div>

            {/* Product Condition & Type Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Condition Selector */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Condição do Produto *
                        <span className="ml-2 text-xs text-slate-400 font-mono">condition</span>
                    </label>
                    <Controller
                        name="condition"
                        control={control}
                        render={({ field }) => (
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        {...field}
                                        value="new"
                                        checked={field.value === 'new'}
                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        🆕 Novo
                                        <span className="ml-2 text-xs text-slate-500">(usa fotos do modelo)</span>
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        {...field}
                                        value="used"
                                        checked={field.value === 'used'}
                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        📦 Usado
                                        <span className="ml-2 text-xs text-slate-500">(permite upload de fotos)</span>
                                    </span>
                                </label>
                            </div>
                        )}
                    />
                    {errors.condition && (
                        <p className="text-xs text-red-600 mt-1">{errors.condition.message}</p>
                    )}
                </div>

                {/* Type Selector */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tipo *
                        <span className="ml-2 text-xs text-slate-400 font-mono">type</span>
                    </label>
                    <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        {...field}
                                        value="sale"
                                        checked={field.value === 'sale'}
                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        💰 Venda
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        {...field}
                                        value="gift"
                                        checked={field.value === 'gift'}
                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        🎁 Brinde
                                    </span>
                                </label>
                            </div>
                        )}
                    />
                    {errors.type && (
                        <p className="text-xs text-red-600 mt-1">{errors.type.message}</p>
                    )}
                </div>
            </div>

            {/* Template Data Display (only when model is selected) */}
            {selectedModel && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
                        <Package size={20} className="text-blue-600" />
                        Dados do Template (somente leitura)
                        <span className="ml-2 text-xs text-slate-400 font-mono font-normal">
                            models.template_values
                        </span>
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {/* Marca (first, with brand name) */}
                        <div>
                            <span className="text-blue-700 font-medium">Marca:</span>
                            <span className="ml-2 text-blue-900">
                                {selectedBrand?.name || 'N/A'}
                            </span>
                        </div>

                        {/* Modelo (second) */}
                        <div>
                            <span className="text-blue-700 font-medium">Modelo:</span>
                            <span className="ml-2 text-blue-900">{selectedModel.name}</span>
                        </div>

                        {/* Template Values (sorted alphabetically) */}
                        {Object.entries(templateData)
                            .sort(([keyA], [keyB]) => getFieldLabel(keyA).localeCompare(getFieldLabel(keyB)))
                            .map(([key, value]) => (
                                <div key={key}>
                                    <span className="text-blue-700 font-medium">{getFieldLabel(key)}:</span>
                                    <span className="ml-2 text-blue-900">
                                        {formatTemplateValue(key, value)}
                                    </span>
                                </div>
                            ))}
                    </div>

                    <p className="text-xs text-blue-600 mt-4">
                        💡 Estes valores serão aplicados automaticamente ao produto
                    </p>
                </div>
            )}

            {/* Batch Product Entry Grid */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-medium text-slate-800 mb-3">
                    Cadastrar Produtos (preencha os campos únicos)
                    <span className="ml-2 text-xs text-slate-400 font-mono">
                        specs.imei1 | specs.imei2 | specs.serial | specs.color | specs.storage | specs.ram
                    </span>
                </h3>
                <BatchEntryGrid
                    rows={batchProducts}
                    onChange={setBatchProducts}
                    uniqueFields={UNIQUE_FIELDS}
                />
            </div>
        </>
    );
}
