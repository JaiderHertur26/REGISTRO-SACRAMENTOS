import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const MatrimonialNotificationPage = () => {
    const { user } = useAuth();

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <Mail className="w-10 h-10 text-gray-400" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 font-serif mb-2">Notificación Matrimonial</h1>
                <p className="text-gray-500 text-lg mb-8 max-w-md">
                    En espera de modificación
                </p>
                <div className="p-4 bg-blue-50 text-blue-800 text-sm rounded-md border border-blue-200 max-w-lg">
                    Esta funcionalidad permitirá gestionar las notificaciones relacionadas con expedientes matrimoniales.
                </div>
            </div>
        </DashboardLayout>
    );
};

export default MatrimonialNotificationPage;