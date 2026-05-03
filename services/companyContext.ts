import { supabase } from './supabase';

/**
 * Singleton com cache + dedup do company_id resolvido por slug.
 *
 * Antes: cada service tinha seu próprio getCompanyId() — 11 cópias da mesma
 * query `from('companies').select('id').eq('slug', 'mercado-do-vale')` com
 * cache local separado. Resultado: 3-5 queries duplicadas /companies em
 * paralelo a cada page load (visível no PageSpeed Insights).
 *
 * Agora: 1 só query por sessão (resolve uma vez, mantém em memória).
 * Promise in-flight evita race condition quando múltiplos services chamam
 * antes do cache popular.
 */

const COMPANY_SLUG = 'mercado-do-vale';

let cachedCompanyId: string | null = null;
let inFlight: Promise<string> | null = null;

export async function getCompanyId(): Promise<string> {
    if (cachedCompanyId) return cachedCompanyId;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id')
                .eq('slug', COMPANY_SLUG)
                .single();
            if (error) throw new Error(`Failed to get company: ${error.message}`);
            cachedCompanyId = data.id;
            return data.id;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}
