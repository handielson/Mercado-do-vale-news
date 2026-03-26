import { getValidToken } from './blingService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlingNfItem {
    id: number;
    numero: string;
    serie: string;
    tipo: 'nfe' | 'nfce';
    dataEmissao: string;           // ISO date: "2025-01-15"
    totalProdutos: number;         // base tributária (sem frete)
    totalNota: number;             // valor total da nota
    situacao: number;              // 2 = Emitida
    contato?: { nome?: string };
}

interface NfCacheStore {
    items: Record<string, BlingNfItem>;   // key = tipo+id
    fetchedRanges: Record<string, number>; // key = "from-to", value = fetchedAt ms
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const NF_CACHE_KEY = 'bling_nf_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadNfCache(): NfCacheStore {
    try {
        const raw = localStorage.getItem(NF_CACHE_KEY);
        if (!raw) return { items: {}, fetchedRanges: {} };
        return JSON.parse(raw);
    } catch { return { items: {}, fetchedRanges: {} }; }
}

function saveNfCache(store: NfCacheStore) {
    try { localStorage.setItem(NF_CACHE_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

function rangeKey(from: string, to: string) { return `${from}|${to}`; }

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * Fetches all pages of a Bling NF-e or NFC-e endpoint.
 * situacao=2 = Emitida (only issued documents with tax burden).
 */
async function fetchAllPages(
    tipo: 'nfe' | 'nfce',
    token: string,
    dataInicio: string,
    dataFim: string
): Promise<BlingNfItem[]> {
    const endpoint = tipo === 'nfe' ? 'nfe' : 'nfce';
    const all: BlingNfItem[] = [];
    let pagina = 1;

    while (true) {
        const url = `/api/bling?resource=${endpoint}&dataEmissaoInicio=${dataInicio}&dataEmissaoFim=${dataFim}&situacao=2&pagina=${pagina}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) break;
        const json = await res.json();
        const items: any[] = json.data || [];
        if (items.length === 0) break;

        for (const it of items) {
            all.push({
                id: it.id,
                numero: String(it.numero || ''),
                serie: String(it.serie || ''),
                tipo,
                dataEmissao: (it.dataEmissao || '').substring(0, 10),
                totalProdutos: Number(it.valorProdutos ?? it.totalProdutos ?? 0),
                totalNota: Number(it.totalNota ?? it.valorTotal ?? 0),
                situacao: Number(it.situacao ?? 2),
                contato: it.contato ? { nome: it.contato.nome } : undefined,
            });
        }

        if (items.length < 100) break;
        pagina++;
        // Rate-limit safety
        await new Promise(r => setTimeout(r, 300));
    }

    return all;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchNfOptions {
    dataInicio: string; // "YYYY-MM-DD"
    dataFim: string;
    forceRefresh?: boolean;
}

/**
 * Returns all NF-e + NFC-e emitidas in the given date range.
 * Uses localStorage cache (7 days TTL).
 */
export async function fetchNfEmitidas(opts: FetchNfOptions): Promise<BlingNfItem[]> {
    const { dataInicio, dataFim, forceRefresh = false } = opts;
    const cache = loadNfCache();
    const key = rangeKey(dataInicio, dataFim);
    const now = Date.now();

    const isFresh = !forceRefresh &&
        cache.fetchedRanges[key] &&
        now - cache.fetchedRanges[key] < CACHE_TTL_MS;

    if (!isFresh) {
        const token = await getValidToken();
        const [nfes, nfces] = await Promise.all([
            fetchAllPages('nfe', token, dataInicio, dataFim),
            fetchAllPages('nfce', token, dataInicio, dataFim),
        ]);

        const merged = [...nfes, ...nfces];
        for (const item of merged) {
            cache.items[`${item.tipo}-${item.id}`] = item;
        }
        cache.fetchedRanges[key] = now;
        saveNfCache(cache);
    }

    // Return items whose dataEmissao falls within the range
    return Object.values(cache.items).filter(item =>
        item.dataEmissao >= dataInicio && item.dataEmissao <= dataFim
    );
}

/** Clears the NF cache completely (for forced refresh). */
export function clearNfCache() {
    try { localStorage.removeItem(NF_CACHE_KEY); } catch { /* */ }
}
