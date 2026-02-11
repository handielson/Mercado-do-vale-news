import React from 'react';

interface LogisticsData {
    weight_kg: string;
    width_cm: string;
    height_cm: string;
    depth_cm: string;
}

interface ModelLogisticsProps {
    logistics: LogisticsData;
    onChange: (field: keyof LogisticsData, value: string) => void;
}

export const ModelLogistics: React.FC<ModelLogisticsProps> = ({
    logistics,
    onChange
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                📦 Informações de Logística
            </h3>

            <div className="grid grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Peso (kg)
                    </label>
                    <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max="99.999"
                        value={logistics.weight_kg}
                        onChange={(e) => onChange('weight_kg', e.target.value)}
                        placeholder="0.250"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Largura (cm)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="999.9"
                        value={logistics.width_cm}
                        onChange={(e) => onChange('width_cm', e.target.value)}
                        placeholder="15.5"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Altura (cm)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="999.9"
                        value={logistics.height_cm}
                        onChange={(e) => onChange('height_cm', e.target.value)}
                        placeholder="7.8"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Profundidade (cm)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="999.9"
                        value={logistics.depth_cm}
                        onChange={(e) => onChange('depth_cm', e.target.value)}
                        placeholder="0.9"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <p className="text-xs text-slate-500">
                💡 Informações usadas para cálculo de frete e embalagem
            </p>
        </div>
    );
};
