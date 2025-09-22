export interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'archived'
  spend: number
  clicks: number
  leads: number
  cpc: number
  cpl: number
  cac: number
  roas: number
  adSets?: AdSet[]
}

export interface AdSet {
  id: string
  campaignId: string
  name: string
  status: 'active' | 'paused' | 'archived'
  spend: number
  clicks: number
  leads: number
  cpc: number
  cpl: number
  ads?: Ad[]
}

export interface Ad {
  id: string
  adSetId: string
  name: string
  status: 'active' | 'paused' | 'archived'
  spend: number
  clicks: number
  leads: number
  cpc: number
  cpl: number
}

export interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  status: 'lead' | 'appointment' | 'client'
  ltv: number
  source?: string
  campaignId?: string
  adId?: string
  createdAt: string
  visitorId?: string
  lastContact?: string
  company?: string
  attributionAdId?: string
  appointments?: number
}

export interface Payment {
  id: string
  contactId?: string
  contactName?: string
  amount: number
  date: string
  status: 'pending' | 'completed' | 'refunded'
  description?: string
  type: 'income' | 'expense'
  category?: string
  transactionId?: string
  email?: string
}

export interface Webhook {
  id: string
  event: string
  source: string
  status: number
  data: any
  timestamp: string
  error?: string
}

export interface KPIMetric {
  label: string
  value: number | string
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  prefix?: string
  suffix?: string
}

export interface ChartData {
  date: string
  income: number
  expenses: number
  profit?: number
}

export interface ImportJob {
  id: string
  type: 'contacts' | 'payments' | 'appointments'
  status: 'processing' | 'completed' | 'failed'
  total: number
  processed: number
  successful: number
  failed: number
  progress: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  errors?: any[]
}
