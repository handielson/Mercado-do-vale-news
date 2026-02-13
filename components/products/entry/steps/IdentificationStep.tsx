/**
 * IDENTIFICATION STEP - Step 1 of 3
 * 
 * Technical: User selects model via EAN scanner or manual selection
 * Database queries: models.eans[], brands table, models table
 */

import React, { useState, useEffect } from 'react';
import { Search, Barcode } from 'lucide-react';
import { Model } from '../../../../types/model';
import { Brand } from '../../../../types/brand';
import { modelService } from '../../../../services/models';
import { brandService } from '../../../../services/brands';
import { toast } from 'sonner';

interface IdentificationStepProps {
    onModelSelected: (model: Model) => void;
    onCancel: () => void;
}

export function IdentificationStep({ onModelSelected, onCancel }: IdentificationStepProps) {
    // Technical: State for EAN scanner input
    const [eanInput, setEanInput] = useState('');
    const [scanning, setScanning] = useState(false);

    // Technical: State for manual selection
    const [brands, setBrands] = useState<Brand[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [loading, setLoading] = useState(true);

    // Technical: Load brands on mount
    useEffect(() => {
        loadBrands();
    }, []);

    // Technical: Load models when brand is selected
    useEffect(() => {
        if (selectedBrandId) {
            loadModels(selectedBrandId);
        } else {
            setModels([]);
            setSelectedModelId('');
        }
    }, [selectedBrandId]);

    const loadBrands = async () => {
        try {
            const data = await brandService.listActive();
            setBrands(data);
        } catch (error) {
            console.error('❌ [IdentificationStep] Error loading brands:', error);
            toast.error('Erro ao carregar marcas');
        } finally {
            setLoading(false);
        }
    };

    const loadModels = async (brandId: string) => {
        try {
            const allModels = await modelService.list();
            const filtered = allModels.filter(m => m.brand_id === brandId && m.active);
            setModels(filtered);
        } catch (error) {
            console.error('❌ [IdentificationStep] Error loading models:', error);
            toast.error('Erro ao carregar modelos');
        }
    };

    // Technical: handleEANScan - Search model by EAN in models.eans[]
    const handleEANScan = async () => {
        if (!eanInput.trim()) {
            toast.error('Digite um código EAN');
            return;
        }

        setScanning(true);
        try {
            console.log('🔍 [IdentificationStep] Searching EAN:', eanInput);

            // TODO: Implement modelService.findByEAN()
            // const model = await modelService.findByEAN(eanInput);

            // Temporary: Search manually
            const allModels = await modelService.list();
            const model = allModels.find(m =>
                m.eans && m.eans.includes(eanInput)
            );

            if (model) {
                console.log('✅ [IdentificationStep] Model found:', model.name);
                toast.success(`Modelo encontrado: ${model.name}`);
                onModelSelected(model);
            } else {
                console.log('⚠️ [IdentificationStep] Model not found for EAN:', eanInput);
                toast.error('Modelo não encontrado para este EAN');
            }
        } catch (error) {
            console.error('❌ [IdentificationStep] Error searching EAN:', error);
            toast.error('Erro ao buscar EAN');
        } finally {
            setScanning(false);
        }
    };

    // Technical: handleManualSelection - User selects brand + model manually
    const handleManualSelection = async () => {
        if (!selectedModelId) {
            toast.error('Selecione um modelo');
            return;
        }

        const model = models.find(m => m.id === selectedModelId);
        if (model) {
            console.log('✅ [IdentificationStep] Manual selection:', model.name);
            onModelSelected(model);
        }
    };

    // Technical: handleEANKeyPress - Allow Enter key to trigger scan
    const handleEANKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEANScan();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-500">Carregando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Search size={28} className="text-blue-500" />
                    Identificar Produto
                    <span className="ml-2 text-xs text-slate-400 font-mono font-normal">models.eans[] | brand_id | model_id</span>
                </h2>
                <p className="text-slate-600 mt-1">
                    Escaneie o código EAN ou selecione a marca e modelo manualmente
                </p>
            </div>

            {/* Technical: EAN Scanner Section */}
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Barcode size={18} className="inline mr-2" />
                    Scanner EAN/GTIN
                    <span className="ml-2 text-xs text-slate-400 font-mono">models.eans[]</span>
                </label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={eanInput}
                        onChange={(e) => setEanInput(e.target.value)}
                        onKeyPress={handleEANKeyPress}
                        placeholder="Escaneie ou digite o código de barras"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        autoFocus
                    />
                    <button
                        onClick={handleEANScan}
                        disabled={scanning}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                    >
                        {scanning ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    💡 Pressione Enter após escanear ou digitar o código
                </p>
            </div>

            {/* Technical: Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500 font-medium">OU</span>
                </div>
            </div>

            {/* Technical: Manual Selection Section */}
            <div className="space-y-4">
                <h3 className="font-medium text-slate-800">Seleção Manual</h3>

                {/* Technical: Brand Select - brands table */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Marca
                        <span className="ml-2 text-xs text-slate-400 font-mono">brand_id</span>
                    </label>
                    <select
                        value={selectedBrandId}
                        onChange={(e) => setSelectedBrandId(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecione uma marca</option>
                        {brands.map(brand => (
                            <option key={brand.id} value={brand.id}>
                                {brand.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Technical: Model Select - models table (filtered by brand_id) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Modelo
                        <span className="ml-2 text-xs text-slate-400 font-mono">model_id</span>
                    </label>
                    <select
                        value={selectedModelId}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        disabled={!selectedBrandId}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                        <option value="">Selecione um modelo</option>
                        {models.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Technical: Template Preview */}
                {selectedModelId && models.find(m => m.id === selectedModelId)?.template_values && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-800 mb-2">
                            📋 Template detectado
                        </p>
                        <p className="text-sm text-blue-700">
                            ✅ {Object.keys(models.find(m => m.id === selectedModelId)!.template_values || {}).length} campos serão preenchidos automaticamente
                        </p>
                    </div>
                )}
            </div>

            {/* Technical: Action Buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleManualSelection}
                    disabled={!selectedModelId}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    Continuar →
                </button>
            </div>
        </div>
    );
}
