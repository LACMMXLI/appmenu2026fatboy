import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../lib/api';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  points: number;
  favoriteBranchId: string | null;
  createdAt: string;
}

interface UserContextData {
  isAuthenticated: boolean;
  customer: CustomerData | null;
  token: string | null;
  points: number;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string, favoriteBranchId?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string, favoriteBranchId?: string | null) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  redeemPoints: (amount: number) => boolean;
}

const UserContext = createContext<UserContextData>({} as UserContextData);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fatboy-session-token'));
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!customer;
  const points = customer ? customer.points : 0;

  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const profile = await api.getProfile(token);
        setCustomer(profile);
      } catch {
        localStorage.removeItem('fatboy-session-token');
        setToken(null);
        setCustomer(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  const login = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginCustomer({ phone, password });
      localStorage.setItem('fatboy-session-token', res.token);
      setToken(res.token);
      setCustomer(res.customer);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, phone: string, password: string, favoriteBranchId?: string) => {
    setIsLoading(true);
    try {
      const res = await api.registerCustomer({ name, phone, password, favoriteBranchId });
      localStorage.setItem('fatboy-session-token', res.token);
      setToken(res.token);
      setCustomer(res.customer);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await api.logoutCustomer(token);
      } catch {
        // Ignorar
      }
    }
    localStorage.removeItem('fatboy-session-token');
    setToken(null);
    setCustomer(null);
  };

  const updateProfile = async (name: string, phone: string, favoriteBranchId?: string | null) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const updated = await api.updateProfile(token, { name, phone, favoriteBranchId });
      setCustomer(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      await api.changePassword(token, { oldPassword, newPassword });
    } finally {
      setIsLoading(false);
    }
  };

  const redeemPoints = (amount: number) => {
    if (points >= amount) {
      setCustomer(prev => prev ? { ...prev, points: prev.points - amount } : null);
      return true;
    }
    return false;
  };

  return (
    <UserContext.Provider value={{ isAuthenticated, customer, token, points, isLoading, login, register, logout, updateProfile, changePassword, redeemPoints }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
