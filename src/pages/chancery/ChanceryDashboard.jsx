import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { 
    ScrollText, Mail, LayoutDashboard, Database, 
    AlertCircle, FileCheck, CheckCircle, Download, 
    FileText, Settings, Building, MapPin, Phone, 
    Info, Loader2, ShieldCheck,
    Zap, FileStack, ChevronRight, AtSign
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateBackup } from '@/lib/backupHelpers';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

const ChanceryDashboard = () => {
    const { 
        data, getMisDatosList, 
        updateMisDatosRecord, addMisDatosRecord,
        getBaptisms, getConfirmations, getMatrimonios
    } = useAppData();
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [globalCorrectionsCount, setGlobalCorrectionsCount] = useState(0);
    const [globalReplacementsCount, setGlobalReplacementsCount] = useState(0);

    const [misDatosForm, setMisDatosForm] = useState({
        id: null,
        nombreCancilleria: '',
        canciller: '',
        cargo: 'Canciller Diocesano',
        direccion: '',
        ciudad: '',
        telefono: '',
        email: ''
    });

    useEffect(() => {
        if (!user?.chanceryId) return;
        const records = getMisDatosList(user.chanceryId);
        if (records?.length > 0) {
            const d = records[0];
            setMisDatosForm({
                id: d.id,
                nombreCancilleria: d.nombreCancilleria || d.nombre || user.chancelleryName || '',
                canciller: d.canciller || d.parroco || '', 
                cargo: d.cargo || 'Canciller Diocesano',
                direccion: d.direccion || '',
                ciudad: d.ciudad || '',
                telefono: d.telefono || '',
                email: d.email || ''
            });
        }
    }, [user, isSettingsOpen, getMisDatosList]);

    useEffect(() => {
        const fetchGlobalDecreesStats = async () => {
            let targetDioceseId = user?.dioceseId || user?.diocese_id;
            
            if (!targetDioceseId && user?.chancery_id) {
                 const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', user.chancery_id).single();
                 if (chanData) targetDioceseId = chanData.diocese_id;
            }

            if (!targetDioceseId) return;

            try {
                const { data: parishesData } = await supabase
                    .from('parishes')
                    .select('id')
                    .eq('diocese_id', targetDioceseId);

                const parishIds = parishesData ? parishesData.map(p => p.id) : [];

                if (parishIds.length === 0) return;

                const { count: correctionsCount, error: corrError } = await supabase
                    .from('decretos')
                    .select('*', { count: 'exact', head: true })
                    .eq('tipo', 'correccion')
                    .in('parish_id', parishIds);

                if (!corrError) setGlobalCorrectionsCount(correctionsCount || 0);

                const { count: replacementsCount, error: repError } = await supabase
                    .from('decretos')
                    .select('*', { count: 'exact', head: true })
                    .eq('tipo', 'reposicion')
                    .in('parish_id', parishIds);

                if (!repError) setGlobalReplacementsCount(replacementsCount || 0);

            } catch (error) {
                console.error("Error cargando estadísticas globales de decretos:", error);
            }
        };

        fetchGlobalDecreesStats();
    }, [user]);

    const dioceseStats = useMemo(() => {
        const parishes = data.parishes.filter(p => p.dioceseId === user?.dioceseId);
        
        let allSacraments = [];

        parishes.forEach(p => {
            const baptisms = (getBaptisms(p.id) || []).map(b => ({ ...b, type: 'Bautismo' }));
            const confirmations = (getConfirmations(p.id) || []).map(c => ({ ...c, type: 'Confirmación' }));
            const marriages = (getMatrimonios(p.id) || []).map(m => ({ ...m, type: 'Matrimonio' }));

            allSacraments = [...allSacraments, ...baptisms, ...confirmations, ...marriages];
        });

        const pending = allSacraments.filter(s => s.status === 'pending');

        return {
            pendingCount: pending.length,
            communicationsCount: data.communications?.length || 0,
            pendingSacraments: pending
        };
    }, [data.parishes, data.communications, user?.dioceseId, getBaptisms, getConfirmations, getMatrimonios]);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const payload = {
                ...misDatosForm,
                nombre: misDatosForm.nombreCancilleria.toUpperCase(),
                parroco: misDatosForm.canciller.toUpperCase(),
                cargo: misDatosForm.cargo.toUpperCase(),
                ciudad: misDatosForm.ciudad.toUpperCase()
            };

            const res = misDatosForm.id 
                ? await updateMisDatosRecord(misDatosForm.id, payload, user.chanceryId)
                : await addMisDatosRecord(payload, user.chanceryId);

            if (res.success) {
                toast({ title: "Identidad Sincronizada", description: "Los membretes de los decretos han sido actualizados.", className: "bg-green-50 text-green-900 border-green-200" });
                setIsSettingsOpen(false);
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const statsCards = [
        { label: 'Pendientes', value: dioceseStats.pendingCount, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Comunicaciones', value: dioceseStats.communicationsCount, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'D. Corrección', value: globalCorrectionsCount, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'D. Reposición', value: globalReplacementsCount, icon: ScrollText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    const columns = [
      { header: 'Nombres', render: (row) => <span className="font-bold text-gray-900">{row.nombres || row.firstName || (row.esposo ? row.esposo.nombres : '---')}</span> },
      { header: 'Apellidos', render: (row) => <span className="font-bold text-gray-700">{row.apellidos || row.lastName || (row.esposo ? row.esposo.apellidos : '---')}</span> },
      { header: 'Tipo', render: (row) => <span className="font-black text-[10px] uppercase tracking-widest text-[#4B7BA7] bg-blue-50 px-3 py-1 rounded-full">{row.type}</span> },
      { header: 'Fecha', render: (row) => <span className="text-gray-500 text-xs font-bold">{row.fechaSacramento || row.sacramentDate || row.fechaMatrimonio || '---'}</span> },
      { header: 'Acción', render: () => <Button size="sm" variant="outline" className="text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-[#4B7BA7]" onClick={() => navigate('/chancery/pending')}>Revisar</Button> }
    ];

    return (
        <DashboardLayout entityName={`Cancillería • ${user?.dioceseName}`}>
            <div className="max-w-7xl mx-auto pb-20">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Mando Superior Diocesano</span>
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif">Panel de Cancillería</h1>
                        <p className="text-gray-500 font-bold uppercase text-[11px] tracking-widest mt-2">Fiscalización y Emisión de Decretos</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="h-14 px-8 rounded-2xl border-gray-200 hover:bg-white hover:shadow-lg transition-all">
                            <Settings className="w-4 h-4 mr-2 text-[#4B7BA7]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Configurar Membrete</span>
                        </Button>
                        <Button variant="outline" onClick={() => generateBackup(data, user)} className="h-14 px-8 rounded-2xl border-gray-200 hover:bg-white hover:shadow-lg transition-all">
                            <Download className="w-4 h-4 mr-2 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Backup Diocesano</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-900/10"><Zap className="w-5 h-5"/></div>
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Protocolos de Actuación</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <ChanceryActionButton label="Revisar Sacramentos Pendientes" icon={AlertCircle} color="bg-orange-500" onClick={() => navigate('/chancery/pending')} />
                            <ChanceryActionButton label="Emitir Certificación Oficial" icon={FileCheck} color="bg-[#4B7BA7]" onClick={() => navigate('/chancery/certifications')} />
                            <ChanceryActionButton label="Bandeja de Comunicaciones" icon={Mail} color="bg-slate-700" onClick={() => navigate('/communications')} />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-amber-500 p-2 rounded-xl text-white shadow-lg shadow-amber-900/10"><FileStack className="w-5 h-5"/></div>
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Archivo Histórico de Decretos</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <button 
                                onClick={() => navigate('/chancery/decretos/correcciones')}
                                className="p-8 rounded-[2rem] bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-all text-center group"
                            >
                                <div className="text-3xl font-black text-purple-700 group-hover:scale-110 transition-transform">{globalCorrectionsCount}</div>
                                <div className="text-[9px] font-black text-purple-600 uppercase tracking-[0.2em] mt-2">Correcciones</div>
                            </button>
                            <button 
                                onClick={() => navigate('/chancery/decretos/reposiciones')}
                                className="p-8 rounded-[2rem] bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all text-center group"
                            >
                                <div className="text-3xl font-black text-emerald-700 group-hover:scale-110 transition-transform">{globalReplacementsCount}</div>
                                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-2">Reposiciones</div>
                            </button>
                        </div>
                        <Button 
                            variant="ghost" 
                            className="w-full mt-6 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] text-[#4B7BA7]"
                            onClick={() => navigate('/chancery/decree-annulment')}
                        >
                            Gestionar Catálogo de Causas <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Actas en Espera de Validación</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Últimas 5 solicitudes de revisión</p>
                        </div>
                        <Button variant="link" onClick={() => navigate('/chancery/pending')} className="text-[#4B7BA7] font-black uppercase tracking-widest text-[10px]">Ver todo el archivo</Button>
                    </div>
                    <div className="p-4">
                        {dioceseStats.pendingCount > 0 ? (
                            <Table columns={columns} data={dioceseStats.pendingSacraments.slice(-5)} className="border-none shadow-none" />
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <CheckCircle className="w-12 h-12 text-green-200 mx-auto" />
                                <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">No existen actas pendientes de fiscalización</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Configuración de Identidad Legal">
                <form onSubmit={handleSaveSettings} className="p-4 space-y-8 max-w-2xl">
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex gap-4">
                        <Info className="w-6 h-6 text-blue-500 shrink-0" />
                        <p className="text-[11px] text-blue-700 font-medium leading-relaxed uppercase">
                            Esta información constituye la **Identidad Oficial** de la Cancillería. Se utilizará para generar automáticamente los encabezados y pies de página en todos los Decretos emitidos.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre de la Oficina</label>
                            <div className="relative group">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                                <Input required value={misDatosForm.nombreCancilleria} onChange={e => setMisDatosForm({...misDatosForm, nombreCancilleria: e.target.value})} className="pl-12 py-6 font-bold" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Canciller Responsable</label>
                            <Input required value={misDatosForm.canciller} onChange={e => setMisDatosForm({...misDatosForm, canciller: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cargo Institucional</label>
                            <Input required value={misDatosForm.cargo} onChange={e => setMisDatosForm({...misDatosForm, cargo: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección de Sede</label>
                            <Input value={misDatosForm.direccion} onChange={e => setMisDatosForm({...misDatosForm, direccion: e.target.value})} className="py-6" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ciudad / Sede</label>
                            <Input value={misDatosForm.ciudad} onChange={e => setMisDatosForm({...misDatosForm, ciudad: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                            <Input value={misDatosForm.telefono} onChange={e => setMisDatosForm({...misDatosForm, telefono: e.target.value})} className="py-6 font-mono" />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Correo Electrónico Oficial</label>
                            <div className="relative group">
                                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                                <Input type="email" value={misDatosForm.email} onChange={e => setMisDatosForm({...misDatosForm, email: e.target.value})} className="pl-12 py-6 font-mono lowercase" placeholder="ejemplo@arquidiocesis.org" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <Button type="button" variant="ghost" onClick={() => setIsSettingsOpen(false)} className="px-8 font-black uppercase text-[10px]">Cancelar</Button>
                        <Button type="submit" disabled={isSaving} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95">
                            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : 'Guardar Identidad Diocesana'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
};

const ChanceryActionButton = ({ label, icon: Icon, color, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-6 rounded-2xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg hover:shadow-gray-200/50 transition-all group"
    >
        <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">{label}</span>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:translate-x-1", color)}>
            <Icon className="w-5 h-5" />
        </div>
    </button>
);

export default ChanceryDashboard;