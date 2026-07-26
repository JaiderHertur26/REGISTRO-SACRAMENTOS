import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, isLoading, profile } = useAuth();
    const [isTimeout, setIsTimeout] = useState(false);

    // 🛡️ ESCUDO ANTI-CONGELAMIENTO: 
    // Si la nube está lenta o arroja errores 404 de tablas faltantes, 
    // forzamos el desbloqueo de la pantalla tras 3 segundos.
    useEffect(() => {
        let timer;
        if (isLoading) {
            timer = setTimeout(() => setIsTimeout(true), 3000); // 3 segundos máximo
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    // PANTALLA DE CARGA (Con límite de tiempo)
    if (isLoading && !isTimeout) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 z-50 fixed top-0 left-0">
                <ShieldCheck className="w-16 h-16 text-[#D4AF37] animate-pulse mb-4" />
                <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">
                    Sincronizando entorno seguro...
                </p>
                <Loader2 className="w-6 h-6 text-[#4B7BA7] animate-spin mt-4" />
            </div>
        );
    }

    // 1. FILTRO: Si no está logueado, se va al login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // 2. FILTRO DE ROLES
    if (requiredRole && profile?.role !== requiredRole) {
        // Si el usuario es 'SuperAdmin', tiene PASE VIP y entra a donde sea ignorando el requiredRole
        if (profile?.role === 'SuperAdmin') {
            return children;
        }
        // Si no es SuperAdmin y su rol no coincide, se devuelve al login
        return <Navigate to="/login" replace />;
    }

    // Si pasó todos los filtros, mostramos la pantalla
    return children;
};

export default ProtectedRoute;