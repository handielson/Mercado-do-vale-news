/**
 * Company context — fonte única de companyId.
 *
 * Otimização de LCP/Lighthouse:
 * - Se a env `VITE_COMPANY_ID` estiver definida, retorna imediatamente sem nenhuma query.
 * - Caso contrário, faz UMA chamada a Supabase (lookup por slug) e cacheia globalmente.
 *
 * Antes desta consolidação, cada service mantinha seu próprio `getCompanyId()` e o
 * Lighthouse mostrava o mesmo lookup `companies?slug=eq.mercado-do-vale` repetido 3x na home.
 */
import { supabase } from './supabase';

const TEMP_COMPANY_SLUG = 'mercado-do-vale';

// Lê do .env (Vite injeta em tempo de build). Se ausente, fica null e cai no fallback.
const ENV_COMPANY_ID: string | null =
    (typeof import.meta !== 'undefined' &&
        (import.meta as any).env?.VITE_COMPANY_ID) || null;

let _cachedCompanyId: string | null = ENV_COMPANY_ID;
let _inFlight: Promise<string> | null = null;

/**
 * Retorna o companyId. Cache global (módulo) + deduplicação de requisições concorrentes.
 *
 * @throws Error se nem a env estiver definida nem a query Supabase resolver.
 */
export async function getCompanyId(): Promise<string> {
    if (_cachedCompanyId) return _cachedCompanyId;
    if (_inFlight) return _inFlight;

    _inFlight = (async () => {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id')
                .eq('slug', TEMP_COMPANY_SLUG)
                .single();

            if (error) throw new Error(`Failed to get company: ${error.message}`);
            _cachedCompanyId = data.id;
            return data.id;
        } finally {
            _inFlight = null;
        }
    })();

    return _inFlight;
}

/** Permite invalidar o cache em caso de troca de tenant futura. */
export function resetCompanyIdCache(): void {
    _cachedCompanyId = ENV_COMPANY_ID;
    _inFlight = null;
}
