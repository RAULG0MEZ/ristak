import { useState, useEffect } from 'react'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { dateToApiString } from '../lib/dateUtils'

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  recipient: string
  amount: number
  date: string
  time: string
  category: string
  description: string
  status: 'completed' | 'pending' | 'failed' | 'refunded'
  email?: string
  phone?: string
}

export function useTransactionHistory(limit: number = 10) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true)
        setError(null)

        // Obtener últimos 30 días de pagos
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - 30)

        const response = await fetchWithAuth(
          getApiUrl(`/payments?start=${dateToApiString(start)}&end=${dateToApiString(end)}&limit=${limit}`)
        )

        if (!response.ok) {
          throw new Error('Failed to fetch transactions')
        }

        const data = await response.json()

        // Transformar pagos a formato de transacciones
        const formattedTransactions: Transaction[] = data.data.map((payment: any) => {
          const date = new Date(payment.date || payment.createdAt)
          const isRefund = payment.status === 'refunded'

          return {
            id: payment.id,
            type: isRefund ? 'expense' : 'income',
            recipient: payment.contactName || 'Cliente',
            amount: isRefund ? -Math.abs(payment.amount) : Math.abs(payment.amount),
            date: date.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' }),
            time: date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            category: payment.paymentMethod === 'card' ? 'Pago con tarjeta' : 'Transferencia',
            description: payment.description || 'Pago recibido',
            status: payment.status as any,
            email: payment.email,
            phone: payment.phone
          }
        })

        setTransactions(formattedTransactions)
      } catch (err) {
        console.error('Error loading transactions:', err)
        setError('Error al cargar transacciones')
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [limit])

  return { transactions, loading, error }
}