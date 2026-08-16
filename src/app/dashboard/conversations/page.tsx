'use client';

import { useEffect, useRef, useState } from 'react';

interface Conversation {
  id: string;
  contact_id: string;
  status: 'open' | 'pending' | 'resolved' | 'archived';
  created_at: string;
  updated_at: string;
  contacts?: { name: string; email: string; phone: string; whatsapp_number: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'contact' | 'agent';
  sender_id: string;
  content: string;
  media_url?: string;
  created_at: string;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [filter, setFilter] = useState<'open' | 'pending' | 'resolved' | 'archived'>('open');
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/conversations?status=${filter}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setConversations(data.conversations);
        if (data.conversations.length > 0 && !selectedConversation) {
          fetchConversationDetail(data.conversations[0].id);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [filter]);

  // Fetch conversation detail
  const fetchConversationDetail = async (conversationId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSelectedConversation(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: messageInput,
          sender_type: 'agent',
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      setMessageInput('');
      await fetchConversationDetail(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Update conversation status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedConversation) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update');
      await fetchConversationDetail(selectedConversation.id);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-400';
      case 'pending': return 'text-yellow-400';
      case 'resolved': return 'text-green-400';
      case 'archived': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#111827' }}>
      {/* Sidebar - Conversations List */}
      <div style={{ width: '320px', borderRight: '1px solid #374151', display: 'flex', flexDirection: 'column', backgroundColor: '#1f2937' }}>
        {/* Filter Buttons */}
        <div style={{ padding: '16px', borderBottom: '1px solid #374151', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['open', 'pending', 'resolved', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === status ? '#3b82f6' : '#374151',
                color: filter === status ? 'white' : '#d1d5db',
                fontSize: '12px',
                fontWeight: filter === status ? '600' : '400',
              }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '16px', color: '#d1d5db' }}>Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '16px', color: '#d1d5db' }}>No conversations</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => fetchConversationDetail(conv.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #374151',
                  cursor: 'pointer',
                  backgroundColor: selectedConversation?.id === conv.id ? '#374151' : 'transparent',
                  borderLeft: selectedConversation?.id === conv.id ? '3px solid #3b82f6' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '14px' }}>
                  {conv.contacts?.name || 'Unknown'}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  {new Date(conv.updated_at).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  <span className={getStatusColor(conv.status)}>●</span>{' '}
                  <span style={{ color: '#d1d5db' }}>{conv.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px', borderBottom: '1px solid #374151', backgroundColor: '#1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: '#f3f4f6', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                  {selectedConversation.contacts?.name || 'Unknown'}
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0 0' }}>
                  {selectedConversation.contacts?.whatsapp_number || 'No phone'}
                </p>
              </div>
              <select
                value={selectedConversation.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #3b82f6',
                  backgroundColor: '#374151',
                  color: '#f3f4f6',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    maxWidth: '60%',
                    alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: msg.sender_type === 'agent' ? '#3b82f6' : '#374151',
                      color: '#f3f4f6',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div style={{ padding: '16px', borderTop: '1px solid #374151', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #374151',
                  backgroundColor: '#374151',
                  color: '#f3f4f6',
                  outline: 'none',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageInput.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: sendingMessage ? 'not-allowed' : 'pointer',
                  opacity: sendingMessage ? 0.5 : 1,
                  fontWeight: '600',
                }}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            {loading ? 'Loading...' : 'Select a conversation'}
          </div>
        )}
      </div>
    </div>
  );
}
