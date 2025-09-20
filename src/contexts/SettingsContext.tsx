import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, fetchWithAuth } from '../config/api';
import { DEFAULT_SETTINGS, getStoredSettings, updateStoredSettings } from '../lib/appSettings';

const timezoneLocaleMap: Record<string, string> = {
  'America/Mexico_City': 'es-MX',
  'America/Tijuana': 'es-MX',
  'America/Cancun': 'es-MX',
  'America/New_York': 'en-US',
  'America/Los_Angeles': 'en-US',
  'America/Chicago': 'en-US',
  'America/Bogota': 'es-CO',
  'America/Buenos_Aires': 'es-AR',
  'America/Sao_Paulo': 'pt-BR',
  'Europe/Madrid': 'es-ES',
  'Europe/London': 'en-GB',
  'Europe/Paris': 'fr-FR'
};

function resolveLocale(timezone: string): string {
  return timezoneLocaleMap[timezone] || 'es-MX';
}

function formatCurrencyFor(amount: number, currency: string, timezone: string): string {
  const locale = resolveLocale(timezone);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

interface SettingsData {
  account_name?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_city?: string;
  user_business_name?: string;
  timezone: string;
  currency: string;
  user_zip_code?: string;
  user_tax?: string;
  user_tax_percentage: number;
  account_logo?: string;
  account_profile_picture?: string;
  user_ui_preferences?: any;
}

interface SettingsContextType {
  settings: SettingsData;
  updateSettings: (data: Partial<SettingsData>) => Promise<void>;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  getCurrencySymbol: () => string;
  loading: boolean;
  updateTablePreferences: (tableName: string, preferences: any) => Promise<void>;
  getTablePreferences: (tableName: string) => any;
}

function getTimezoneOffset(date: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    const parts = dtf.formatToParts(date);
    const data: Record<string, number> = {};

    for (const { type, value } of parts) {
      if (type !== 'literal') {
        data[type] = Number(value);
      }
    }

    const zonedTime = Date.UTC(
      data.year || date.getUTCFullYear(),
      (data.month || (date.getUTCMonth() + 1)) - 1,
      data.day || date.getUTCDate(),
      data.hour ?? date.getUTCHours(),
      data.minute ?? date.getUTCMinutes(),
      data.second ?? date.getUTCSeconds()
    );

    return zonedTime - date.getTime();
  } catch (error) {
    return 0;
  }
}

function createMiddayInTimezone(dateString: string, timeZone: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const utcMidday = Date.UTC(year, month - 1, day, 12, 0, 0);
  const reference = new Date(utcMidday);
  const offset = getTimezoneOffset(reference, timeZone);
  return new Date(utcMidday - offset);
}

function normalizeDateValue(date: Date | string, timeZone: string): Date {
  if (date instanceof Date) {
    return date;
  }

  if (typeof date === 'string') {
    // Para fechas ISO completas con Z (UTC)
    if (date.includes('T') && (date.endsWith('Z') || date.includes('+'))) {
      const dateObj = new Date(date);

      // Si la hora es exactamente 00:00:00 o 06:00:00 UTC, es probable que sea una fecha sin hora específica
      // En estos casos, ajustamos para que se muestre el día correcto en el timezone local
      const hours = dateObj.getUTCHours();
      const minutes = dateObj.getUTCMinutes();
      const seconds = dateObj.getUTCSeconds();

      if (hours === 0 && minutes === 0 && seconds === 0) {
        // Es medianoche UTC, agregamos 12 horas para evitar cambio de día
        return new Date(dateObj.getTime() + 12 * 60 * 60 * 1000);
      } else if (hours === 6 && minutes === 0 && seconds === 0) {
        // Es 6 AM UTC, lo dejamos tal cual (funciona bien para México)
        return dateObj;
      }

      return dateObj;
    }

    // Para fechas simples YYYY-MM-DD, las interpretamos en el timezone configurado
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return createMiddayInTimezone(date, timeZone);
    }

    return new Date(date);
  }

  return new Date(date);
}

