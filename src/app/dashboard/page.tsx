'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const tokenStr = localStorage.getItem('access_token');

    if (!userStr || !tokenStr) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userStr));
    setToken(tokenStr.substring(0, 50) + '...');
  }, [router]);

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
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>🚀 IAeZap Dashboard</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '14px' }}>
            <strong>{user.full_name}</strong><br/>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>{user.email}</span>
          </div>
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
        {/* Welcome Card */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>✨ Bem-vindo ao IAeZap!</h2>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Sistema multi-tenant de CRM para automação WhatsApp com integração Z-API.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '4px', borderLeft: '4px solid #2563eb' }}>
              <strong>👤 Usuário</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</span>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '4px', borderLeft: '4px solid #16a34a' }}>
              <strong>🏢 Empresa</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{user.company_id}</span>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '4px', borderLeft: '4px solid #f59e0b' }}>
              <strong>👑 Papel</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{user.role.toUpperCase()}</span>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f3e8ff', borderRadius: '4px', borderLeft: '4px solid #a855f7' }}>
              <strong>✅ Status</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{user.status}</span>
            </div>
          </div>
        </div>

        {/* Token Info */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>🔐 Token de Acesso (RS256)</h3>
          <div style={{ backgroundColor: '#1f2937', color: '#10b981', padding: '12px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', overflow: 'auto', maxHeight: '80px' }}>
            {token}
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
            ✅ Token JWT RS256 ativo - Válido por 15 minutos
          </p>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <FeatureCard
            icon="📊"
            title="Dashboard"
            description="Visualize estatísticas e métricas do seu negócio"
            status="Pronto"
            onClick={() => {}}
          />
          <FeatureCard
            icon="👥"
            title="Gerenciamento de Usuários"
            description="Crie e gerencie usuários da sua empresa"
            status="Pronto"
            onClick={() => {
              try {
                window.location.href = '/dashboard/users';
              } catch (e) {
                console.error('Erro ao navegar:', e);
              }
            }}
          />
          <FeatureCard
            icon="💬"
            title="Integração Z-API"
            description="Receba e envie mensagens WhatsApp automaticamente"
            status="Ativo"
            onClick={() => {}}
          />
          <FeatureCard
            icon="🔧"
            title="Admin Panel"
            description="Painel administrativo para gerenciar empresas"
            status="Disponível"
            onClick={() => {}}
          />
          <FeatureCard
            icon="📱"
            title="Webhook Receiver"
            description="Receba eventos e webhooks do Z-API"
            status="Ativo"
            onClick={() => {}}
          />
          <FeatureCard
            icon="🔐"
            title="Autenticação JWT"
            description="Autenticação segura com RS256 e refresh tokens"
            status="Ativo"
            onClick={() => {}}
          />
        </div>

        {/* API Endpoints */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginTop: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>📡 API Endpoints Disponíveis</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <EndpointItem method="POST" endpoint="/api/auth/login" description="Fazer login com email/password" />
            <EndpointItem method="POST" endpoint="/api/auth/register" description="Registrar nova empresa" />
            <EndpointItem method="GET" endpoint="/api/admin/companies" description="Listar empresas (master only)" />
            <EndpointItem method="POST" endpoint="/api/admin/companies" description="Criar empresa (master only)" />
            <EndpointItem method="GET" endpoint="/api/admin/users" description="Listar usuários da empresa" />
            <EndpointItem method="POST" endpoint="/api/admin/users" description="Criar novo usuário" />
            <EndpointItem method="PATCH" endpoint="/api/admin/users/:id/role" description="Alterar papel do usuário" />
            <EndpointItem method="POST" endpoint="/api/webhooks/z-api/receive" description="Receber webhooks Z-API" />
          </div>
        </div>

        {/* Code Example */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginTop: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>💻 Exemplo de Uso (cURL)</h3>
          <pre style={{
            backgroundColor: '#1f2937',
            color: '#10b981',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace'
          }}>
{`# Login
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email":"kairolopesoficial@gmail.com",
    "password":"jx&CL%mFvt!x*Sm0"
  }'

# Usar token para requisições autenticadas
curl -X GET http://localhost:3000/api/admin/users \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, status, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        transform: onClick ? 'scale(1)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
      }}
    >
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{description}</p>
      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>✅ {status}</div>
    </div>
  );
}

function EndpointItem({ method, endpoint, description }: any) {
  const methodColor = {
    GET: '#3b82f6',
    POST: '#10b981',
    PATCH: '#f59e0b',
    DELETE: '#ef4444'
  }[method];

  return (
    <div style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{
        backgroundColor: methodColor,
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
        minWidth: '45px',
        textAlign: 'center'
      }}>
        {method}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#1f2937' }}>{endpoint}</div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>{description}</div>
      </div>
    </div>
  );
}
