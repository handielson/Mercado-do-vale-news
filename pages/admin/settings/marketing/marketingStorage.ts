import {
    DEFAULT_CATEGORY_PROFILE,
    type MarketingCategoryProfileMap,
    type MarketingCooldownCache,
} from './marketingDefaults';

const STORAGE_KEYS = {
    dayRules: 'marketing_editorial_day_rules',
    categoryProfiles: 'marketing_editorial_category_profiles',
    manualPicks: 'marketing_editorial_manual_picks',
    cooldown: 'marketing_editorial_cooldown_cache',
    lastKit: 'marketing_last_generated_kit',
} as const;

export type MarketingStorageKey = keyof typeof STORAGE_KEYS;

interface MarketingStorageWriteOptions {
    fallback?: unknown;
    categoryProfiles?: MarketingCategoryProfileMap;
    now?: number;
}

const DAY_IN_MS = 86_400_000;

function isQuotaExceededError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const maybeError = error as {
        code?: number;
        message?: string;
        name?: string;
    };

    return maybeError.name === 'QuotaExceededError'
        || maybeError.code === 22
        || maybeError.code === 1014
        || /quota/i.test(maybeError.message ?? '');
}

function isEmptyObject(value: unknown): value is Record<string, never> {
    return Boolean(value)
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.keys(value as Record<string, unknown>).length === 0;
}

function areSerializedValuesEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function pruneMarketingCooldownCache(
    value: MarketingCooldownCache,
    categoryProfiles: MarketingCategoryProfileMap = {},
    now: number = Date.now(),
): MarketingCooldownCache {
    const maxCooldownDays = Math.max(
        DEFAULT_CATEGORY_PROFILE.cooldownDays,
        ...Object.values(categoryProfiles).map((profile) => (
            Number.isFinite(profile?.cooldownDays) ? Math.max(profile.cooldownDays, 0) : 0
        )),
    );
    const retentionMs = maxCooldownDays * DAY_IN_MS;

    return Object.fromEntries(
        Object.entries(value).filter(([, iso]) => {
            const timestamp = new Date(iso).getTime();
            return Number.isFinite(timestamp) && now - timestamp < retentionMs;
        }),
    );
}

export function prepareMarketingStateForStorage<T>(
    key: MarketingStorageKey,
    value: T,
    options: MarketingStorageWriteOptions = {},
): T | null {
    const normalizedValue = key === 'cooldown'
        ? pruneMarketingCooldownCache(
            value as MarketingCooldownCache,
            options.categoryProfiles,
            options.now,
        ) as T
        : value;

    if (options.fallback !== undefined && areSerializedValuesEqual(normalizedValue, options.fallback)) {
        return null;
    }

    if (isEmptyObject(normalizedValue)) {
        return null;
    }

    return normalizedValue;
}

export function readMarketingState<T>(key: MarketingStorageKey, fallback: T): T {
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEYS[key]);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeMarketingState<T>(
    key: MarketingStorageKey,
    value: T,
    options: MarketingStorageWriteOptions = {},
): boolean {
    if (typeof window === 'undefined') return false;

    const storageKey = STORAGE_KEYS[key];
    const normalizedValue = prepareMarketingStateForStorage(key, value, options);

    try {
        if (normalizedValue === null) {
            window.localStorage.removeItem(storageKey);
            return true;
        }

        window.localStorage.setItem(storageKey, JSON.stringify(normalizedValue));
        return true;
    } catch (error) {
        if (isQuotaExceededError(error)) {
            console.warn(`Nao foi possivel persistir ${storageKey}: quota do localStorage excedida.`, error);
            return false;
        }

        return false;
    }
}

export { STORAGE_KEYS };
