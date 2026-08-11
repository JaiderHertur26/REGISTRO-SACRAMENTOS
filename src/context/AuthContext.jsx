import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const enrichUserProfile = async (authUser) => {
        if (!authUser) return null;

        try {
            let prof = null;

            const { data: byAuthId } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('auth_user_id', authUser.id)
                .maybeSingle();
            prof = byAuthId;

            if (!prof) {
                const { data: byId } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', authUser.id)
                    .maybeSingle();
                prof = byId;
            }

            if (!prof && authUser.email) {
                const { data: byEmail } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('email', authUser.email)
                    .maybeSingle();
                prof = byEmail;
            }

            const pId = prof?.parish_id || authUser.user_metadata?.parish_id || 'ae48c502-6603-4887-ba38-6886e628430e';
            let pName = 'PARROQUIA PADRE MISERICORDIOSO';

            if (pId) {
                try {
                    const { data: pData } = await supabase
                        .from('parishes')
                        .select('name')
                        .eq('id', pId)
                        .maybeSingle();
                    if (pData?.name) pName = pData.name.toUpperCase();
                } catch (e) {}
            }

            const rawRole = prof?.role || authUser.user_metadata?.role || 'parish';

            const enrichedUser = {
                ...authUser,
                ...prof,
                id: authUser.id,
                parishId: pId,
                parish_id: pId,
                parishName: pName,
                parish_name: pName,
                role: rawRole
            };

            return { prof: prof || {}, enrichedUser };
        } catch (error) {
            console.error("Error en enrichUserProfile:", error);
            const fallbackUser = {
                ...authUser,
                parishId: 'ae48c502-6603-4887-ba38-6886e628430e',
                parish_id: 'ae48c502-6603-4887-ba38-6886e628430e',
                parishName: 'PARROQUIA PADRE MISERICORDIOSO',
                parish_name: 'PARROQUIA PADRE MISERICORDIOSO',
                role: 'parish'
            };
            return { prof: fallbackUser, enrichedUser: fallbackUser };
        }
    };

    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user && isMounted) {
                    const result = await enrichUserProfile(session.user);
                    if (result?.enrichedUser && isMounted) {
                        setUser(result.enrichedUser);
                        setProfile(result.prof);
                        setIsAuthenticated(true);
                        localStorage.setItem('sacraments_user_profile', JSON.stringify(result.prof || {}));
                        localStorage.setItem('currentUser', JSON.stringify(result.enrichedUser));
                    }
                } else if (isMounted) {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Error inicializando sesión:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        initSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const result = await enrichUserProfile(session.user);
                if (result?.enrichedUser && isMounted) {
                    setUser(result.enrichedUser);
                    setProfile(result.prof);
                    setIsAuthenticated(true);
                    localStorage.setItem('currentUser', JSON.stringify(result.enrichedUser));
                }
            } else if (event === 'SIGNED_OUT') {
                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                    setIsAuthenticated(false);
                    localStorage.removeItem('sacraments_user_profile');
                    localStorage.removeItem('currentUser');
                }
            }
        });

        return () => {
            isMounted = false;
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            const result = await enrichUserProfile(data.user);
            if (result?.enrichedUser) {
                setUser(result.enrichedUser);
                setProfile(result.prof);
                setIsAuthenticated(true);
                return { success: true, role: result.enrichedUser.role };
            }
            return { success: true, role: 'parish' };
        } catch (error) {
            return { success: false, error: "Credenciales incorrectas." };
        }
    };

    const logout = async () => {
        try { await supabase.auth.signOut(); } catch (e) {}
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        localStorage.removeItem('sacraments_user_profile');
        localStorage.removeItem('currentUser');
        window.location.href = '/'; 
    };

    return (
        <AuthContext.Provider value={{
            user, 
            profile, 
            isAuthenticated, 
            isLoading,
            role: user?.role || profile?.role || 'parish',
            parishId: user?.parish_id || profile?.parish_id || 'ae48c502-6603-4887-ba38-6886e628430e',
            parish_id: user?.parish_id || profile?.parish_id || 'ae48c502-6603-4887-ba38-6886e628430e',
            parishName: user?.parishName || 'PARROQUIA PADRE MISERICORDIOSO',
            parish_name: user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO',
            login, 
            logout
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