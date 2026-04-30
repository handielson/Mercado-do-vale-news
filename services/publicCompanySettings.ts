import { USE_VPS } from '../config/migration';
import type { BusinessHours, LocalHoliday, WarrantyOption } from '../types/companySettings';
import type { Company } from '../types/company';
import { defaultCompany } from '../types/company';

type JsonLike<T> = T | string | null | undefined;

export interface PublicCompanySettings {
  id?: string;
  company_name: string;
  name?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  data_abertura?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  receipt_logo_url?: string | null;
  favicon?: string | null;
  address?: string;
  address_zip_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  social_youtube?: string | null;
  social_website?: string | null;
  google_reviews_link?: string | null;
  google_analytics_id?: string | null;
  pix_discount_percentage?: number | null;
  business_hours?: BusinessHours;
  holiday_overrides?: string[];
  local_holidays?: LocalHoliday[];
  business_hours_display_text?: string | null;
  store_label_open?: string | null;
  store_label_closed?: string | null;
  store_label_closing_soon?: string | null;
  store_label_lunch?: string | null;
  extended_warranty_options?: WarrantyOption[];
  extended_warranty_terms_text?: string | null;
  synology_video_base_url?: string | null;
  synology_video_extension?: string | null;
  description?: string | null;
  catalog_footer_text?: string | null;
  about_us_text?: string | null;
  about_us_image_url?: string | null;
  maintenance_mode?: boolean | null;
  maintenance_message?: string | null;
  maintenance_bypass_hash?: string | null;
  updated_at?: string | null;
}

const PUBLIC_COMPANY_SETTINGS_PATH = '/public/company-settings';
const LS_KEY = 'mdv_public_company_settings';
const LS_TTL = 10 * 60 * 1000;
const MEM_TTL = 5 * 60 * 1000;
const PUBLIC_FETCH_TIMEOUT_MS = 3500;

const PUBLIC_COMPANY_SETTINGS_COLUMNS = [
  'id',
  'company_name',
  'name',
  'razao_social',
  'cnpj',
  'data_abertura',
  'phone',
  'email',
  'logo',
  'receipt_logo_url',
  'favicon',
  'address',
  'address_zip_code',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
  'address_lat',
  'address_lng',
  'social_instagram',
  'social_facebook',
  'social_youtube',
  'social_website',
  'google_reviews_link',
  'google_analytics_id',
  'pix_discount_percentage',
  'business_hours',
  'holiday_overrides',
  'local_holidays',
  'business_hours_display_text',
  'store_label_open',
  'store_label_closed',
  'store_label_closing_soon',
  'store_label_lunch',
  'extended_warranty_options',
  'extended_warranty_terms_text',
  'synology_video_base_url',
  'synology_video_extension',
  'description',
  'catalog_footer_text',
  'about_us_text',
  'about_us_image_url',
  'maintenance_mode',
  'maintenance_message',
  'updated_at',
].join(',');

let memCache: { data: PublicCompanySettings; expiresAt: number } | null = null;
let settingsPromise: Promise<PublicCompanySettings | null> | null = null;
let companyDataPromise: Promise<Company> | null = null;

function parseJsonValue<T>(value: JsonLike<T>, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toBooleanOrFalse(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'sim'].includes(value.trim().toLowerCase());
  return false;
}

function buildAddress(row: Record<string, any>): string {
  if (row.address) return String(row.address);

  const parts = [];
  if (row.address_street) {
    parts.push(`${row.address_street}, ${row.address_number || 'S/N'}`);
  }
  if (row.address_complement) parts.push(row.address_complement);
  if (row.address_neighborhood) parts.push(row.address_neighborhood);

  const cityState = [row.address_city, row.address_state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);
  if (row.address_zip_code) parts.push(`CEP: ${row.address_zip_code}`);

  return parts.filter(Boolean).join(' - ');
}

function readLocalStorage(): PublicCompanySettings | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return data as PublicCompanySettings;
  } catch {
    return null;
  }
}

function writeLocalStorage(data: PublicCompanySettings): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, expiresAt: Date.now() + LS_TTL }));
  } catch {
    // localStorage can be full or unavailable in private contexts.
  }
}

