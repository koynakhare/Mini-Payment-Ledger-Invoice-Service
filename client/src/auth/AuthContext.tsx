import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  storeAuth,
  type StoredAuthUser,
} from './authStorage';

interface AuthContextValue {
  token: string | null;
  user: StoredAuthUser | null;
  isAuthenticated: boolean;
  isApprover: boolean;
  login: (token: string, user: StoredAuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<StoredAuthUser | null>(() => getStoredUser());

  const login = useCallback((nextToken: string, nextUser: StoredAuthUser) => {
    storeAuth(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isApprover: user?.role === 'APPROVER',
      login,
      logout,
    }),
    [token, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
