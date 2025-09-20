export interface StoredSettingsState {
  timezone: string;
  currency: string;
  user_tax_percentage: number;
}

const DEFAULT_SETTINGS: StoredSettingsState = {
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  user_tax_percentage: 16
};

let cachedSettings: StoredSettingsState = { ...DEFAULT_SETTINGS };
let initialized = false;
const STORAGE_KEY = 'ristak:settings';

function safeParse(value: string | null): StoredSettingsState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const timezone = typeof parsed.timezone === 'string' ? parsed.timezone : DEFAULT_SETTINGS.timezone;
    const currency = typeof parsed.currency === 'string' ? parsed.currency : DEFAULT_SETTINGS.currency;
    const user_tax_percentage = Number.isFinite(parsed.user_tax_percentage) ? parsed.user_tax_percentage : DEFAULT_SETTINGS.user_tax_percentage;
    return { timezone, currency, user_tax_percentage };
  } catch (error) {
    return null;
  }
}

function ensureInitialized() {
  if (initialized) return;
  if (typeof window === 'undefined') {
    initialized = true;
    return;
  }

  const globalState = (window as any).__ristakSettings;
  if (globalState && typeof globalState === 'object') {
    cachedSettings = {
      timezone: typeof globalState.timezone === 'string' ? globalState.timezone : DEFAULT_SETTINGS.timezone,
      currency: typeof globalState.currency === 'string' ? globalState.currency : DEFAULT_SETTINGS.currency,
      user_tax_percentage: Number.isFinite(globalState.user_tax_percentage) ? globalState.user_tax_percentage : DEFAULT_SETTINGS.user_tax_percentage
    };
    initialized = true;
    return;
  }

  const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (stored) {
    cachedSettings = stored;
  }
  (window as any).__ristakSettings = cachedSettings;
  initialized = true;
}

export function getStoredSettings(): StoredSettingsState {
  ensureInitialized();
  return cachedSettings;
}

export function updateStoredSettings(partial: Partial<StoredSettingsState>): StoredSettingsState {
  ensureInitialized();

  cachedSettings = {
    ...cachedSettings,
    ...partial
  };

  if (typeof window !== 'undefined') {
    (window as any).__ristakSettings = cachedSettings;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
    } catch (error) {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }

  return cachedSettings;
}

export function resetStoredSettings() {
  cachedSettings = { ...DEFAULT_SETTINGS };
  initialized = false;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore
    }
    delete (window as any).__ristakSettings;
  }
}

export { DEFAULT_SETTINGS };
