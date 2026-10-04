// LC 123/2006, Anexos I–V (redação da LC 155/2016).
// Fonte: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp155.htm
// Valores da tabela e entrada de calcSimples em REAIS; dados operacionais em centavos.
interface SimplesAnexo { name: string; faixas: { limite: number; aliquota: number; deducao: number }[] }
const limites = [180000, 360000, 720000, 1800000, 3600000, 4800000];
function tabela(name: string, aliquotas: number[], deducoes: number[]): SimplesAnexo {
    return { name, faixas: limites.map((limite, i) => ({ limite, aliquota: aliquotas[i], deducao: deducoes[i] })) };
}
export const SIMPLES_ANEXOS: Record<string, SimplesAnexo> = {
    I: tabela('Anexo I — Comércio', [.04,.073,.095,.107,.143,.19], [0,5940,13860,22500,87300,378000]),
    II: tabela('Anexo II — Indústria', [.045,.078,.10,.112,.147,.30], [0,5940,13860,22500,85500,720000]),
    III: tabela('Anexo III — Serviços', [.06,.112,.135,.16,.21,.33], [0,9360,17640,35640,125640,648000]),
    IV: tabela('Anexo IV — Serviços', [.045,.09,.102,.14,.22,.33], [0,8100,12420,39780,183780,828000]),
    V: tabela('Anexo V — Serviços', [.155,.18,.195,.205,.23,.305], [0,4500,9900,17100,62100,540000]),
};

export function calcSimples(rbt12: number, anexo: string) {
    if (!Number.isFinite(rbt12) || rbt12 <= 0 || rbt12 > 4800000) return null;
    const tab = Object.hasOwn(SIMPLES_ANEXOS, anexo) ? SIMPLES_ANEXOS[anexo] : null;
    if (!tab) return null;
    const i = tab.faixas.findIndex(f => rbt12 <= f.limite);
    const { aliquota, deducao } = tab.faixas[i];
    return { faixa: i + 1, aliquotaNominal: aliquota, deducao,
        aliquotaEfetiva: (rbt12 * aliquota - deducao) / rbt12 };
}

export function currentAccountingCompetence(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
    return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}

/** Regra de RBT12 vigente até dezembro/2026: 12 meses anteriores ao PA. */
export function accountingPeriod(competence: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) return null;
    const [year, month] = competence.split('-').map(Number);
    // Não aplicar automaticamente as regras anteriores após a mudança de 2027.
    if (year < 2018 || year > 2026) return null;
    const start = new Date(Date.UTC(year, month - 13, 1));
    const end = new Date(Date.UTC(year, month - 1, 0));
    const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), months,
        currentFrom: `${competence}-01`, currentTo: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}
