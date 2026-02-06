
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../services/supabase';

interface ThemeSettings {
  company_name: string;
  theme_colors: Record<string, string>;
  logo_main?: string;
  logo_dark?: string;
}

interface ThemeContextType {
  settings: ThemeSettings | null;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        console.log('[ThemeContext] Fetching company settings...');

        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[ThemeContext] Query timeout! Using defaults.');
          setSettings({
            company_name: 'Mercado do Vale',
            theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
          });
          setIsLoading(false);
        }, 5000); // 5 second timeout

        // Fetch company settings from Supabase
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .maybeSingle(); // Use maybeSingle to handle missing records gracefully

        clearTimeout(timeoutId); // Clear timeout if query completes

        if (error) {
          console.warn('[ThemeContext] Error fetching settings:', error);
          throw error;
        }

        if (!data) {
          console.warn('[ThemeContext] No company_settings found, using defaults');
          // No settings found, use defaults
          setSettings({
            company_name: 'Mercado do Vale',
            theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
          });
          setIsLoading(false);
          return;
        }

        const themeSettings: ThemeSettings = {
          company_name: data.company_name || 'Mercado do Vale',
          theme_colors: data.theme_colors || { primary: '#3b82f6', secondary: '#1e293b' },
          logo_main: data.logo_main,
          logo_dark: data.logo_dark,
        };

        setSettings(themeSettings);

        // Inject dynamic CSS variables into :root
        if (themeSettings.theme_colors) {
          Object.entries(themeSettings.theme_colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
          });
        }

        console.log('[ThemeContext] Settings loaded successfully');
        setIsLoading(false);
      } catch (error) {
        console.warn('[ThemeContext] Failed to load theme settings. Using defaults.', error);
        // Default fallbacks
        setSettings({
          company_name: 'Mercado do Vale',
          theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
        });
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Pre-load skeleton or empty state to avoid "unstyled flash"
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse text-blue-400 font-bold text-xl uppercase tracking-tighter">
          Atualizando Catálogo...
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ settings, isLoading }}>
      <Helmet>
        <title>{settings?.company_name || 'Carregando...'}</title>
        {settings?.logo_main && <link rel="icon" href={settings.logo_main} />}
      </Helmet>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
