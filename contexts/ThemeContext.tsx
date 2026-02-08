
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
  settings: ThemeSettings; // Always available (never null)
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start with default settings immediately (no loading state blocking render)
  const [settings, setSettings] = useState<ThemeSettings>({
    company_name: 'Mercado do Vale',
    theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
  });
  const [isLoading, setIsLoading] = useState(false); // Changed to false - no blocking

  useEffect(() => {
    async function fetchSettings() {
      try {
        console.log('[ThemeContext] Fetching company settings in background...');

        // Fetch company settings from Supabase (background load)
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .maybeSingle();

        if (error) {
          console.warn('[ThemeContext] Error fetching settings, keeping defaults:', error);
          return;
        }

        if (!data) {
          console.warn('[ThemeContext] No company_settings found, keeping defaults');
          return;
        }

        const themeSettings: ThemeSettings = {
          company_name: data.company_name || 'Mercado do Vale',
          theme_colors: data.theme_colors || { primary: '#3b82f6', secondary: '#1e293b' },
          logo_main: data.logo_main,
          logo_dark: data.logo_dark,
        };

        // Update settings (will cause seamless re-render)
        setSettings(themeSettings);

        // Inject dynamic CSS variables into :root
        if (themeSettings.theme_colors) {
          Object.entries(themeSettings.theme_colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
          });
        }

        console.log('[ThemeContext] Settings loaded and applied successfully');
      } catch (error) {
        console.warn('[ThemeContext] Failed to load theme settings. Keeping defaults.', error);
      }
    }

    fetchSettings();
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, isLoading }}>
      <Helmet>
        <title>{settings.company_name}</title>
        {settings.logo_main && <link rel="icon" href={settings.logo_main} />}
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
