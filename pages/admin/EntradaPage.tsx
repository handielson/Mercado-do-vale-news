import React, { useState } from 'react';
import { modelService } from '../../services/models';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';

/**
 * EntradaPage - SIMPLE TEST VERSION
 * Just select a model and see ALL its fields
 */
export const EntradaPage: React.FC = () => {
    const [selectedModelName, setSelectedModelName] = useState<string>('');
    const [modelData, setModelData] = useState<any>(null);
    const [brandData, setBrandData] = useState<any>(null);
    const [categoryData, setCategoryData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [eanValue, setEanValue] = useState('');

    const loadModelData = async (model: any) => {
        setModelData(model);
        setSelectedModelName(model.name);

        // Load brand
        if (model.brand_id) {
            const brand = await brandService.getById(model.brand_id);
            setBrandData(brand);
        }

        // Load category
        if (model.category_id) {
            const category = await categoryService.getById(model.category_id);
            setCategoryData(category);
        }
    };

    const handleEANSearch = async (ean: string) => {
        if (!ean || ean.length < 8) {
            return;
        }

        setLoading(true);
        try {
            // Search for model by EAN
            const models = await modelService.listActive();

            // Find model that has this EAN in its eans array
            const model = models.find((m: any) => {
                if (m.eans && Array.isArray(m.eans)) {
                    return m.eans.includes(ean);
                }
                return false;
            });

            if (model) {
                await loadModelData(model);
            } else {
                alert('Modelo não encontrado para este EAN');
            }
        } catch (error) {
            console.error('Error searching EAN:', error);
            alert('Erro ao buscar EAN');
        } finally {
            setLoading(false);
        }
    };

    const handleModelChange = async (modelName: string) => {
        if (!modelName) {
            setSelectedModelName('');
            setModelData(null);
            setBrandData(null);
            setCategoryData(null);
            return;
        }

        setSelectedModelName(modelName);
        setLoading(true);

        try {
            // Load model
            const models = await modelService.listActive();
            const model = models.find((m: any) => m.name === modelName);

            if (model) {
                setModelData(model);

                // Load brand
                if (model.brand_id) {
                    const brand = await brandService.getById(model.brand_id);
                    setBrandData(brand);
                }

                // Load category
                if (model.category_id) {
                    const category = await categoryService.getById(model.category_id);
                    setCategoryData(category);
                }
            }
        } catch (error) {
            console.error('Error loading model:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Entrada - Teste Simples</h1>

                {/* Step 1: Select Model */}
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* EAN Field */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                EAN/GTIN:
                            </label>
                            <input
                                type="text"
                                placeholder="7891234567890"
                                value={eanValue}
                                onChange={(e) => setEanValue(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleEANSearch(eanValue);
                                    }
                                }}
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500 mt-1">Pressione Enter para buscar</p>
                        </div>

                        {/* Model Field */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Modelo:
                            </label>
                            <select
                                value={selectedModelName}
                                onChange={(e) => handleModelChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={loading}
                            >
                                <option value="">-- Selecione --</option>
                                <option value="Poco C85">Poco C85</option>
                                <option value="Redmi Note 13">Redmi Note 13</option>
                                <option value="Galaxy A55">Galaxy A55</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Step 2: Show Model Data */}
                {loading && (
                    <div className="bg-white p-6 rounded-lg shadow text-center">
                        Carregando...
                    </div>
                )}

                {!loading && modelData && (
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="font-bold text-lg mb-4">Informações Básicas:</h2>
                            <div className="space-y-2">
                                <p><strong>Nome:</strong> {modelData.name}</p>
                                {brandData && <p><strong>Marca:</strong> {brandData.name}</p>}
                                {categoryData && <p><strong>Categoria:</strong> {categoryData.name}</p>}
                            </div>
                        </div>

                        {/* Template Values */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="font-bold text-lg mb-4">Template Values (Todos os Campos):</h2>
                            {modelData.template_values ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(modelData.template_values).map(([key, value]) => (
                                        <div key={key} className="border-b pb-2">
                                            <span className="text-slate-600 text-sm">{key}:</span>
                                            <p className="font-medium">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500">Nenhum template_values encontrado</p>
                            )}
                        </div>

                        {/* Raw JSON */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="font-bold text-lg mb-4">JSON Completo:</h2>
                            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">
                                {JSON.stringify(modelData, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
