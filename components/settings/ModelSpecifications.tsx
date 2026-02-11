import React from 'react';

interface SpecsData {
    processor: string;
    chipset: string;
    batteryMah: string;
    display: string;
    mainCameraMpx: string;
    selfieCameraMpx: string;
    nfc: string;
    network: string;
    resistencia: string;
    antutu: string;
}

interface ModelSpecificationsProps {
    specs: SpecsData;
    onChange: (field: keyof SpecsData, value: string) => void;
}

export const ModelSpecifications: React.FC<ModelSpecificationsProps> = ({
    specs,
    onChange
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                📱 Especificações Técnicas
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Processador</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.processor}
                        onChange={(e) => onChange('processor', e.target.value)}
                        placeholder="Ex: Helio G200 Ultra"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Chipset</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.chipset}
                        onChange={(e) => onChange('chipset', e.target.value)}
                        placeholder="Ex: MediaTek"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bateria (mAh)</label>
                    <input
                        type="number"
                        min="100"
                        max="99999"
                        value={specs.batteryMah}
                        onChange={(e) => onChange('batteryMah', e.target.value)}
                        placeholder="Ex: 5600"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Display (pol)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="99.9"
                        value={specs.display}
                        onChange={(e) => onChange('display', e.target.value)}
                        placeholder="Ex: 6.77"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Câmera Principal</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.mainCameraMpx}
                        onChange={(e) => onChange('mainCameraMpx', e.target.value)}
                        placeholder="Ex: 200MP"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Câmera Frontal</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.selfieCameraMpx}
                        onChange={(e) => onChange('selfieCameraMpx', e.target.value)}
                        placeholder="Ex: 32MP"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">NFC</label>
                    <select
                        value={specs.nfc}
                        onChange={(e) => onChange('nfc', e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecione</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Rede</label>
                    <select
                        value={specs.network}
                        onChange={(e) => onChange('network', e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecione</option>
                        <option value="4G">4G</option>
                        <option value="5G">5G</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Resistência</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.resistencia}
                        onChange={(e) => onChange('resistencia', e.target.value)}
                        placeholder="Ex: IP68"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Antutu</label>
                    <input
                        type="text"
                        maxLength={50}
                        value={specs.antutu}
                        onChange={(e) => onChange('antutu', e.target.value)}
                        placeholder="Ex: 1200000"
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );
};
