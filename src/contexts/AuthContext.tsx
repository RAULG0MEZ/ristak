import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getApiUrl } from '@/config/api';

const isDevelopment = import.meta.env.MODE === 'development';

interface AuthContextType {
  isAuthenticated: boolean;
  accountName: string | null;
  login: (token: string, accountName?: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('account_name');

    setIsAuthenticated(false);
    setAccountName(null);

    // Solo redirigir a login en producción
    if (!isDevelopment && window.location.hostname !== 'localhost') {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    // En desarrollo, siempre autenticado con valores por defecto - INMEDIATAMENTE
    if (isDevelopment || window.location.hostname === 'localhost') {
      // Guardar token de desarrollo para que las llamadas API funcionen
      localStorage.setItem('auth_token', 'dev-token');
      localStorage.setItem('account_name', 'Desarrollo Local');

      setIsAuthenticated(true);
      setAccountName('Desarrollo Local');

      // Pequeño timeout para asegurar que todo se renderice correctamente
      setTimeout(() => setIsLoading(false), 50);
      return;
    }

    // En producción, verificar localStorage
    const token = localStorage.getItem('auth_token');
    const storedAccountName = localStorage.getItem('account_name');

    if (token) {
      // Verificar token con el backend (opcional)
      verifyToken(token).then(isValid => {
        if (isValid) {
          setIsAuthenticated(true);
          setAccountName(storedAccountName || 'Usuario');
        } else {
          // Token inválido, limpiar y redirigir a login
          logout();
        }
        setIsLoading(false);
      });
    } else {
      // No hay sesión, redirigir a login si no estamos ya ahí
      if (location.pathname !== '/login') {
        navigate('/login');
      }
      setIsLoading(false);
    }
  }, [navigate, location.pathname, logout]);

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(getApiUrl('/auth/verify'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const login = (token: string, accountName?: string) => {
    localStorage.setItem('auth_token', token);
    if (accountName) {
      localStorage.setItem('account_name', accountName);
    }

    setIsAuthenticated(true);
    setAccountName(accountName || 'Usuario');
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:unauthorized', handleUnauthorized);
      }
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      accountName,
      login,
      logout,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
