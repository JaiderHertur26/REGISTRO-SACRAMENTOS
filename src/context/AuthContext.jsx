import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 🚀 FUNCIÓN MAESTRA: Obtiene perfil y enriquece el objeto user con parish_id y parishName
    const fetchAndEnrichProfile = async (authUser) => {
        if (!authUser) return null;

        try {
            // 1. Buscar en user_profiles vinculando el nombre de la parroquia
            let { data: prof, error } = await supabase
                .from('user_profiles')
                .select('*, parishes:parish_id(id, name)')
                .or(`auth_user_id.eq.${authUser.id},id.eq.${authUser.id}`)
                .maybeSingle();

            // 2. Fallback de búsqueda por email si no coincidió por ID
            if (!prof && authUser.email) {
                const { data: emailProf } = await supabase
                    .from('user_profiles')
                    .select('*, parishes:parish_id(id, name)')
                    .eq('email', authUser.email)
                    .maybeSingle();
                prof = emailProf;
            }

            const pId = prof?.parish_id || authUser.user_metadata?.parish_id || null;
            const pName = prof?.parishes?.name || prof?.parish_name || authUser.user_metadata?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';
            const userRole = prof?.role || authUser.user_metadata?.role || 'parish';

            const enrichedUser = {
                ...authUser,
                ...prof,
                id: authUser.id,
                parishId: pId,
                parish_id: pId,
                parishName: pName?.toUpperCase(),
                parish_name: pName?.toUpperCase(),
                role: userRole
            };

            return { prof, enrichedUser };
        } catch (error) {
            console.error("Error cargando perfil de usuario:", error);
            return null;
        }
    };

    useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    const result = await fetchAndEnrichProfile(session.user);
                    
                    if (result?.enrichedUser) {
                        setUser(result.enrichedUser);
                        setProfile(result.prof);
                        setIsAuthenticated(true);
                        localStorage.setItem('sacraments_user_profile', JSON.stringify(result.prof || {}));
                        localStorage.setItem('currentUser', JSON.stringify(result.enrichedUser));
                        localStorage.setItem('user', JSON.stringify(result.enrichedUser));
                    } else {
                        setUser(session.user);
                        setIsAuthenticated(true);
                    }
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Error al inicializar sesión:", error);
                const cachedUser = localStorage.getItem('currentUser');
                if (cachedUser) {
                    const parsed = JSON.parse(cachedUser);
                    setUser(parsed);
                    setProfile(parsed);
                    setIsAuthenticated(true);
                }
            } finally {
                setIsLoading(false);
            }
        };

        initSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const result = await fetchAndEnrichProfile(session.user);
                if (result?.enrichedUser) {
                    setUser(result.enrichedUser);
                    setProfile(result.prof);
                    setIsAuthenticated(true);
                    localStorage.setItem('currentUser', JSON.stringify(result.enrichedUser));
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setIsAuthenticated(false);
                localStorage.removeItem('sacraments_user_profile');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('user');
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            const result = await fetchAndEnrichProfile(data.user);
            
            if (result?.enrichedUser) {
                setUser(result.enrichedUser);
                setProfile(result.prof);
                setIsAuthenticated(true);
                localStorage.setItem('sacraments_user_profile', JSON.stringify(result.prof || {}));
                localStorage.setItem('currentUser', JSON.stringify(result.enrichedUser));
                localStorage.setItem('user', JSON.stringify(result.enrichedUser));
                return { success: true, role: result.enrichedUser.role };
            }
            
            return { success: true, role: 'parish' };
        } catch (error) {
            return { success: false, error: "Credenciales incorrectas." };
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {}
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        localStorage.removeItem('sacraments_user_profile');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        window.location.href = '/'; 
    };

    return (
        <AuthContext.Provider value={{
            user, 
            profile, 
            isAuthenticated, 
            isLoading,
            role: user?.role || profile?.role || null,
            parishId: user?.parish_id || profile?.parish_id || null,
            parish_id: user?.parish_id || profile?.parish_id || null,
            parishName: user?.parishName || profile?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO',
            parish_name: user?.parish_name || profile?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO',
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