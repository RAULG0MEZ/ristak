import { useState, useEffect } from 'react';
import { getApiUrl, fetchWithAuth, getAuthHeaders } from '../config/api';
import { dateToApiString } from '../lib/dateUtils';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  attributionAdId?: string;
  ghlId: string;
  status: 'lead' | 'appointment' | 'client';
  source: string;
  createdAt: string;
  updatedAt: string;
  appointments: number;
  payments: number;
  ltv: number;
}

interface ContactMetrics {
  total: number;
  withAppointments: number;
  customers: number;
  totalLTV: number;
  avgLTV: number;
  conversionRate: number;
  appointmentRate: number;
  trends?: {
    total: number;
    withAppointments: number;
    customers: number;
    totalLTV: number;
    avgLTV: number;
  };
}

interface DateRange {
  start: Date;
  end: Date;
}

interface UseContactsOptions {
  start?: Date;
  end?: Date;
  page?: number;
  limit?: number;
  all?: boolean;
}

interface PaginatedResponse {
  data: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useContacts(options: UseContactsOptions = {}) {
  const {
    start,
    end,
    page = 1,
    limit = 50,
    all = false
  } = options;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [metrics, setMetrics] = useState<ContactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [pageSize, setPageSize] = useState(limit);
  const [totalPages, setTotalPages] = useState(0);

  const fetchContacts = async (fetchPage?: number, fetchLimit?: number) => {
    try {
      setLoading(true);
      setError(null);

      const actualPage = fetchPage || currentPage;
      const actualLimit = fetchLimit || pageSize;

      let contactsUrl: string;
      let metricsUrl: string | null = null;

      if (all) {
        // Fetch all contacts with pagination and global metrics
        contactsUrl = getApiUrl(`/contacts?all=true&page=${actualPage}&limit=${actualLimit}`);
        metricsUrl = getApiUrl('/contacts/metrics?all=true');
      } else if (start && end) {
        // Formatear fechas como YYYY-MM-DD para evitar problemas de timezone
        const startStr = dateToApiString(start);
        const endStr = dateToApiString(end);

        contactsUrl = getApiUrl(`/contacts?start=${startStr}&end=${endStr}&page=${actualPage}&limit=${actualLimit}`);
        metricsUrl = getApiUrl(`/contacts/metrics?start=${startStr}&end=${endStr}`);
      } else {
        // No data to fetch
        setContacts([]);
        setTotalCount(0);
        setTotalPages(0);
        setLoading(false);
        return;
      }

      const promises: Promise<Response>[] = [fetchWithAuth(contactsUrl)];
      if (metricsUrl) {
        promises.push(fetchWithAuth(metricsUrl));
      }

      const responses = await Promise.all(promises);
      const contactsRes = responses[0];
      const metricsRes = metricsUrl ? responses[1] : null;

      if (!contactsRes.ok || (metricsRes && !metricsRes.ok)) {
        throw new Error('Failed to fetch contacts data');
      }

      const contactsData: PaginatedResponse = await contactsRes.json();
      const metricsData = metricsRes ? await metricsRes.json() : null;

      setContacts(contactsData.data || []);
      setTotalCount(contactsData.total || 0);
      setCurrentPage(contactsData.page || actualPage);
      setPageSize(contactsData.limit || actualLimit);
      setTotalPages(contactsData.totalPages || 0);

      setMetrics(metricsData?.data ?? null);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // NO resetear datos en error - mantener datos existentes
      // Solo resetear si es la primera carga y no hay datos
      if (contacts.length === 0 && !metrics) {
        setContacts([]);
        setMetrics(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (data: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  }) => {
    try {
      const response = await fetchWithAuth(getApiUrl('/contacts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create contact');

      const result = await response.json();
      // Refrescar la lista de contactos
      await fetchContacts();
      return result.data;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  };

  const updateContact = async (id: string, data: Partial<Contact>) => {
    try {
      const response = await fetchWithAuth(getApiUrl(`/contacts/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || 'Error al actualizar contacto';
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Actualizar el contacto en la lista local sin refrescar todo
      setContacts(prevContacts =>
        prevContacts.map(contact =>
          contact.id === id
            ? { ...contact, ...result.data }
            : contact
        )
      );

      return result.data;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const response = await fetchWithAuth(getApiUrl(`/contacts/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to delete contact');

      // Refrescar la lista de contactos
      await fetchContacts();
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  };

  const bulkDeleteContacts = async (ids: string[]) => {
    try {
      const response = await fetchWithAuth(getApiUrl('/contacts/bulk-delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Failed to delete contacts');

      const result = await response.json();
      // Refrescar la lista de contactos
      await fetchContacts();
      return result.deletedCount;
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      throw error;
    }
  };

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    fetchContacts(newPage, pageSize);
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing size
    fetchContacts(1, newSize);
  };

  useEffect(() => {
    fetchContacts();
  }, [start, end, all]);

  return {
    contacts,
    metrics,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    totalPages,
    refetch: fetchContacts,
    changePage,
    changePageSize,
    createContact,
    updateContact,
    deleteContact,
    bulkDeleteContacts
  };
}
