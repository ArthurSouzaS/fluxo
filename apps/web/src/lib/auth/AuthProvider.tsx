'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, UserProfile } from '@fluxo/shared';
import { onSessionChange, restoreSessionOnce, setSession } from '../api/client';
import { authApi } from '../api/endpoints';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: UserProfile | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  // Dispara a restauração já na renderização (antes das consultas dos filhos).
  const [restore] = useState(() => (typeof window === 'undefined' ? null : restoreSessionOnce()));

  useEffect(() => {
    const off = onSessionChange((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
    });
    // Sessão restaurada a partir do cookie de refresh (se houve login neste navegador).
    void (restore ?? restoreSessionOnce()).then((session) => {
      if (session) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setStatus((current) => (current === 'loading' ? 'anonymous' : current));
      }
    });
    return off;
  }, [restore]);

  const login = useCallback(async (input: LoginInput) => {
    setSession(await authApi.login(input));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setSession(await authApi.register(input));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setSession(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, login, register, logout, setUser }),
    [status, user, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
