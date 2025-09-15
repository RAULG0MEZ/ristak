import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiUrl } from '../config/api';

interface SubaccountData {
  subaccount_id?: string;
  subaccount_name?: string;
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
  subaccount_logo?: string;
  subaccount_profile_picture?: string;
  user_ui_preferences?: any;
}

interface SubaccountContextType {
  subaccount: SubaccountData;
  updateSubaccount: (data: Partial<SubaccountData>) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  getCurrencySymbol: () => string;
  loading: boolean;
  updateTablePreferences: (tableName: string, preferences: any) => Promise<void>;
  getTablePreferences: (tableName: string) => any;
}

const defaultSubaccount: SubaccountData = {
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  user_tax_percentage: 16
};

const SubaccountContext = createContext<SubaccountContextType | undefined>(undefined);

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

export function SubaccountProvider({ children }: { children: ReactNode }) {
  const [subaccount, setSubaccount] = useState<SubaccountData>(defaultSubaccount);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load subaccount configuration on mount
    fetch(getApiUrl('/subaccount'))
      .then(res => res.json())
      .then(res => {
        if (res?.data) {
          setSubaccount(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Listen for updates from settings page
    const handleUpdate = (event: CustomEvent) => {
      setSubaccount(event.detail);
    };
    
    window.addEventListener('subaccount-updated' as any, handleUpdate);
    return () => window.removeEventListener('subaccount-updated' as any, handleUpdate);
  }, []);

  const updateSubaccount = (data: Partial<SubaccountData>) => {
    const updated = { ...subaccount, ...data };
    setSubaccount(updated);
    // Persist to backend
    fetch(getApiUrl('/subaccount'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(console.error);
  };

  const formatCurrency = (amount: number): string => {
    const symbol = currencySymbols[subaccount.currency] || '$';
    const formatted = new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    
    // For some currencies, put symbol after
    if (subaccount.currency === 'EUR') {
      return `${formatted} ${symbol}`;
    }
    return `${symbol}${formatted}`;
  };

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Map timezone to locale
    const localeMap: Record<string, string> = {
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
    
    const locale = localeMap[subaccount.timezone] || 'es-MX';
    
    return dateObj.toLocaleString(locale, {
      timeZone: subaccount.timezone,
      ...options
    });
  };

  const getCurrencySymbol = (): string => {
    return currencySymbols[subaccount.currency] || '$';
  };

  const updateTablePreferences = async (tableName: string, preferences: any): Promise<void> => {
    try {
      const response = await fetch(getApiUrl(`/subaccount/preferences/${tableName}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update local state with new preferences
        setSubaccount(prev => ({
          ...prev,
          user_ui_preferences: result.data
        }));
      }
    } catch (error) {
      console.error('Error updating table preferences:', error);
    }
  };

  const getTablePreferences = (tableName: string): any => {
    if (!subaccount.user_ui_preferences?.tables) {
      return null;
    }
    return subaccount.user_ui_preferences.tables[tableName] || null;
  };

  const value: SubaccountContextType = {
    subaccount,
    updateSubaccount,
    formatCurrency,
    formatDate,
    getCurrencySymbol,
    loading,
    updateTablePreferences,
    getTablePreferences
  };

  return (
    <SubaccountContext.Provider value={value}>
      {children}
    </SubaccountContext.Provider>
  );
}

export function useSubaccount() {
  const context = useContext(SubaccountContext);
  if (!context) {
    throw new Error('useSubaccount must be used within SubaccountProvider');
  }
  return context;
}

// Export utility functions for use without hook
export function formatCurrencyStatic(amount: number, currency: string = 'MXN'): string {
  const symbol = currencySymbols[currency] || '$';
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  if (currency === 'EUR') {
    return `${formatted} ${symbol}`;
  }
  return `${symbol}${formatted}`;
}

export function formatDateStatic(
  date: Date | string, 
  timezone: string = 'America/Mexico_City',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  
  const localeMap: Record<string, string> = {
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
  
  const locale = localeMap[timezone] || 'es-MX';
  
  return dateObj.toLocaleString(locale, {
    timeZone: timezone,
    ...options
  });
}