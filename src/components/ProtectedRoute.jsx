import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, isLoading, role } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 z-50 fixed top-0 left-0">
                <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Validando credenciales...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const userRoleNorm = String(role || '').toLowerCase().trim();
        const reqRoleNorm = String(requiredRole || '').toLowerCase().trim();

        if (userRoleNorm !== reqRoleNorm && userRoleNorm !== 'superadmin' && userRoleNorm !== 'admin') {
            return <Navigate to="/login" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;