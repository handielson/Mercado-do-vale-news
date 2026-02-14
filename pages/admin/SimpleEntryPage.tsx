import React, { useState } from 'react';

/**
 * ULTRA-SIMPLE Product Entry
 * Just select a model and see ALL its fields
 */
export const SimpleEntryPage: React.FC = () => {
    const [selectedModel, setSelectedModel] = useState<any>(null);

    const handleModelChange = async (modelName: string) => {
        if (!modelName) {
            setSelectedModel(null);
            return;
        }

        // Fetch model data
        const response = await fetch(`/api/models?name=${modelName}`);
        const models = await response.json();
        const model = models.find((m: any) => m.name === modelName);

        console.log('Model loaded:', model);
        setSelectedModel(model);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Entrada Simples</h1>

            {/* Step 1: Select Model */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <label className="block text-sm font-medium mb-2">
                    Selecione o Modelo:
                </label>
                <select
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="">-- Selecione --</option>
                    <option value="Poco C85">Poco C85</option>
                    <option value="Redmi Note 13">Redmi Note 13</option>
                </select>
            </div>

            {/* Step 2: Show Model Data */}
            {selectedModel && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="font-bold text-lg mb-4">Dados do Modelo:</h2>

                    <div className="space-y-2">
                        <p><strong>Nome:</strong> {selectedModel.name}</p>
                        <p><strong>Marca ID:</strong> {selectedModel.brand_id}</p>
                        <p><strong>Categoria ID:</strong> {selectedModel.category_id}</p>

                        <div className="mt-4">
                            <strong>Template Values (TODOS OS CAMPOS):</strong>
                            <pre className="mt-2 p-4 bg-gray-100 rounded text-sm overflow-auto">
                                {JSON.stringify(selectedModel.template_values, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
