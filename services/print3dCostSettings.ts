import { vpsClient } from './vpsClient';

const PREFERENCE_KEY = 'print3d.cost.v1';

export type Print3dFilament = {
  id: string;
  name: string;
  color: string;
  spoolGrams: number;
  spoolCostCents: number;
};

export type Print3dSupply = {
  id: string;
  name: string;
  unitLabel?: string;
  unitCostCents: number;
};

export type Print3dCostSettings = {
  printerWatts: number;
  energyCentsPerKwh: number;
  machineCentsPerHour: number;
  laborCentsPerHour: number;
  packagingCentsPerPiece: number;
  taxPercent: number;
  filaments: Print3dFilament[];
  supplies: Print3dSupply[];
};

type PreferenceResponse = { value: Print3dCostSettings | null };

export const emptyPrint3dCostSettings = (): Print3dCostSettings => ({
  printerWatts: 0,
  energyCentsPerKwh: 0,
  machineCentsPerHour: 100,
  laborCentsPerHour: 2000,
  packagingCentsPerPiece: 0,
  taxPercent: 0,
  filaments: [],
  supplies: [],
});

export const print3dCostSettingsService = {
  async get(): Promise<Print3dCostSettings> {
    const response = await vpsClient.get<PreferenceResponse>(`/admin/preferences/${PREFERENCE_KEY}`);
    const saved = response.value;
    return { ...emptyPrint3dCostSettings(), ...saved,
      machineCentsPerHour: saved?.machineCentsPerHour ?? 100,
      laborCentsPerHour: saved?.laborCentsPerHour ?? 2000,
    };
  },
  async save(settings: Print3dCostSettings): Promise<void> {
    await vpsClient.patch(`/admin/preferences/${PREFERENCE_KEY}`, { value: settings });
  },
};
