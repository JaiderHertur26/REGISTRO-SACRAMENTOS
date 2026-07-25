import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // <-- Asegúrate de que esta ruta coincida con donde creaste el cliente
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

    // Helper para estructurar el usuario y traducir de Supabase (snake_case) a React (camelCase)
    const sanitizeUser = (u) => {
        if (!u) return null;
        return {
            ...u,
            username: u.username || '',
            role: u.role || '',

            // Mapeo crucial de IDs
            parishId: u.parish_id || u.parishId || null,
            dioceseId: u.diocese_id || u.dioceseId || null,
            chanceryId: u.chancery_id || u.chanceryId || null,

            // Nombres
            parishName: u.parish_name || u.parishName || '',
            dioceseName: u.diocese_name || u.dioceseName || '',
            chancelleryName: u.chancellery_name || u.chancelleryName || ''
        };
    };

  /* =========================
     LOAD SESSION (Mantiene sesión al recargar)
  ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser) {
            const sanitizedUser = sanitizeUser(parsedUser);
            setUser(sanitizedUser);
            logAuthEvent(sanitizedUser, 'SESSION_RESTORED');
        }
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  /* =========================
     LOGIN (¡CONECTADO A SUPABASE!)
  ========================= */
  const login = async (username, password) => {
    try {
      console.log('☁️ Consultando a Supabase para login:', username);
      const input = username.toLowerCase().trim();

      // 1. Ir a la nube y buscar coincidencia por correo o usuario
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${input},email.eq.${input}`)
        .eq('password', password)
        .single(); // Exigimos que traiga solo un resultado

      // 2. Manejo de errores o credenciales inválidas
      if (error || !data) {
        console.warn('❌ Credenciales inválidas o no encontradas en la nube');
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      // 3. ¡Éxito! Guardar en el estado local
      const sanitizedUser = sanitizeUser(data);
      setUser(sanitizedUser);
      localStorage.setItem('currentUser', JSON.stringify(sanitizedUser)); // Mantenemos caché local
      
      logAuthEvent(sanitizedUser, 'LOGIN_SUCCESS');

      return {
        success: true,
        user: sanitizedUser,
        redirectPath: getRedirectPath(sanitizedUser.role)
      };

    } catch (err) {
      console.error('🔥 Error en servidor:', err);
      return {
        success: false,
        error: err?.message || 'Error conectando con el servidor en la nube'
      };
    }
  };

  /* =========================
     LOGOUT
  ========================= */
  const logout = () => {
    if (user) {
      logAuthEvent(user, 'LOGOUT');
    }
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const isAuthenticated = () => !!user;

  /* =========================
     ROUTING BY ROLE
  ========================= */
  const getRedirectPath = (role) => {
    const roleStr = String(role || '');
    switch (roleStr) {
      case ROLE_TYPES.ADMIN_GENERAL: return '/admin/dashboard';
      case ROLE_TYPES.DIOCESE: return '/diocese/dashboard';
      case ROLE_TYPES.PARISH: return '/parish/dashboard';
      case ROLE_TYPES.CHANCERY: return '/chancery/dashboard';
      default: return '/';
    }
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    const userRole = String(user.role || '');
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return rolesArray.includes(userRole);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated, getRedirectPath, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};