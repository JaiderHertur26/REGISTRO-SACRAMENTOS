import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    AlertTriangle, ShieldAlert, Clock, 
    ArrowRight, MessageSquareWarning, SearchX 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const NotificationWarningPage = () => {
    const { user } = useAuth();

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center p-12">
                
                <div className="relative mb-8">
                    <div className="w-24 h-24 bg-amber-50 rounded-[2rem] flex items-center justify-center border border-amber-100 shadow-inner animate-pulse">
                        <ShieldAlert className="w-12 h-12 text-amber-500" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg border border-gray-100">
                        <MessageSquareWarning className="w-5 h-5 text-red-500" />
                    </div>
                </div>

                <h1 className="text-4xl font-black text-gray-900 font-serif tracking-tight mb-4">Módulo de Alertas</h1>
                <p className="text-gray-500 text-lg font-medium leading-relaxed max-w-xl mb-10">
                    Este panel centraliza las inconsistencias detectadas en el cruce de notificaciones matrimoniales recibidas de otras parroquias.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl text-left">
                    <AlertCard 
                        icon={Clock} 
                        title="Pendientes de Asentamiento" 
                        desc="Avisos recibidos que aún no han sido colocados como nota marginal en el libro original."
                    />
                    <AlertCard 
                        icon={SearchX} 
                        title="Registros no Localizados" 
                        desc="Notificaciones que llegaron a esta parroquia pero cuyos titulares no figuran en la base digital."
                    />
                </div>

                <div className="mt-12 p-5 bg-[#4B7BA7]/5 rounded-3xl border border-[#4B7BA7]/10 flex items-center gap-4">
                    <div className="p-2 bg-[#4B7BA7] rounded-xl text-white"><AlertTriangle className="w-4 h-4"/></div>
                    <span className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Estado: En espera de integración con el Servidor Central</span>
                </div>
            </div>
        </DashboardLayout>
    );
};

const AlertCard = ({ icon: Icon, title, desc }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all group">
        <div className="bg-gray-50 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
        </div>
        <h4 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-2">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed font-medium">{desc}</p>
    </div>
);

export default NotificationWarningPage;