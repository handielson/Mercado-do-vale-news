export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
    type: string;
}

const HOLIDAYS_CACHE_KEY = 'mv_holidays_cache';
const HOLIDAYS_CACHE_EXPIRY_KEY = 'mv_holidays_cache_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
                return JSON.parse(cachedData);
            }

            // Fetch from API
            const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return []; // Holidays not found for this year yet
                }
                throw new Error(`Failed to fetch holidays: ${response.status}`);
            }

            const holidays: Holiday[] = await response.json();

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify(holidays));
            localStorage.setItem(expiryKey, (Date.now() + CACHE_DURATION_MS).toString());

            return holidays;
        } catch (error) {
            console.error('Error fetching holidays from BrasilAPI:', error);
            return []; // Fail gracefully, if we can't check holidays we just assume it's normal business hours
        }
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
