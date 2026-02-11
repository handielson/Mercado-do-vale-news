import React, { useState, useEffect } from 'react';
import { modelsService } from '../../../services/models';
import type { Model } from '../../../types/model';

export default function ModelsDebugPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            setLoading(true);
            const data = await modelsService.list();
            console.log('📊 [ModelsDebug] Loaded models:', data);
            setModels(data);
        } catch (err) {
            console.error('Error loading models:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold mb-4">Carregando modelos...</h1>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">🔍 Debug: Todos os Modelos</h1>
            <p className="text-sm text-gray-600 mb-4">
                Total de modelos: {models.length}
            </p>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border px-4 py-2 text-left">Nome</th>
                            <th className="border px-4 py-2 text-left">Processador</th>
                            <th className="border px-4 py-2 text-left">Chipset</th>
                            <th className="border px-4 py-2 text-left">Bateria (mAh)</th>
                            <th className="border px-4 py-2 text-left">Display (pol)</th>
                            <th className="border px-4 py-2 text-left">Câm. Principal</th>
                            <th className="border px-4 py-2 text-left">Câm. Frontal</th>
                            <th className="border px-4 py-2 text-left">NFC</th>
                            <th className="border px-4 py-2 text-left">Rede</th>
                            <th className="border px-4 py-2 text-left">Resistência</th>
                            <th className="border px-4 py-2 text-left">AnTuTu</th>
                            <th className="border px-4 py-2 text-left">Peso (kg)</th>
                            <th className="border px-4 py-2 text-left">Largura (cm)</th>
                            <th className="border px-4 py-2 text-left">Altura (cm)</th>
                            <th className="border px-4 py-2 text-left">Prof. (cm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map((model) => (
                            <tr key={model.id} className="hover:bg-gray-50">
                                <td className="border px-4 py-2 font-semibold">{model.name}</td>
                                <td className="border px-4 py-2">
                                    {model.processor || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.chipset || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.battery_mah || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.display || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.main_camera_mpx || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.selfie_camera_mpx || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.nfc || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.network || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.resistencia || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.antutu || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.weight_kg || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.width_cm || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.height_cm || <span className="text-red-500">NULL</span>}
                                </td>
                                <td className="border px-4 py-2">
                                    {model.depth_cm || <span className="text-red-500">NULL</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">📋 Dados Completos (JSON)</h2>
                <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
                    {JSON.stringify(models, null, 2)}
                </pre>
            </div>
        </div>
    );
}
