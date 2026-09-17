export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
    type: string;
    scope?: 'national' | 'state' | 'municipal' | 'manual';
    location?: string;
    source?: string;
}

const HOLIDAYS_CACHE_KEY = 'mv_holidays_cache';
const HOLIDAYS_CACHE_EXPIRY_KEY = 'mv_holidays_cache_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function formatDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function dateFromEasterOffset(year: number, offsetDays: number): string {
    // Algoritmo de Meeus/Jones/Butcher para o calendário gregoriano.
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const date = new Date(year, month - 1, day, 12);
    date.setDate(date.getDate() + offsetDays);
    return formatDateKey(date);
}

function nationalFallback(year: number): Holiday[] {
    return [
        [`${year}-01-01`, 'Confraternização Universal'],
        [dateFromEasterOffset(year, -2), 'Paixão de Cristo'],
        [`${year}-04-21`, 'Tiradentes'],
        [`${year}-05-01`, 'Dia Mundial do Trabalho'],
        [`${year}-09-07`, 'Independência do Brasil'],
        [`${year}-10-12`, 'Nossa Senhora Aparecida'],
        [`${year}-11-02`, 'Finados'],
        [`${year}-11-15`, 'Proclamação da República'],
        [`${year}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra'],
        [`${year}-12-25`, 'Natal'],
    ].map(([date, name]) => ({
        date,
        name,
        type: 'national',
        scope: 'national' as const,
        location: 'Brasil',
        source: 'BrasilAPI / calendário nacional',
    }));
}

export function getRegionalHolidays(year: number): Holiday[] {
    const regional: Holiday[] = [
        {
            date: `${year}-03-06`,
            name: 'Data Magna de Pernambuco',
            type: 'state',
            scope: 'state',
            location: 'Pernambuco',
            source: 'Lei Estadual nº 16.059/2017',
        },
        {
            date: `${year}-07-02`,
            name: 'Independência da Bahia',
            type: 'state',
            scope: 'state',
            location: 'Bahia',
            source: 'Data Magna do Estado da Bahia',
        },
        {
            date: dateFromEasterOffset(year, 60),
            name: 'Corpus Christi',
            type: 'municipal',
            scope: 'municipal',
            location: 'Petrolina-PE',
            source: 'Lei Municipal nº 403/1992',
        },
        {
            date: `${year}-06-24`,
            name: 'São João',
            type: 'municipal',
            scope: 'municipal',
            location: 'Petrolina-PE',
            source: 'Calendário oficial municipal',
        },
        {
            date: `${year}-08-15`,
            name: 'Nossa Senhora Rainha dos Anjos',
            type: 'municipal',
            scope: 'municipal',
            location: 'Petrolina-PE',
            source: 'Calendário oficial municipal',
        },
        {
            date: `${year}-09-21`,
            name: 'Emancipação Política de Petrolina',
            type: 'municipal',
            scope: 'municipal',
            location: 'Petrolina-PE',
            source: 'Calendário oficial municipal',
        },
        {
            date: dateFromEasterOffset(year, -2),
            name: 'Paixão de Cristo',
            type: 'municipal',
            scope: 'municipal',
            location: 'Juazeiro-BA',
            source: 'Calendário oficial municipal',
        },
        {
            date: `${year}-07-15`,
            name: 'Aniversário de Juazeiro',
            type: 'municipal',
            scope: 'municipal',
            location: 'Juazeiro-BA',
            source: 'Calendário oficial municipal',
        },
        {
            date: `${year}-09-08`,
            name: 'Nossa Senhora das Grotas',
            type: 'municipal',
            scope: 'municipal',
            location: 'Juazeiro-BA',
            source: 'Calendário oficial municipal',
        },
    ];

    // O Carnaval foi declarado feriado municipal em Juazeiro pelo Decreto nº 020/2026.
    if (year === 2026) {
        regional.push({
            date: dateFromEasterOffset(year, -47),
            name: 'Carnaval',
            type: 'municipal',
            scope: 'municipal',
            location: 'Juazeiro-BA',
            source: 'Decreto Municipal nº 020/2026',
        });
    }

    return regional.sort((left, right) => left.date.localeCompare(right.date));
}

function mergeNationalHolidays(year: number, apiHolidays: Holiday[]): Holiday[] {
    const byDate = new Map<string, Holiday>();
    for (const holiday of nationalFallback(year)) byDate.set(holiday.date, holiday);
    for (const holiday of apiHolidays) {
        byDate.set(holiday.date, {
            ...holiday,
            scope: 'national',
            location: 'Brasil',
            source: 'BrasilAPI',
        });
    }
    return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export const holidayService = {
    /**
     * Fetches Brazilian national holidays from BrasilAPI
     * https://brasilapi.com.br/api/feriados/v1/{year}
     */
    async getHolidays(year: number): Promise<Holiday[]> {
        try {
            // Check cache
            const cacheKey = `${HOLIDAYS_CACHE_KEY}_${year}`;
            const expiryKey = `${HOLIDAYS_CACHE_EXPIRY_KEY}_${year}`;

            const cachedData = localStorage.getItem(cacheKey);
            const cacheExpiry = localStorage.getItem(expiryKey);

            if (cachedData && cacheExpiry && Date.now() < parseInt(cacheExpiry)) {
                return mergeNationalHolidays(year, JSON.parse(cachedData));
            }

            // Fetch from API
            const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return nationalFallback(year);
                }
                throw new Error(`Failed to fetch holidays: ${response.status}`);
            }

            const holidays: Holiday[] = await response.json();

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify(holidays));
            localStorage.setItem(expiryKey, (Date.now() + CACHE_DURATION_MS).toString());

            return mergeNationalHolidays(year, holidays);
        } catch (error) {
            console.error('Error fetching holidays from BrasilAPI:', error);
            return nationalFallback(year);
        }
    },

    /** Combina os feriados nacionais com as regras oficiais de PE, BA, Petrolina e Juazeiro. */
    async getCalendarHolidays(year: number): Promise<Holiday[]> {
        const national = await this.getHolidays(year);
        return [...national, ...getRegionalHolidays(year)].sort((left, right) => left.date.localeCompare(right.date));
    },

    /**
     * Checks if a given date is a holiday
     */
    async isHoliday(date: Date): Promise<Holiday | null> {
        const year = date.getFullYear();
        const holidays = await this.getHolidays(year);

        // Format date to YYYY-MM-DD
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const holiday = holidays.find(h => h.date === dateString);
        return holiday || null;
    }
};