const defaultSettings: SettingsData = {
  timezone: DEFAULT_SETTINGS.timezone,
  currency: DEFAULT_SETTINGS.currency,
  user_tax_percentage: DEFAULT_SETTINGS.user_tax_percentage
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Currency symbols map
const currencySymbols: Record<string, string> = {
  MXN: '$',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  ARS: '$',
  BRL: 'R$',
  COP: '$',
  CLP: '$',
  PEN: 'S/'
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = getStoredSettings();
  const [settings, setSettings] = useState<SettingsData>({
    ...defaultSettings,
    timezone: stored.timezone,
    currency: stored.currency,
    user_tax_percentage: stored.user_tax_percentage
  });
  const [loading, setLoading] = useState(true);

  const persistLocally = useCallback((next: SettingsData) => {
    updateStoredSettings({
      timezone: next.timezone,
      currency: next.currency,
      user_tax_percentage: next.user_tax_percentage
    });
  }, []);

  const applySettings = useCallback((next: SettingsData) => {
    setSettings(next);
    persistLocally(next);
  }, [persistLocally]);

  useEffect(() => {
    // Load settings on mount
    fetchWithAuth(getApiUrl('/settings'))
      .then(res => res.json())
      .then(res => {
        if (res?.data) {
          applySettings(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Listen for updates from settings page
    const handleUpdate = (event: CustomEvent) => {
      applySettings(event.detail);
    };
    
    window.addEventListener('settings-updated' as any, handleUpdate);
    return () => window.removeEventListener('settings-updated' as any, handleUpdate);
  }, []);

  const updateSettings = async (data: Partial<SettingsData>) => {
    const previous = settings;
    const optimistic = { ...settings, ...data };

    applySettings(optimistic);

    try {
      const response = await fetchWithAuth(getApiUrl('/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimistic)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData && errorData.error) || 'No se pudo guardar la configuración';
        throw new Error(message);
      }

      const json = await response.json().catch(() => null);
      const finalSettings = json?.data ? json.data : optimistic;

      applySettings(finalSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: finalSettings }));
    } catch (error) {
      console.error('Error persisting settings:', error);
      applySettings(previous);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: previous }));
      throw error;
    }
  };

  const formatCurrency = (amount: number): string => {
    return formatCurrencyFor(amount, settings.currency, settings.timezone);
  };

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const dateObj = normalizeDateValue(date, settings.timezone);
    const locale = resolveLocale(settings.timezone);

    return dateObj.toLocaleString(locale, {
      timeZone: settings.timezone,
      ...options
    });
  };

  const getCurrencySymbol = (): string => {
    return currencySymbols[settings.currency] || '$';
  };

  const updateTablePreferences = async (tableName: string, preferences: any): Promise<void> => {
    try {
      const response = await fetchWithAuth(getApiUrl(`/settings/preferences/${tableName}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update local state with new preferences
        setSettings(prev => ({
          ...prev,
          user_ui_preferences: result.data
        }));
      }
    } catch (error) {
      console.error('Error updating table preferences:', error);
    }
  };

  const getTablePreferences = (tableName: string): any => {
    if (!settings.user_ui_preferences?.tables) {
      return null;
    }
    return settings.user_ui_preferences.tables[tableName] || null;
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    formatCurrency,
    formatDate,
    getCurrencySymbol,
    loading,
    updateTablePreferences,
    getTablePreferences
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

// Export utility functions for use without hook
export function formatCurrencyStatic(
  amount: number,
  currency: string = 'MXN',
  timezone: string = 'America/Mexico_City'
): string {
  return formatCurrencyFor(amount, currency, timezone);
}

export function formatDateStatic(
  date: Date | string,
  timezone: string = 'America/Mexico_City',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = normalizeDateValue(date, timezone);
  const locale = resolveLocale(timezone);

  return dateObj.toLocaleString(locale, {
    timeZone: timezone,
    ...options
  });
}
