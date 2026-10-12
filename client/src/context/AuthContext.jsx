import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employer, setEmployer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load session on startup
  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setEmployer(null);
      setProfile(null);
      setLoading(false);
      return null;
    }

    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setEmployer(data.employer);
      setProfile(data.profile);
      return data.user;
    } catch (err) {
      console.warn('Session expired or invalid token', err);
      setAuthToken(null);
      setUser(null);
      setEmployer(null);
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login
  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAuthToken(data.token);
    setUser(data.user);
    setEmployer(data.employer);
    setProfile(data.profile);
    return data;
  };

  // Register Employee
  const registerEmployee = async (formData) => {
    const data = await api.post('/auth/register-employee', formData, true);
    setAuthToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    return data;
  };

  // Register Employer
  const registerEmployer = async (formData) => {
    const data = await api.post('/auth/register-employer', formData, true);
    setAuthToken(data.token);
    setUser(data.user);
    setEmployer(data.employer);
    return data;
  };

  // Logout
  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setEmployer(null);
    setProfile(null);
  };

  const value = {
    user,
    employer,
    profile,
    role: user?.role || 'guest',
    status: user?.status || 'guest',
    isApprovedEmployer: user?.role === 'employer' && user?.status === 'approved',
    isPendingEmployer: user?.role === 'employer' && user?.status === 'pending',
    isPaidEmployer: user?.role === 'employer' && employer?.payment_status === 'paid',
    // Full access requires BOTH admin approval AND the paid verification fee
    isActiveEmployer: user?.role === 'employer' && user?.status === 'approved' && employer?.payment_status === 'paid',
    needsEmployerPayment: user?.role === 'employer' && user?.status === 'approved' && employer?.payment_status !== 'paid',
    isAdmin: user?.role === 'admin',
    isEmployee: user?.role === 'employee',
    loading,
    login,
    registerEmployee,
    registerEmployer,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
