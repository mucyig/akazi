import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unseenResults, setUnseenResults] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    }
  }, [user]);

  // How many application results (interview invitation or decision) the candidate has not opened yet
  const fetchUnseenResults = useCallback(async () => {
    if (!user || user.role !== 'employee') { setUnseenResults(0); return; }
    try {
      const data = await api.get('/applications/unseen-count');
      setUnseenResults(data.count || 0);
    } catch { /* retried on the next tick */ }
  }, [user]);

  const markResultsSeen = useCallback(async () => {
    try {
      await api.post('/applications/mark-seen', {});
      setUnseenResults(0);
    } catch { /* the dot will clear on the next successful call */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnseenResults();
    const tick = () => { if (document.visibilityState === 'visible') { fetchNotifications(); fetchUnseenResults(); } };
    const interval = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [fetchNotifications, fetchUnseenResults]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        unseenResults,
        fetchUnseenResults,
        markResultsSeen,
        markAsRead,
        markAllAsRead,
        loading
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
