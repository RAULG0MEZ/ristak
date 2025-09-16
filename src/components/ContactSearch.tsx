import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '../icons';
import { useContacts } from '../hooks/useContacts';

interface ContactSearchProps {
  value: string | null;
  onChange: (contactId: string | null) => void;
  className?: string;
}

export function ContactSearch({ value, onChange, className = '' }: ContactSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [newContactForm, setNewContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get contacts from the current date range
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 90); // Solo últimos 3 meses para mejor performance

  const { contacts, createContact } = useContacts({
    start: thirtyDaysAgo,
    end: today
  });

  // Filter contacts based on search term
  const filteredContacts = searchTerm.length >= 1
    ? contacts.filter(contact => {
        const search = searchTerm.toLowerCase();
        return (
          contact.name?.toLowerCase().includes(search) ||
          contact.email?.toLowerCase().includes(search) ||
          contact.phone?.includes(search) ||
          contact.company?.toLowerCase().includes(search)
        );
      })
    : [];

  // Load selected contact on mount or when value changes
  useEffect(() => {
    if (value && contacts.length > 0) {
      const contact = contacts.find(c => c.id === value);
      if (contact) {
        setSelectedContact(contact);
      }
    }
  }, [value, contacts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRemoveContact = () => {
    setSelectedContact(null);
    setSearchTerm('');
    onChange(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelectContact = (contact: any) => {
    setSelectedContact(contact);
    onChange(contact.id);
    setSearchTerm('');
    setIsOpen(false);
    setShowCreateForm(false);
  };

  const handleCreateContact = async () => {
    // Solo validar que el nombre no esté vacío
    if (!newContactForm.name.trim()) {
      console.error('Error de validación: El nombre es requerido');
      return;
    }

    try {
      const newContact = await createContact(newContactForm);
      handleSelectContact(newContact);
      setNewContactForm({ name: '', email: '', phone: '', company: '' });
      console.log('Contacto creado exitosamente');
    } catch (error) {
      console.error('Error creating contact:', error);
      console.error('Error al crear contacto');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setShowCreateForm(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selectedContact ? (
        // Show selected contact as chip
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg border border-glassBorder">
          <Icons.user className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-primary truncate">
              {selectedContact.name}
            </div>
            {selectedContact.email && (
              <div className="text-xs text-tertiary truncate">
                {selectedContact.email}
              </div>
            )}
          </div>
          <button
            onClick={handleRemoveContact}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            type="button"
          >
            <Icons.x className="w-4 h-4 text-tertiary hover:text-primary" />
          </button>
        </div>
      ) : (
        // Show search input
        <>
          <div className="relative">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
              placeholder="Buscar o crear contacto..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
                setShowCreateForm(false);
              }}
              onFocus={() => searchTerm && setIsOpen(true)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Dropdown */}
          {isOpen && searchTerm && (
            <div className="absolute z-50 w-full mt-2 glass rounded-lg border border-glassBorder shadow-xl overflow-hidden">
              {/* Search results */}
              {filteredContacts.length > 0 && !showCreateForm && (
                <div className="max-h-60 overflow-y-auto">
                  {filteredContacts.slice(0, 5).map((contact) => (
                    <button
                      key={contact.id}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                      onClick={() => handleSelectContact(contact)}
                      type="button"
                    >
                      <Icons.user className="w-4 h-4 text-tertiary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary truncate">
                          {contact.name}
                        </div>
                        <div className="text-xs text-tertiary truncate">
                          {contact.email || contact.phone || 'Sin datos de contacto'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Create new contact option */}
              {!showCreateForm && (
                <button
                  className="w-full px-4 py-3 text-left border-t border-glassBorder hover:bg-white/5 transition-colors flex items-center gap-3"
                  onClick={() => {
                    setShowCreateForm(true);
                    setNewContactForm({ ...newContactForm, name: searchTerm });
                  }}
                  type="button"
                >
                  <Icons.plus className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-primary">
                    Crear contacto "{searchTerm}"
                  </span>
                </button>
              )}

              {/* Inline create form */}
              {showCreateForm && (
                <div className="p-4 space-y-3">
                  <div className="text-sm font-medium text-primary mb-3">
                    Crear nuevo contacto
                  </div>

                  <div>
                    <input
                      type="text"
                      className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Nombre *"
                      value={newContactForm.name}
                      onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })}
                      autoFocus
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Email"
                      value={newContactForm.email}
                      onChange={(e) => setNewContactForm({ ...newContactForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Teléfono"
                      value={newContactForm.phone}
                      onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Empresa (opcional)"
                      value={newContactForm.company}
                      onChange={(e) => setNewContactForm({ ...newContactForm, company: e.target.value })}
                    />
                  </div>

                  <div className="text-xs text-tertiary">
                    * Solo el nombre es obligatorio
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      className="flex-1 px-3 py-2 glass rounded-lg border border-glassBorder hover:bg-white/5 transition-colors text-sm text-secondary"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewContactForm({ name: '', email: '', phone: '', company: '' });
                      }}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                      onClick={handleCreateContact}
                      type="button"
                    >
                      Crear contacto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}