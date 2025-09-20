import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatCurrencyStatic, formatDateStatic } from '../contexts/SettingsContext'
import { getStoredSettings } from './appSettings'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencyOverride?: string): string {
  const { currency, timezone } = getStoredSettings()
  return formatCurrencyStatic(amount, currencyOverride || currency, timezone)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

const defaultDateOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}

export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = defaultDateOptions): string {
  const { timezone } = getStoredSettings()
  return formatDateStatic(date, timezone, options)
}

export function formatTime(date: Date | string): string {
  const { timezone } = getStoredSettings()
  return formatDateStatic(date, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}
