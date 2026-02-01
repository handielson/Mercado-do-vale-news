
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { pb } from '../services/pb';

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
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

  useEffect(() => {
    async function fetchSettings() {
      // In dev mode, skip PocketBase and use defaults immediately
      if (DEV_MODE) {
        console.log('🔧 DEV MODE: Using default theme settings');
        setSettings({
          company_name: 'Mercado do Vale',
          theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
        });
        setIsLoading(false);
        return;
      }

      try {
        // Fetch first settings record
        const record = await pb.collection('settings').getFirstListItem('');

        const themeSettings: ThemeSettings = {
          company_name: record.company_name,
          theme_colors: record.theme_colors || {},
          logo_main: record.logo_main ? pb.files.getUrl(record, record.logo_main) : undefined,
          logo_dark: record.logo_dark ? pb.files.getUrl(record, record.logo_dark) : undefined,
        };

        setSettings(themeSettings);

        // Inject dynamic CSS variables into :root
        if (themeSettings.theme_colors) {
          Object.entries(themeSettings.theme_colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
          });
        }
      } catch (error) {
        console.warn('Failed to load theme settings from PocketBase. Using defaults.');
        // Default fallbacks
        setSettings({
          company_name: 'Mercado do Vale',
          theme_colors: { primary: '#3b82f6', secondary: '#1e293b' }
        });
      } finally {
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
          Carregando Identidade...
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
