import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getApiUrl } from '@/config/api';

const isDevelopment = import.meta.env.MODE === 'development';

interface AuthContextType {
  isAuthenticated: boolean;
  accountName: string | null;
  userEmail: string | null;
  userInitials: string;
  login: (token: string, accountName?: string, email?: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generar las iniciales del usuario
  const getUserInitials = (name: string | null): string => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const userInitials = getUserInitials(accountName);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('account_name');
    localStorage.removeItem('user_email');

    setIsAuthenticated(false);
    setAccountName(null);
    setUserEmail(null);

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
      localStorage.setItem('user_email', 'dev@localhost.com');

      setIsAuthenticated(true);
      setAccountName('Desarrollo Local');
      setUserEmail('dev@localhost.com');

      // Pequeño timeout para asegurar que todo se renderice correctamente
      setTimeout(() => setIsLoading(false), 50);
      return;
    }

    // En producción, verificar localStorage
    const token = localStorage.getItem('auth_token');
    const storedAccountName = localStorage.getItem('account_name');
    const storedEmail = localStorage.getItem('user_email');

    if (token) {
      // Verificar token con el backend y obtener datos actualizados
      verifyToken(token).then(result => {
        if (result.isValid) {
          setIsAuthenticated(true);
          // Usar el nombre del usuario que viene del backend o el stored como fallback
          const nameToUse = result.accountName || storedAccountName || 'Usuario';
          const emailToUse = result.email || storedEmail || 'usuario@example.com';
          setAccountName(nameToUse);
          setUserEmail(emailToUse);
          // Actualizar en localStorage si viene del backend
          if (result.accountName && result.accountName !== storedAccountName) {
            localStorage.setItem('account_name', result.accountName);
          }
          if (result.email && result.email !== storedEmail) {
            localStorage.setItem('user_email', result.email);
          }
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

  const verifyToken = async (token: string): Promise<{ isValid: boolean; accountName?: string; email?: string }> => {
    try {
      const response = await fetch(getApiUrl('/auth/verify'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isValid: true,
          accountName: data.accountName,
          email: data.email
        };
      }

      return { isValid: false };
    } catch {
      return { isValid: false };
    }
  };

  const login = (token: string, accountName?: string, email?: string) => {
    localStorage.setItem('auth_token', token);
    if (accountName) {
      localStorage.setItem('account_name', accountName);
    }
    if (email) {
      localStorage.setItem('user_email', email);
    }

    setIsAuthenticated(true);
    setAccountName(accountName || 'Usuario');
    setUserEmail(email || 'usuario@example.com');
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
      userEmail,
      userInitials,
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
