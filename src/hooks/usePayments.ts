import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';

interface Payment {
  id: string;
  contactId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  company?: string;
  amount: number;
  currency: string;
  transactionId: string;
  paymentMethod?: string;
  status: 'completed' | 'pending' | 'refunded';
  description?: string;
  invoiceNumber?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  type: 'income' | 'expense';
}

interface PaymentMetrics {
  completed: {
    count: number;
    total: number;
  };
  refunded: {
    count: number;
    total: number;
  };
  pending: {
    count: number;
    total: number;
  };
  netRevenue: number;
  totalRevenue: number;
  totalExpenses: number;
  avgPayment: number;
  successRate: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

export function usePayments({ start, end }: DateRange) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [paymentsRes, metricsRes] = await Promise.all([
        fetch(
          getApiUrl(`/payments?start=${start.toISOString()}&end=${end.toISOString()}`)
        ),
        fetch(
          getApiUrl(`/payments/metrics?start=${start.toISOString()}&end=${end.toISOString()}`)
        )
      ]);

      if (!paymentsRes.ok || !metricsRes.ok) {
        throw new Error('Failed to fetch payments data');
      }

      const paymentsData = await paymentsRes.json();
      const metricsData = await metricsRes.json();

      setPayments(paymentsData.data || []);
      setMetrics(metricsData.data || null);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set empty data on error
      setPayments([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const updatePayment = async (id: string, data: Partial<Payment>) => {
    try {
      const response = await fetch(getApiUrl(`/payments/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to update payment');

      // Refrescar la lista de pagos
      await fetchPayments();
      return true;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  };

  const createPayment = async (data: {
    contactId: string;
    amount: number;
    date: string;
    description?: string;
    paymentMethod?: string;
    status?: string;
    invoiceNumber?: string;
  }) => {
    try {
      const response = await fetch(getApiUrl('/payments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create payment');

      const result = await response.json();
      // Refrescar la lista de pagos
      await fetchPayments();
      return result.data;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/payments/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to delete payment');

      // Refrescar la lista de pagos
      await fetchPayments();
      return true;
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [start, end]);

  return {
    payments,
    metrics,
    loading,
    error,
    refetch: fetchPayments,
    createPayment,
    updatePayment,
    deletePayment
  };
}