import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUser(session.user);
                    await loadUserProfile(session.user.id);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error comprobando sesión:", error);
                setIsLoading(false);
            }
        };

        initSession();

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

        return () => authListener.subscription.unsubscribe();
    }, []);

    const loadUserProfile = async (authUserId) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*, parishes(name)')
                .eq('auth_user_id', authUserId)
                .single();

            if (error) throw error;

            if (data) {
                setProfile(data);
                setIsAuthenticated(true);
                localStorage.setItem('sacraments_user_profile', JSON.stringify(data));
            }
        } catch (error) {
            console.warn("Buscando pase offline...");
            const cachedProfile = localStorage.getItem('sacraments_user_profile');
            if (cachedProfile) {
                setProfile(JSON.parse(cachedProfile));
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: "Credenciales incorrectas o sin conexión a internet." };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        toast({ title: "Sesión cerrada", description: "Has salido de forma segura." });
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            isAuthenticated,
            isLoading,
            role: profile?.role || null,
            parishId: profile?.parish_id || null,
            parishName: profile?.parishes?.name || 'Administración Central',
            login,
            logout
        }}>
            {isLoading ? (
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
                    <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
                    <p className="text-slate-500 font-medium uppercase tracking-widest text-sm">Verificando Credenciales...</p>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);