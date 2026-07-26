import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        // 1. INICIALIZAR SESIÓN (Soporta Offline gracias al caché interno de Supabase)
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    setUser(session.user);
                    await loadUserProfile(session.user.id);
                } else {
                    // Limpieza de seguridad si no hay sesión activa
                    localStorage.removeItem('sacraments_user_profile');
                }
            } catch (error) {
                console.error("Error comprobando sesión:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initSession();

        // 2. ESCUCHAR CAMBIOS EN TIEMPO REAL (Login/Logout)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setUser(session.user);
                await loadUserProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setIsAuthenticated(false);
                localStorage.removeItem('sacraments_user_profile');
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // 3. CARGAR PERFIL CON SOPORTE OFFLINE
    const loadUserProfile = async (authUserId) => {
        try {
            // Intentamos traer los permisos frescos desde la nube
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*, parishes(name)') // Traemos también el nombre de su parroquia
                .eq('auth_user_id', authUserId)
                .single();

            if (error) throw error;

            if (data) {
                setProfile(data);
                setIsAuthenticated(true);
                // CACHÉ OFFLINE: Guardamos el pase de acceso para cuando no haya internet
                localStorage.setItem('sacraments_user_profile', JSON.stringify(data));
            }
        } catch (error) {
            console.warn("Nube inaccesible. Activando Modo Offline de Autenticación 🛡️");
            // PLAN B: MODO OFFLINE (Buscamos la tarjeta de acceso local)
            const cachedProfile = localStorage.getItem('sacraments_user_profile');
            if (cachedProfile) {
                setProfile(JSON.parse(cachedProfile));
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false); // Si no hay caché, no puede entrar offline
            }
        }
    };

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            
            toast({ title: "Acceso concedido", description: "Bienvenido al sistema de Sacramentos." });
            return { success: true };
        } catch (error) {
            toast({ variant: "destructive", title: "Error de acceso", description: "Credenciales incorrectas o estás sin conexión en tu primer intento." });
            return { success: false, error };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        toast({ title: "Sesión cerrada", description: "Has salido del sistema de forma segura." });
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            isAuthenticated,
            isLoading,
            role: profile?.role || null, // Ej: 'SuperAdmin', 'Canciller', 'Secretaria'
            parishId: profile?.parish_id || null, // Fundamental para asociar las actas
            parishName: profile?.parishes?.name || 'Administración Central',
            login,
            logout
        }}>
            {/* Solo renderizamos la App cuando ya sabemos quién es el usuario */}
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);