async function loadFromSupabase(): Promise<unknown | null> {
  const { supabase } = await import('./supabase');

  const { data, error } = await supabase
    .from('company_settings')
    .select(PUBLIC_COMPANY_SETTINGS_COLUMNS)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

async function loadFromPublicVps(): Promise<unknown | null> {
  const { buildVpsUrl } = await import('./vpsProxyBase');
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS)
    : undefined;
  const response = await fetch(buildVpsUrl(PUBLIC_COMPANY_SETTINGS_PATH, { method: 'GET' }), {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Public company settings request failed: ${response.status}`);
  }

  return response.json();
}

export function sanitizePublicCompanySettings(input: Record<string, any> | null | undefined): PublicCompanySettings | null {
  if (!input) return null;

  const row = input as Record<string, any>;
  const companyName = toStringOrNull(row.company_name) || toStringOrNull(row.name) || 'Mercado do Vale';

  return {
    id: toStringOrNull(row.id) || undefined,
    company_name: companyName,
    name: toStringOrNull(row.name) || companyName,
    razao_social: toStringOrNull(row.razao_social),
    cnpj: toStringOrNull(row.cnpj),
    data_abertura: toStringOrNull(row.data_abertura),
    phone: toStringOrNull(row.phone),
    email: toStringOrNull(row.email),
    logo: toStringOrNull(row.logo),
    receipt_logo_url: toStringOrNull(row.receipt_logo_url),
    favicon: toStringOrNull(row.favicon),
    address: buildAddress(row),
    address_zip_code: toStringOrNull(row.address_zip_code),
    address_street: toStringOrNull(row.address_street),
    address_number: toStringOrNull(row.address_number),
    address_complement: toStringOrNull(row.address_complement),
    address_neighborhood: toStringOrNull(row.address_neighborhood),
    address_city: toStringOrNull(row.address_city),
    address_state: toStringOrNull(row.address_state),
    address_lat: toNumberOrNull(row.address_lat),
    address_lng: toNumberOrNull(row.address_lng),
    social_instagram: toStringOrNull(row.social_instagram),
    social_facebook: toStringOrNull(row.social_facebook),
    social_youtube: toStringOrNull(row.social_youtube),
    social_website: toStringOrNull(row.social_website),
    google_reviews_link: toStringOrNull(row.google_reviews_link),
    google_analytics_id: toStringOrNull(row.google_analytics_id),
    pix_discount_percentage: toNumberOrNull(row.pix_discount_percentage),
    business_hours: parseJsonValue<BusinessHours | undefined>(row.business_hours, undefined),
    holiday_overrides: parseJsonValue<string[]>(row.holiday_overrides, []),
    local_holidays: parseJsonValue<LocalHoliday[]>(row.local_holidays, []),
    business_hours_display_text: toStringOrNull(row.business_hours_display_text),
    store_label_open: toStringOrNull(row.store_label_open),
    store_label_closed: toStringOrNull(row.store_label_closed),
    store_label_closing_soon: toStringOrNull(row.store_label_closing_soon),
    store_label_lunch: toStringOrNull(row.store_label_lunch),
    extended_warranty_options: parseJsonValue<WarrantyOption[]>(row.extended_warranty_options, []),
    extended_warranty_terms_text: toStringOrNull(row.extended_warranty_terms_text),
    synology_video_base_url: toStringOrNull(row.synology_video_base_url),
    synology_video_extension: toStringOrNull(row.synology_video_extension) || '.mp4',
    description: toStringOrNull(row.description),
    catalog_footer_text: toStringOrNull(row.catalog_footer_text),
    about_us_text: toStringOrNull(row.about_us_text),
    about_us_image_url: toStringOrNull(row.about_us_image_url),
    maintenance_mode: toBooleanOrFalse(row.maintenance_mode),
    maintenance_message: toStringOrNull(row.maintenance_message),
    maintenance_bypass_hash: toStringOrNull(row.maintenance_bypass_hash),
    updated_at: toStringOrNull(row.updated_at),
  };
}

export function publicCompanySettingsToCompany(settings: PublicCompanySettings | null | undefined): Company {
  if (!settings) return defaultCompany;

  return {
    ...defaultCompany,
    name: settings.name || settings.company_name || defaultCompany.name,
    razaoSocial: settings.razao_social || '',
    cnpj: settings.cnpj || '',
    dataAbertura: settings.data_abertura || '',
    phone: settings.phone || '',
    email: settings.email || '',
    logo: settings.logo || settings.receipt_logo_url || null,
    logoUrl: settings.logo || settings.receipt_logo_url || '',
    favicon: settings.favicon || null,
    address: {
      zipCode: settings.address_zip_code || '',
      street: settings.address_street || '',
      number: settings.address_number || '',
      complement: settings.address_complement || '',
      neighborhood: settings.address_neighborhood || '',
      city: settings.address_city || '',
      state: settings.address_state || '',
      lat: settings.address_lat || undefined,
      lng: settings.address_lng || undefined,
    },
    socialMedia: {
      instagram: settings.social_instagram || '',
      facebook: settings.social_facebook || '',
      youtube: settings.social_youtube || '',
      website: settings.social_website || '',
    },
    googleReviewsLink: settings.google_reviews_link || '',
    googleAnalyticsId: settings.google_analytics_id || '',
    pixKey: '',
    pixKeyType: undefined,
    pixBeneficiaryName: '',
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    pixDiscountPercentage: settings.pix_discount_percentage || 0,
    businessHours: settings.business_hours_display_text || '',
    description: settings.description || '',
    internalNotes: '',
    catalogFooterText: settings.catalog_footer_text || defaultCompany.catalogFooterText,
    aboutUsText: settings.about_us_text || '',
    aboutUsImageUrl: settings.about_us_image_url || '',
    synologyVideoBaseUrl: settings.synology_video_base_url || '',
    synologyVideoExtension: settings.synology_video_extension || '.mp4',
    shopee_partner_id: '',
    shopee_partner_key: '',
    shopee_shop_id: '',
    shopee_access_token: '',
    shopee_refresh_token: '',
    shopee_printer_thermal: '',
    shopee_printer_a4: '',
    maintenanceMode: Boolean(settings.maintenance_mode),
    maintenanceMessage: settings.maintenance_message || defaultCompany.maintenanceMessage,
    maintenanceBypassKey: '',
  };
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return '';

  const bytes = new TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function matchesPublicMaintenanceBypass(
  settings: PublicCompanySettings | null | undefined,
  candidate: string | null | undefined,
): Promise<boolean> {
  const hash = settings?.maintenance_bypass_hash;
  const value = String(candidate || '').trim();
  if (!hash || !value) return false;
  return (await sha256Hex(value)) === hash;
}

export const publicCompanySettingsService = {
  async get(): Promise<PublicCompanySettings | null> {
    if (memCache && Date.now() < memCache.expiresAt) return memCache.data;

    const cached = readLocalStorage();
    if (cached) {
      memCache = { data: cached, expiresAt: Date.now() + MEM_TTL };
      return cached;
    }

    if (!settingsPromise) {
      settingsPromise = (async () => {
        try {
          const raw = USE_VPS.company
            ? await loadFromPublicVps()
            : await loadFromSupabase();
          const sanitized = sanitizePublicCompanySettings(raw as Record<string, any>);

          if (sanitized) {
            memCache = { data: sanitized, expiresAt: Date.now() + MEM_TTL };
            writeLocalStorage(sanitized);
          }

          return sanitized;
        } catch {
          if (USE_VPS.company) {
            try {
              const fallback = sanitizePublicCompanySettings((await loadFromSupabase()) as Record<string, any>);
              if (fallback) {
                memCache = { data: fallback, expiresAt: Date.now() + MEM_TTL };
                writeLocalStorage(fallback);
              }
              return fallback;
            } catch {
              return null;
            }
          }

          return null;
        }
      })().finally(() => {
        settingsPromise = null;
      });
    }

    return settingsPromise;
  },

  clearCache(): void {
    memCache = null;
    settingsPromise = null;
    companyDataPromise = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        // ignore
      }
    }
  },
};

export async function getPublicCompanyData(): Promise<Company> {
  if (!companyDataPromise) {
    companyDataPromise = publicCompanySettingsService
      .get()
      .then(publicCompanySettingsToCompany)
      .catch(() => defaultCompany);
  }

  return companyDataPromise;
}
