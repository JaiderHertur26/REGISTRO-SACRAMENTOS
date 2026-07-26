import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
                setIsLoading(false);
            }
        };
        initSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
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
                .select('*')
                .eq('auth_user_id', authUserId)
                .single();

            if (data) {
                setProfile(data);
                setIsAuthenticated(true);
                localStorage.setItem('sacraments_user_profile', JSON.stringify(data));
            }
        } catch (error) {
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
            
            const { data: prof } = await supabase.from('user_profiles').select('*').eq('auth_user_id', data.user.id).single();
            
            if(prof) {
                setProfile(prof);
                setIsAuthenticated(true);
                localStorage.setItem('sacraments_user_profile', JSON.stringify(prof));
                return { success: true, role: prof.role };
            }
            return { success: true, role: 'unknown' };
        } catch (error) {
            return { success: false, error: "Credenciales incorrectas." };
        }
    };

    // 🚀 FIX: Ahora cierra sesión y te lleva a la pantalla PÚBLICA PRINCIPAL (PublicSearchPage)
    const logout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; 
    };

    return (
        <AuthContext.Provider value={{
            user, profile, isAuthenticated, isLoading,
            role: profile?.role || null,
            parishId: profile?.parish_id || null,
            login, logout
        }}>
            {isLoading ? (
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 z-50 fixed top-0 left-0">
                    <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
                    <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Abriendo Bóveda Segura...</p>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);