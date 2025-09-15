import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';

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
}

interface DateRange {
  start: Date;
  end: Date;
}

export function useContacts({ start, end }: DateRange) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [metrics, setMetrics] = useState<ContactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [contactsRes, metricsRes] = await Promise.all([
        fetch(
          getApiUrl(`/contacts?start=${start.toISOString()}&end=${end.toISOString()}`)
        ),
        fetch(
          getApiUrl(`/contacts/metrics?start=${start.toISOString()}&end=${end.toISOString()}`)
        )
      ]);

      if (!contactsRes.ok || !metricsRes.ok) {
        throw new Error('Failed to fetch contacts data');
      }

      const contactsData = await contactsRes.json();
      const metricsData = await metricsRes.json();

      setContacts(contactsData.data || []);
      setMetrics(metricsData.data || null);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set empty data on error
      setContacts([]);
      setMetrics(null);
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
      const response = await fetch(getApiUrl('/contacts'), {
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
      const response = await fetch(getApiUrl(`/contacts/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to update contact');

      // Refrescar la lista de contactos
      await fetchContacts();
      return true;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/contacts/${id}`), {
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
      const response = await fetch(getApiUrl('/contacts/bulk-delete'), {
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

  useEffect(() => {
    fetchContacts();
  }, [start, end]);

  return {
    contacts,
    metrics,
    loading,
    error,
    refetch: fetchContacts,
    createContact,
    updateContact,
    deleteContact,
    bulkDeleteContacts
  };
}