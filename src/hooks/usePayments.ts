import { useState, useEffect } from 'react';
import { getApiUrl, fetchWithAuth } from '../config/api';
import { dateToApiString } from '../lib/dateUtils';

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

interface UsePaymentsOptions {
  start?: Date;
  end?: Date;
  page?: number;
  limit?: number;
  all?: boolean;
}

interface PaginatedResponse {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function usePayments(options: UsePaymentsOptions = {}) {
  const {
    start,
    end,
    page = 1,
    limit = 50,
    all = false
  } = options;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [pageSize, setPageSize] = useState(limit);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPayments = async (fetchPage?: number, fetchLimit?: number) => {
    try {
      setLoading(true);
      setError(null);

      const actualPage = fetchPage || currentPage;
      const actualLimit = fetchLimit || pageSize;

      let paymentsUrl: string;
      let metricsUrl: string | null = null;

      if (all) {
        paymentsUrl = getApiUrl(`/payments?all=true&page=${actualPage}&limit=${actualLimit}`);
        metricsUrl = getApiUrl('/payments/metrics?all=true');
      } else if (start && end) {
        // Formatear fechas como YYYY-MM-DD para evitar problemas de timezone
        const startStr = dateToApiString(start);
        const endStr = dateToApiString(end);

        paymentsUrl = getApiUrl(`/payments?start=${startStr}&end=${endStr}&page=${actualPage}&limit=${actualLimit}`);
        metricsUrl = getApiUrl(`/payments/metrics?start=${startStr}&end=${endStr}`);
      } else {
        // No data to fetch
        setPayments([]);
        setTotalCount(0);
        setTotalPages(0);
        setMetrics(null);
        setLoading(false);
        return;
      }

      const promises: Promise<Response>[] = [fetchWithAuth(paymentsUrl)];
      if (metricsUrl) {
        promises.push(fetchWithAuth(metricsUrl));
      }

      const responses = await Promise.all(promises);
      const paymentsRes = responses[0];
      const metricsRes = responses[1];

      if (!paymentsRes.ok || (metricsRes && !metricsRes.ok)) {
        throw new Error('Failed to fetch payments data');
      }

      const paymentsData: PaginatedResponse = await paymentsRes.json();
      const metricsData = metricsRes ? await metricsRes.json() : null;

      setPayments(paymentsData.data || []);
      setTotalCount(paymentsData.total || 0);
      setCurrentPage(paymentsData.page || actualPage);
      setPageSize(paymentsData.limit || actualLimit);
      setTotalPages(paymentsData.totalPages || 0);

      if (metricsData) {
        setMetrics(metricsData.data ?? null);
      } else if (!metricsUrl) {
        setMetrics(null);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // NO resetear datos en error - mantener datos existentes
      // Solo resetear si es la primera carga y no hay datos
      if (payments.length === 0 && !metrics) {
        setPayments([]);
        setMetrics(null);
      }
    } finally {
      setLoading(false);
    }
  };


  const updatePayment = async (id: string, data: Partial<Payment>) => {
    try {
      const response = await fetchWithAuth(getApiUrl(`/payments/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to update payment');

      // Refrescar la lista de pagos
      await fetchPayments();
      return (await response.json()).data;
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
      const response = await fetchWithAuth(getApiUrl('/payments'), {
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
      const response = await fetchWithAuth(getApiUrl(`/payments/${id}`), {
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

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    fetchPayments(newPage, pageSize);
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing size
    fetchPayments(1, newSize);
  };

  useEffect(() => {
    fetchPayments();
  }, [start, end, all]);

  // Reintento automático en caso de error
  useEffect(() => {
    if (error && retryCount < 3) {
      const timer = setTimeout(() => {
        console.log(`Reintentando carga de pagos (intento ${retryCount + 1}/3)...`);
        setRetryCount(prev => prev + 1);
        fetchPayments();
      }, 2000 * (retryCount + 1)); // Backoff exponencial: 2s, 4s, 6s

      return () => clearTimeout(timer);
    }
  }, [error, retryCount]);

  // Reset retry count cuando los datos se cargan exitosamente
  useEffect(() => {
    if (payments.length > 0 || metrics) {
      setRetryCount(0);
    }
  }, [payments, metrics]);

  return {
    payments,
    metrics,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    totalPages,
    refetch: fetchPayments,
    changePage,
    changePageSize,
    createPayment,
    updatePayment,
    deletePayment
  };
}
