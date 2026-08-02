import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken } from '@/src/api/client';

type User = { id: string; email: string; name: string; role: string; business_name?: string } | null;
type Ctx = {
  user: User;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; name: string; business_name?: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (t) {
          const me = await api('/auth/me');
          setUser(me);
        }
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // ensure seed exists (no-op if already seeded)
    try { await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/seed`, { method: 'POST' }); } catch {}
    const res = await api<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setToken(res.access_token);
    setUser(res.user);
  }, []);

  const signUp = useCallback(async (data: { email: string; password: string; name: string; business_name?: string }) => {
    const res = await api<{ access_token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await setToken(res.access_token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
