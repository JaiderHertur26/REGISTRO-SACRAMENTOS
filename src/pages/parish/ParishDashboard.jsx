import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { 
    Church, ScrollText, Users, Activity, Plus, 
    Download, AlertCircle, Clock, CheckCircle2, 
    Loader2, RefreshCcw, Landmark, FileStack, 
    ChevronRight, Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const ParishDashboard = () => {
  const { createUniversalBackup } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [recentRecords, setRecentRecords] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [stats, setStats] = useState({ baptisms: 0, confirmations: 0, marriages: 0, total: 0 });
  const [hasPending, setHasPending] = useState(false);
  
  const currentParishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
  const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

  const parseSortDate = (dateStr) => {
    if (!dateStr) return 0;
    const str = String(dateStr);
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(str.split('T')[0]).getTime() || 0;
    if (str.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        const [d, m, y] = str.split('/');
        return new Date(`${y}-${m}-${d}`).getTime() || 0;
    }
    return new Date(str).getTime() || 0;
  };

  // 🚀 CONSULTA PARALELA BLINDADA CONTRA NULOS
  const updateDashboardData = useCallback(async () => {
    if (!currentParishId) {
        setIsSyncing(false);
        return;
    }
    setIsSyncing(true);

    try {
        const [bRes, cRes, mRes, bPendingRes] = await Promise.all([
            supabase.from('baptisms').select('id, raw_data, status, created_at').eq('parish_id', currentParishId),
            supabase.from('confirmations').select('id, raw_data, status, created_at').eq('parish_id', currentParishId),
            supabase.from('marriages').select('id, raw_data, status, created_at').eq('parish_id', currentParishId),
            supabase.from('pending_baptisms').select('id, raw_data, created_at').eq('parish_id', currentParishId)
        ]);
        
        // Protecciones contra null
        const bData = bRes.data || [];
        const cData = cRes.data || [];
        const mData = mRes.data || [];
        const bPendingData = bPendingRes.data || [];

        const bSeated = bData.map(r => {
            const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
            return { ...raw, id: r.id, status: r.status, createdAt: r.created_at };
        });

        const cSeated = cData.map(r => {
            const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
            return { ...raw, id: r.id, status: r.status, createdAt: r.created_at };
        });

        const mSeated = mData.map(r => {
            const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
            return { ...raw, id: r.id, status: r.status, createdAt: r.created_at };
        });

        const bPending = bPendingData.map(r => {
            const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
            return { ...raw, id: r.id, status: 'pending', createdAt: r.created_at };
        });

        setStats({
          baptisms: bSeated.length,
          confirmations: cSeated.length,
          marriages: mSeated.length,
          total: bSeated.length + cSeated.length + mSeated.length
        });

        setHasPending(bPending.length > 0);

        const mapRecord = (r, type, label, isPending) => {
            if (!r) return null;
            let nombres = r.firstName || r.nombres;
            let apellidos = r.lastName || r.apellidos;

            if (type === 'marriage') {
                nombres = r.husbandName || r.nombres_esposo || '---';
                apellidos = r.husbandSurname || r.apellidos_esposo || '';
            }

            return {
                id: r.id,
                nombres: (nombres || 'SIN NOMBRE').toUpperCase(),
                apellidos: (apellidos || '').toUpperCase(),
                sacramento: label,
                fecha: r.sacramentDate || r.fechaSacramento || r.fecha || 'SIN FECHA',
                isPending: isPending,
                sortDate: parseSortDate(r.sacramentDate || r.fechaSacramento || r.createdAt)
            };
        };

        const allRecords = [
            ...bPending.map(r => mapRecord(r, 'baptism', 'Bautismo', true)),
            ...bSeated.map(r => mapRecord(r, 'baptism', 'Bautismo', false)),
            ...cSeated.map(r => mapRecord(r, 'confirmation', 'Confirmación', false)),
            ...mSeated.map(r => mapRecord(r, 'marriage', 'Matrimonio', false))
        ].filter(Boolean);

        allRecords.sort((a, b) => {
            if (a.isPending && !b.isPending) return -1;
            if (!a.isPending && b.isPending) return 1;
            return b.sortDate - a.sortDate;
        });

        setRecentRecords(allRecords.slice(0, 10));
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    } finally {
        setIsSyncing(false);
    }
  }, [currentParishId]);

  useEffect(() => {
    updateDashboardData();
    window.addEventListener('storage', updateDashboardData);
    return () => window.removeEventListener('storage', updateDashboardData);
  }, [updateDashboardData]);

  const statsCards = [
    { label: 'Bautizos', value: stats.baptisms, icon: Church, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Confirmaciones', value: stats.confirmations, icon: ScrollText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Matrimonios', value: stats.marriages, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Total Libros', value: stats.total, icon: FileStack, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const columns = [
    { 
        header: 'Titular', 
        render: (row) => (
            <div className="flex flex-col">
                <span className="font-black text-gray-900 text-xs tracking-tight">{row.nombres}</span>
                <span className="font-bold text-gray-400 text-[10px] uppercase tracking-tighter">{row.apellidos}</span>
            </div>
        )
    },
    { 
        header: 'Sacramento', 
        render: (row) => (
            <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                row.sacramento === 'Bautismo' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                row.sacramento === 'Confirmación' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                'bg-pink-50 text-pink-700 border-pink-100'
            )}>
                {row.sacramento}
            </span>
        )
    },
    { 
        header: 'Fecha', 
        render: (row) => <span className="font-mono text-[11px] font-bold text-gray-500">{row.fecha}</span> 
    },
    { 
      header: 'Estado', 
      render: (row) => (
        <div className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
            row.isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'
        )}>
            {row.isPending ? <><Clock className="w-3 h-3 mr-1.5" />Borrador</> : <><CheckCircle2 className="w-3 h-3 mr-1.5" />Asentado</>}
        </div>
      ) 
    }
  ];

  return (
    <DashboardLayout entityName={nombreParroquia}>
      <div className="max-w-7xl mx-auto pb-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                    <Landmark className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Consola de Administración</span>
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif">Panel Parroquial</h1>
                <div className="flex items-center gap-3 mt-3">
                    <p className="text-gray-500 font-bold uppercase text-[11px] tracking-widest">
                        {nombreParroquia}
                    </p>
                    {hasPending && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 shadow-sm">
                            <AlertCircle className="w-3 h-3 animate-pulse" />
                            <span className="text-[9px] font-black uppercase">Existen borradores pendientes</span>
                        </motion.div>
                    )}
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={updateDashboardData} disabled={isSyncing} className="h-12 px-6 rounded-2xl border-gray-200 hover:bg-gray-50 group">
                    <RefreshCcw className={cn("w-4 h-4 mr-2 text-gray-400 group-hover:rotate-180 transition-transform duration-500", isSyncing && "animate-spin")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronizar</span>
                </Button>
                <Button variant="outline" onClick={() => createUniversalBackup && createUniversalBackup("Backup_Manual")} className="h-12 px-6 rounded-2xl border-gray-200 hover:bg-gray-50">
                    <Download className="w-4 h-4 mr-2 text-[#4B7BA7]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">Exportar Backup</span>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {statsCards.map((stat, idx) => (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                    key={idx} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all group overflow-hidden relative"
                >
                    <div className={cn("absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform", stat.color)}><stat.icon className="w-32 h-32" /></div>
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-gray-900 tracking-tighter">
                            {isSyncing ? <Loader2 className="w-6 h-6 animate-spin text-gray-300" /> : stat.value}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{stat.label}</p>
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" /> Accesos Inmediatos
                    </h2>
                    <div className="flex flex-col gap-4">
                        <QuickActionButton color="bg-[#D4AF37]" label="Inscribir Bautismo" onClick={() => navigate('/parroquia/bautismo/nuevo')} />
                        <QuickActionButton color="bg-purple-600" label="Nueva Confirmación" onClick={() => navigate('/parroquia/confirmacion/nuevo')} />
                        <QuickActionButton color="bg-pink-600" label="Registro Matrimonial" onClick={() => navigate('/parroquia/matrimonio/nuevo')} />
                    </div>
                </div>

                <div className="bg-[#4B7BA7] rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Activity className="w-24 h-24" /></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-2 opacity-70">Soporte Técnico</h3>
                    <p className="text-sm font-bold leading-relaxed">¿Necesitas ayuda con un decreto o una anulación?</p>
                    <Button variant="link" className="text-white p-0 h-auto mt-4 font-black uppercase tracking-widest text-[10px] hover:no-underline opacity-80 hover:opacity-100">
                        Contactar Cancillería <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
                    <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Actividad Reciente</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Últimos registros procesados en la nube</p>
                        </div>
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/sentar-registros')} className="text-[10px] font-black uppercase tracking-widest text-[#4B7BA7]">Sentar Borradores</Button>
                    </div>
                    
                    <div className="p-4 flex-1">
                        {isSyncing ? (
                            <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-gray-200 mx-auto" /></div>
                        ) : recentRecords.length === 0 ? (
                            <div className="py-24 text-center">
                                <Activity className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                                <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Sin movimientos registrados</p>
                            </div>
                        ) : (
                            <Table columns={columns} data={recentRecords} className="border-none shadow-none" />
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const QuickActionButton = ({ color, label, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-5 rounded-2xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg hover:shadow-gray-200/50 transition-all group"
    >
        <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">{label}</span>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:translate-x-1", color)}>
            <Plus className="w-4 h-4" />
        </div>
    </button>
);

export default ParishDashboard;