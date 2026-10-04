import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const enabled = user && (user.role === 'employee' || user.role === 'employer');

  const [conversations, setConversations] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState({ conversation: null, messages: [] });
  const [error, setError] = useState('');
  const activeRef = useRef(null);
  activeRef.current = open ? activeId : null;

  const loadConversations = useCallback(async () => {
    try {
      const d = await api.get('/chat/conversations');
      setConversations(d.conversations || []);
      setUnreadTotal(d.unread_total || 0);
    } catch (e) { /* silent: retried on next tick */ }
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const d = await api.get(`/chat/${id}/messages`);
      if (activeRef.current === id) setThread(d);
    } catch (e) {
      if (activeRef.current === id) setError(e.message);
    }
  }, []);

  // Poll conversations (also acts as the "I'm online" heartbeat)
  useEffect(() => {
    if (!enabled) {
      setConversations([]); setUnreadTotal(0); setOpen(false); setActiveId(null);
      return undefined;
    }
    loadConversations();
    const t = setInterval(loadConversations, 5000);
    return () => clearInterval(t);
  }, [enabled, loadConversations]);

  // Poll open thread faster
  useEffect(() => {
    if (!open || !activeId) return undefined;
    setError('');
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), 3000);
    return () => clearInterval(t);
  }, [open, activeId, loadThread]);

  const openChat = useCallback((appId = null) => {
    setError('');
    setThread({ conversation: null, messages: [] });
    setActiveId(appId ? Number(appId) : null);
    setOpen(true);
  }, []);
  const closeChat = useCallback(() => setOpen(false), []);
  const backToList = useCallback(() => { setActiveId(null); loadConversations(); }, [loadConversations]);

  const send = useCallback(async (body) => {
    const id = activeRef.current;
    if (!id) return;
    try {
      setError('');
      await api.post(`/chat/${id}/messages`, { body });
      await Promise.all([loadThread(id), loadConversations()]);
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, [loadThread, loadConversations]);

  const value = {
    enabled, conversations, unreadTotal, open, activeId, thread, error,
    openChat, closeChat, backToList, send,
    selectConversation: (id) => { setThread({ conversation: null, messages: [] }); setActiveId(id); },
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const c = useContext(ChatContext);
  if (!c) throw new Error('useChat must be used within ChatProvider');
  return c;
}
