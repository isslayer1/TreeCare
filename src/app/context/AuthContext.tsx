import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'verified' | 'unverified' | 'suspended' | string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, confirmPassword: string) => Promise<void>;
  signOut: () => void;
}

const TOKEN_KEY = 'treecare.auth.token';
const USER_KEY = 'treecare.auth.user';

export const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  '/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const persistSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const parseError = async (response: Response, fallback: string): Promise<{ message: string; code?: string }> => {
  const body = await response.json().catch(() => null);
  const message = typeof body?.error === 'string' ? body.error : fallback;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  return { message, code };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          clearSession();
          setUser(null);
          setIsAuthLoading(false);
          return;
        }

        const currentUser = (await response.json()) as AuthUser;
        setUser(currentUser);
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrap();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const { message, code } = await parseError(response, 'Unable to sign in');
      throw new ApiError(message, code);
    }

    const payload = await response.json() as { token: string; user: AuthUser };
    persistSession(payload.token, payload.user);
    setUser(payload.user);
  };

  const signUp = async (email: string, password: string, confirmPassword: string): Promise<void> => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const { message, code } = await parseError(response, 'Unable to create account');
      throw new ApiError(message, code);
    }

    const payload = await response.json() as { token: string; user: AuthUser };
    persistSession(payload.token, payload.user);
    setUser(payload.user);
  };

  const signOut = () => {
    clearSession();
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isAuthLoading,
    signIn,
    signUp,
    signOut,
  }), [user, isAuthLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
