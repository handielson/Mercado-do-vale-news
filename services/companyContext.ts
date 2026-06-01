import { publicCompanySettingsService } from './publicCompanySettings';

export const DEFAULT_COMPANY_ID = '9717131e-7b14-4aec-84a4-4317c0489985';

let cachedCompanyId: string | null = null;
let inFlight: Promise<string> | null = null;

function useDefaultCompanyId(reason: unknown): string {
    console.warn('[companyContext] Using default VPS company id:', reason);
    cachedCompanyId = DEFAULT_COMPANY_ID;
    return DEFAULT_COMPANY_ID;
}

export async function getCompanyId(): Promise<string> {
    if (cachedCompanyId) return cachedCompanyId;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const settings = await publicCompanySettingsService.get();
            if (settings?.id) {
                const publicSettingsId = String(settings.id);
                if (publicSettingsId !== DEFAULT_COMPANY_ID) {
                    return useDefaultCompanyId(`public settings id ${publicSettingsId} is not the VPS data company_id`);
                }
                cachedCompanyId = publicSettingsId;
                return publicSettingsId;
            }
            return useDefaultCompanyId('public company id not found');
        } catch (error) {
            return useDefaultCompanyId(error);
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}
