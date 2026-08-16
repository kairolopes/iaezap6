'use client';

import { useEffect, useState } from 'react';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [page, setPage] = useState(0);
  const limit = 10;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
  });

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        params.append('limit', limit.toString());
        params.append('offset', (page * limit).toString());

        const response = await fetch(`/api/crm/contacts?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setContacts(data.contacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [search, page]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create');
      setFormData({ name: '', email: '', phone: '', whatsapp_number: '' });
      setShowCreateModal(false);
      setPage(0);
      // Refresh contacts
      window.location.reload();
    } catch (error) {
      console.error('Error creating contact:', error);
      alert('Failed to create contact');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete');
      setShowDetailModal(false);
      setPage(0);
      window.location.reload();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    }
  };

  return (
    <div style={{ padding: '32px', backgroundColor: '#111827', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#f3f4f6', fontSize: '24px', fontWeight: '700', margin: 0 }}>
          👥 CRM - Contatos
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Novo Contato
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #374151',
            backgroundColor: '#1f2937',
            color: '#f3f4f6',
            outline: 'none',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Contacts Table */}
      <div style={{ backgroundColor: '#1f2937', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#d1d5db' }}>
            Carregando...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#d1d5db' }}>
            Nenhum contato encontrado
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                    Nome
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                    Email
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                    Telefone
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                    Data Criação
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowDetailModal(true);
                    }}
                    style={{
                      borderBottom: '1px solid #374151',
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: '#f3f4f6' }}>{contact.name}</td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db', fontSize: '14px' }}>
                      {contact.email || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db', fontSize: '14px' }}>
                      {contact.phone || contact.whatsapp_number || '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: contact.status === 'active' ? '#10b981' : '#ef4444',
                          color: 'white',
                        }}
                      >
                        {contact.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#d1d5db', fontSize: '14px' }}>
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #374151' }}>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: page === 0 ? '#374151' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  opacity: page === 0 ? 0.5 : 1,
                }}
              >
                Anterior
              </button>
              <span style={{ color: '#d1d5db' }}>Página {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={contacts.length < limit}
                style={{
                  padding: '8px 16px',
                  backgroundColor: contacts.length < limit ? '#374151' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: contacts.length < limit ? 'not-allowed' : 'pointer',
                  opacity: contacts.length < limit ? 0.5 : 1,
                }}
              >
                Próximo
              </button>
            </div>
          </>
        )}
      </div>

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              padding: '32px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#f3f4f6', fontSize: '18px', fontWeight: '600', marginBottom: '16px', margin: 0 }}>
              Novo Contato
            </h2>
            <form onSubmit={handleCreateContact}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#d1d5db', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: '#f3f4f6',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#d1d5db', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: '#f3f4f6',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#d1d5db', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Telefone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: '#f3f4f6',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: '#d1d5db', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: '#f3f4f6',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#374151',
                    color: '#d1d5db',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedContact && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              padding: '32px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#f3f4f6', fontSize: '18px', fontWeight: '600', marginBottom: '16px', margin: 0 }}>
              {selectedContact.name}
            </h2>
            <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.8', marginBottom: '24px' }}>
              <p><strong>Email:</strong> {selectedContact.email || 'N/A'}</p>
              <p><strong>Telefone:</strong> {selectedContact.phone || 'N/A'}</p>
              <p><strong>WhatsApp:</strong> {selectedContact.whatsapp_number || 'N/A'}</p>
              <p>
                <strong>Status:</strong> {' '}
                <span style={{ color: selectedContact.status === 'active' ? '#10b981' : '#ef4444' }}>
                  {selectedContact.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </p>
              <p><strong>Criado em:</strong> {new Date(selectedContact.created_at).toLocaleDateString()}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  handleDeleteContact(selectedContact.id);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Deletar
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#374151',
                  color: '#d1d5db',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
