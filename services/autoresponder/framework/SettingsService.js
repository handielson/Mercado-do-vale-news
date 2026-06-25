/**
 * Mercado do Vale AI Framework v1.0
 * SettingsService: Caches and manages system-wide configurations with live reloading.
 */

let pool = null;
let cache = {};

const DEFAULT_SETTINGS = {
    'automation.enabled': 'true',
    'automation.handoff_enabled': 'true',
    'automation.typing_enabled': 'true',
    'automation.typing_profile': 'balanced',
    'automation.resume_mode': 'manual',
    'automation.pause_timeout': '1440'
};

export function init(mysqlPool) {
    pool = mysqlPool;
}

export async function loadSettings() {
    if (!pool) return;
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
        const dbSettings = {};
        for (const row of rows) {
            dbSettings[row.setting_key] = row.setting_value;
        }

        // Seed defaults if they are missing
        const newCache = {};
        for (const [key, defVal] of Object.entries(DEFAULT_SETTINGS)) {
            if (dbSettings[key] === undefined) {
                await pool.query(
                    'INSERT INTO system_settings (setting_key, setting_value, version, updated_by) VALUES (?, ?, 1, ?)',
                    [key, defVal, 'system']
                );
                newCache[key] = defVal;
            } else {
                newCache[key] = dbSettings[key];
            }
        }

        // Add any non-default keys loaded from DB
        for (const [key, val] of Object.entries(dbSettings)) {
            newCache[key] = val;
        }

        cache = newCache;
    } catch (err) {
        console.error('[SettingsService] Failed to load settings:', err);
    }
}

export function get(key, defaultValue) {
    if (cache[key] !== undefined) {
        const val = cache[key];
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (!isNaN(val) && val.trim() !== '') return Number(val);
        return val;
    }
    return defaultValue;
}

export async function set(key, value, updatedBy = 'system') {
    if (!pool) return;
    const strValue = String(value);
    
    const [rows] = await pool.query('SELECT version FROM system_settings WHERE setting_key = ?', [key]);
    if (rows.length > 0) {
        const nextVersion = (rows[0].version || 0) + 1;
        await pool.query(
            'UPDATE system_settings SET setting_value = ?, version = ?, updated_by = ? WHERE setting_key = ?',
            [strValue, nextVersion, updatedBy, key]
        );
    } else {
        await pool.query(
            'INSERT INTO system_settings (setting_key, setting_value, version, updated_by) VALUES (?, ?, 1, ?)',
            [key, strValue, updatedBy]
        );
    }
    
    invalidate();
    await reload();
}

export function invalidate() {
    cache = {};
}

export async function reload() {
    await loadSettings();
}
