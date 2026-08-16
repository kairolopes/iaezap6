'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { label: '📊 Dashboard', href: '/dashboard', icon: '📊' },
    { label: '👥 Gerenciamento de Usuários', href: '/dashboard/users', icon: '👥' },
    { label: '💬 Integração Z-API', href: '/dashboard/z-api', icon: '💬', disabled: true },
    { label: '⚙️ Admin Panel', href: '/dashboard/admin', icon: '⚙️', disabled: true },
    { label: '📱 Webhook Receiver', href: '/dashboard/webhooks', icon: '📱', disabled: true },
    { label: '🔐 Autenticação', href: '/dashboard/auth', icon: '🔐', disabled: true },
  ];

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: isOpen ? '280px' : '80px',
          backgroundColor: '#1f2937',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo/Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #374151',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🚀</div>
          {isOpen && (
            <>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>IAeZap</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>CRM Automation</div>
            </>
          )}
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingRight: isOpen ? '0' : '0' }}>
          {menuItems.map((item) => (
            <button
              key={item.href}
              onClick={() => !item.disabled && router.push(item.href)}
              disabled={item.disabled}
              style={{
                width: '100%',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: 'none',
                backgroundColor: isActive(item.href) ? '#3b82f6' : 'transparent',
                color: item.disabled ? '#6b7280' : 'white',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: isActive(item.href) ? 'bold' : 'normal',
                borderLeft: isActive(item.href) ? '4px solid #60a5fa' : '4px solid transparent',
                transition: 'all 0.2s ease',
                opacity: item.disabled ? 0.5 : 1,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled && !isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (!item.disabled && !isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title={item.disabled ? 'Em desenvolvimento' : item.label}
            >
              <span style={{ fontSize: '18px', minWidth: '24px' }}>{item.icon}</span>
              {isOpen && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                  {item.disabled && ' (em breve)'}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div
          style={{
            borderTop: '1px solid #374151',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {isOpen && (
            <div style={{ fontSize: '12px', color: '#d1d5db' }}>
              <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Conectado como:</div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{userName}</div>
              <div style={{ display: 'inline-block', backgroundColor: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                {userRole.toUpperCase()}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '10px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
          >
            {isOpen ? '🚪 Sair' : '🚪'}
          </button>
        </div>

        {/* Toggle Button */}
        <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #374151' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              backgroundColor: '#374151',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '18px',
            }}
            title={isOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isOpen ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f3f4f6' }}>
        {/* Content will be rendered here by child components */}
        <slot />
      </div>
    </div>
  );
}
