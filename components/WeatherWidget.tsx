import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Pencil, X, Check, Loader2 } from 'lucide-react';

interface WeatherData {
    city: string;
    state: string;
    temp: number;
    code: number;
    updatedAt: number;
}

interface GeoResult {
    name: string;
    admin1: string; // estado
    latitude: number;
    longitude: number;
}

interface WeatherWidgetProps {
    defaultCity?: string;
    defaultState?: string;
}

const CACHE_KEY_DATA = 'weather_data';
const CACHE_KEY_CITY = 'weather_city';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function getWeatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
}

function getWeatherLabel(code: number): string {
    if (code === 0) return 'Céu limpo';
    if (code <= 3) return 'Nublado';
    if (code <= 48) return 'Neblina';
    if (code <= 67) return 'Chuva';
    if (code <= 77) return 'Neve';
    if (code <= 82) return 'Pancadas';
    return 'Tempestade';
}

async function fetchCoords(cityName: string): Promise<GeoResult[]> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&country=BR&language=pt&count=5`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
}

async function fetchWeather(lat: number, lng: number): Promise<{ temp: number; code: number }> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode&timezone=America/Sao_Paulo`;
    const res = await fetch(url);
    const data = await res.json();
    return {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weathercode,
    };
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ defaultCity, defaultState }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load weather on mount
    useEffect(() => {
        loadWeather();
    }, [defaultCity]);

    async function loadWeather() {
        // Check cache first
        try {
            const cached = localStorage.getItem(CACHE_KEY_DATA);
            if (cached) {
                const parsed: WeatherData = JSON.parse(cached);
                if (Date.now() - parsed.updatedAt < CACHE_TTL_MS) {
                    setWeather(parsed);
                    return;
                }
            }
        } catch { /* ignore parse errors */ }

        // Determine city to use: user preference or company default
        let targetCity = defaultCity;
        let targetState = defaultState || '';

        try {
            const savedCity = localStorage.getItem(CACHE_KEY_CITY);
            if (savedCity) {
                const parsed = JSON.parse(savedCity);
                targetCity = parsed.name;
                targetState = parsed.state;
                await fetchAndSave(parsed.lat, parsed.lng, parsed.name, parsed.state);
                return;
            }
        } catch { /* ignore */ }

        if (!targetCity) return;

        setLoading(true);
        try {
            const results = await fetchCoords(targetCity);
            if (results.length === 0) return;
            const best = results[0];
            await fetchAndSave(best.latitude, best.longitude, best.name, targetState || best.admin1 || '');
        } catch (e) {
            console.warn('[WeatherWidget] Failed to load weather:', e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchAndSave(lat: number, lng: number, city: string, state: string) {
        setLoading(true);
        try {
            const { temp, code } = await fetchWeather(lat, lng);
            const data: WeatherData = { city, state, temp, code, updatedAt: Date.now() };
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(data));
            setWeather(data);
        } finally {
            setLoading(false);
        }
    }

    // Debounced search
    function handleSearchChange(value: string) {
        setSearchQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (value.length < 2) { setSuggestions([]); return; }

        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const results = await fetchCoords(value);
                setSuggestions(results.slice(0, 5));
            } catch { setSuggestions([]); }
            finally { setSearching(false); }
        }, 400);
    }

    async function handleSelectCity(result: GeoResult) {
        const cityPref = { name: result.name, state: result.admin1 || '', lat: result.latitude, lng: result.longitude };
        localStorage.setItem(CACHE_KEY_CITY, JSON.stringify(cityPref));
        // Invalidate weather cache
        localStorage.removeItem(CACHE_KEY_DATA);
        setSuggestions([]);
        setEditing(false);
        setSearchQuery('');
        await fetchAndSave(result.latitude, result.longitude, result.name, result.admin1 || '');
    }

    function handleEditOpen() {
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    function handleCancelEdit() {
        setEditing(false);
        setSearchQuery('');
        setSuggestions([]);
    }

    if (!defaultCity && !weather) return null;

    return (
        <div className="hidden sm:flex items-center border-l border-slate-200 pl-4 ml-2 relative">
            {loading && !weather ? (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Carregando...</span>
                </div>
            ) : editing ? (
                /* ── Edit mode ── */
                <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Buscar cidade..."
                            className="w-36 text-xs px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-700 outline-none focus:border-blue-400"
                        />
                        {searching && (
                            <Loader2 size={11} className="animate-spin absolute right-2 top-1.5 text-slate-400" />
                        )}
                        {suggestions.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                                {suggestions.map((r, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelectCity(r)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                    >
                                        <span className="font-medium">{r.name}</span>
                                        {r.admin1 && <span className="text-slate-400"> — {r.admin1}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleCancelEdit}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Cancelar"
                    >
                        <X size={13} />
                    </button>
                </div>
            ) : weather ? (
                /* ── Display mode ── */
                <div className="flex items-center gap-2">
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none flex items-center gap-1">
                            <MapPin size={9} />
                            {weather.city}{weather.state ? `, ${weather.state}` : ''}
                        </span>
                        <span className="text-sm font-semibold text-slate-700 leading-tight mt-0.5 flex items-center gap-1">
                            <span>{getWeatherIcon(weather.code)}</span>
                            <span>{weather.temp}°C</span>
                            <span className="text-[10px] font-normal text-slate-400">{getWeatherLabel(weather.code)}</span>
                        </span>
                    </div>
                    <button
                        onClick={handleEditOpen}
                        className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Trocar cidade"
                    >
                        <Pencil size={12} />
                    </button>
                </div>
            ) : null}
        </div>
    );
};
