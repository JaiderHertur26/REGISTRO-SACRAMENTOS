import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Bell, Trash2, Eye, FileText, FileUp, 
    CheckCheck, Inbox, ShieldCheck, Clock,
    ArrowUpRight, AlertCircle, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// --- COMPONENTE SECUNDARIO PARA LA TARJETA ---
const NotificationCard = ({ notification, onView, onDelete }) => {
    const isUnread = notification.status === 'unread';
    const isCorrection = notification.decree_type === 'correction';

    return (
        <motion.div 
            layout 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className={cn(
                "group relative p-8 rounded-[2.5rem] border transition-all duration-300 flex flex-col md:flex-row items-center gap-6",
                isUnread ? "bg-white border-indigo-100 shadow-xl shadow-indigo-900/5 ring-1 ring-indigo-50" : "bg-gray-50/50 border-transparent opacity-80 hover:opacity-100"
            )}
        >
            <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 shadow-inner", 
                isCorrection ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                {isCorrection ? <FileText className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
            </div>

            <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mb-2">
                    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", 
                        isCorrection ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-purple-50 text-purple-700 border-purple-100")}>
                        {isCorrection ? 'Decreto ODC' : 'Decreto Reposición'}
                    </span>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />}
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                        {format(new Date(notification.createdAt), "d MMMM, yyyy", { locale: es })}
                    </span>
                </div>
                <p className={cn("text-lg font-bold tracking-tight mb-4", isUnread ? "text-gray-900" : "text-gray-500")}>
                    {notification.message}
                </p>
                
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                    <Button onClick={onView} className={cn("py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest px-8 shadow-lg transition-all active:scale-95",
                        isUnread ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}>
                        {isUnread ? 'Procesar Orden' : 'Revisar Documento'}
                    </Button>
                    <Button variant="ghost" onClick={onDelete} className="text-gray-400 hover:text-red-500 p-6 rounded-2xl">
                        <Trash2 className="w-5 h-5"/>
                    </Button>
                </div>
            </div>

            <div className="absolute top-8 right-10 text-[9px] font-black text-gray-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Ref: {notification.decree_id?.substring(0,8)}
            </div>
        </motion.div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const ParishNotificationsPage = () => {
    const { user } = useAuth();
    const { getParishNotifications, deleteNotification, updateNotificationStatus } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.parishId) {
            setIsLoading(true);
            const parishNotifs = getParishNotifications(user.parishId);
            const sortedNotifs = [...parishNotifs].sort((a, b) => {
                if (a.status === 'unread' && b.status !== 'unread') return -1;
                if (a.status !== 'unread' && b.status === 'unread') return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            setNotifications(sortedNotifs);
            setIsLoading(false);
        }
    }, [user, getParishNotifications]);

    // 🚀 SE AÑADE ASYNC A LA FUNCIÓN
    const handleViewDecree = async (notification) => {
        if (notification.status === 'unread') {
            try {
                // 🚀 SE AÑADE AWAIT PARA ASEGURAR QUE TERMINE ANTES DE CAMBIAR DE PÁGINA
                await updateNotificationStatus(notification.id, 'read');
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, status: 'read' } : n));
            } catch (error) {
                console.error("Error al marcar como leída:", error);
            }
        }
        
        const path = notification.decree_type === 'correction' 
            ? `/parroquia/decretos/ver-correcciones?highlight=${notification.decree_id}`
            : `/parroquia/decretos/reposicion?highlight=${notification.decree_id}`;
        
        navigate(path);
    };

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Comunicaciones Oficiales | Sacramentum</title></Helmet>

            <div className="max-w-5xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-900/20">
                            <Inbox className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Comunicaciones Entrantes</h1>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Bandeja de decretos emitidos por Cancillería</p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-24 text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando Archivo Central...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <NotificationCard 
                                        key={notif.id} 
                                        notification={notif} 
                                        onView={() => handleViewDecree(notif)}
                                        // 🚀 TAMBIÉN SE PROTEGE EL ELIMINAR CON ASYNC/AWAIT
                                        onDelete={async () => {
                                            try {
                                                await deleteNotification(notif.id, user.parishId);
                                                setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                                toast({ title: "Notificación removida", className: "bg-gray-900 text-white" });
                                            } catch (error) {
                                                console.error("Error al eliminar notificación:", error);
                                            }
                                        }}
                                    />
                                ))
                            ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-24 rounded-[3rem] border-2 border-dashed border-gray-100 text-center">
                                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                                        <CheckCheck className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Archivo al día</h3>
                                    <p className="text-gray-400 text-sm font-medium max-w-xs mx-auto mt-2">No hay órdenes de Cancillería pendientes por procesar.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default ParishNotificationsPage;