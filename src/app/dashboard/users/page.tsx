'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'member'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const tokenStr = localStorage.getItem('access_token');

    if (!userStr || !tokenStr) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userStr));
    setToken(tokenStr);
    loadUsers(tokenStr);
  }, [router]);

  const loadUsers = async (accessToken: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.full_name || !formData.email || !formData.password) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newUser = await response.json();
        setUsers([...users, newUser]);
        setSuccess(`Usuário ${formData.full_name} criado com sucesso!`);
        setFormData({ full_name: '', email: '', password: '', role: 'member' });
        setShowForm(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errData = await response.json();
        setError(errData.message || 'Erro ao criar usuário');
      }
    } catch (err: any) {
      setError('Erro ao conectar com o servidor: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>👥 Gerenciamento de Usuários</h1>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Crie e gerencie usuários da sua empresa</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Voltar
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Success/Error Messages */}
        {success && (
          <div style={{ backgroundColor: '#d1fae5', border: '1px solid #6ee7b7', color: '#047857', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            ✅ {success}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            ❌ {error}
          </div>
        )}

        {/* Create User Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '24px'
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Novo Usuário'}
        </button>

        {/* Create User Form */}
        {showForm && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Criar Novo Usuário</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="João Silva"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="joao@example.com"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
                    Senha
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
                    Papel
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="viewer">Viewer (Apenas visualização)</option>
                    <option value="member">Member (Acesso completo)</option>
                    <option value="admin">Admin (Gerenciamento)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '16px',
                  padding: '10px 24px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Criar Usuário
              </button>
            </form>
          </div>
        )}

        {/* Users List */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Usuários da Empresa</h3>

          {loading ? (
            <p>Carregando usuários...</p>
          ) : users.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Nenhum usuário encontrado.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>Nome</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>Papel</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px', fontSize: '14px' }}>👤 {u.full_name}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{u.email}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        <span style={{
                          backgroundColor: u.role === 'owner' ? '#fef3c7' : u.role === 'admin' ? '#dbeafe' : u.role === 'member' ? '#dcfce7' : '#f3f4f6',
                          color: u.role === 'owner' ? '#92400e' : u.role === 'admin' ? '#1e40af' : u.role === 'member' ? '#166534' : '#374151',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        <span style={{
                          backgroundColor: u.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: u.status === 'active' ? '#047857' : '#dc2626',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {u.status === 'active' ? '✅ Ativo' : '❌ Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
