import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { 
    ChevronLeft, ChevronRight, Save, 
    CheckCircle2, AlertCircle, Loader2, Printer,
    LayoutList, BookOpenCheck,
    Layers, CheckSquare, Square, Lock
} from 'lucide-react';
import BaptismTicket from '@/components/BaptismTicket';
import { supabase } from '@/lib/supabaseClient'; 

const BaptismSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { 
        seatBaptism, 
        seatMultipleBaptisms, 
        getMisDatosList, 
        purificarRegistroBautismo
    } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    const [mode, setMode] = useState('individual'); 
    const [pendingBaptisms, setPendingBaptisms] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [nextNumbers, setNextNumbers] = useState({ book: '---', page: '---', entry: '---' });
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [parishInfo, setParishInfo] = useState(null); 

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const now = new Date();
        const sacramentDate = new Date(dateString);
        return sacramentDate > now; 
    };

    // 🚀 OBTENER ID REAL DE LA PARROQUIA
    useEffect(() => {
        const resolveParish = async () => {
            if (!user) return;
            let pId = user.parish_id || user.parishId;

            if (!pId && user.email) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('parish_id')
                    .eq('email', user.email)
                    .maybeSingle();
                if (profile?.parish_id) pId = profile.parish_id;
            }

            if (pId) {
                setResolvedParishId(pId);
                const { data: pData } = await supabase
                    .from('parishes')
                    .select('name')
                    .eq('id', pId)
                    .maybeSingle();
                if (pData?.name) setNombreParroquia(pData.name.toUpperCase());
            } else {
                setIsLoading(false);
            }
        };

        resolveParish();
    }, [user]);

    // 🚀 CARGA DIRECTA DESDE pending_baptisms EN SUPABASE
    const loadData = async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);

        try {
            const { data: tempData, error: tempError } = await supabase
                .from('pending_baptisms')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .order('created_at', { ascending: false });

            if (tempError) throw tempError;

            let recordsMapped = [];
            
            if (tempData && tempData.length > 0) {
                const cloudPending = tempData.map(pb => {
                    const raw = typeof pb.raw_data === 'string' ? JSON.parse(pb.raw_data) : (pb.raw_data || {});
                    return { ...raw, id: pb.id, status: 'pending' };
                });
                
                localStorage.setItem(`pendingBaptisms_${resolvedParishId}`, JSON.stringify(cloudPending));

                recordsMapped = cloudPending.map(r => {
                    const purificado = purificarRegistroBautismo(r);
                    return {
                        ...purificado,
                        numeroRegistro: r.numeroRegistro || purificado.numeroRegistro || '---',
                        direccion: r.direccion || purificado.direccion || '---',
                        nuip: r.nuip || purificado.nuip || '---',
                        oficinaRegistro: r.oficinaRegistro || purificado.oficinaRegistro || '---',
                        fechaSacramento: r.fechaSacramento || purificado.fechaSacramento 
                    };
                });
            }
            
            setPendingBaptisms(recordsMapped);

            const { data: paramData, error } = await supabase
                .from('parish_parameters')
                .select('bautizos_params')
                .eq('parish_id', resolvedParishId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (paramData?.bautizos_params) {
                const p = paramData.bautizos_params;
                setFullParamsCache(p);
                setNextNumbers({
                    book: String(p.ordinarioLibro || '1').padStart(4, '0'),
                    page: String(p.ordinarioFolio || '1').padStart(4, '0'),
                    entry: String(p.ordinarioNumero || '1').padStart(4, '0')
                });
            }

            const misDatos = getMisDatosList(resolvedParishId);
            if (misDatos?.length > 0) {
                setParishInfo({
                    diocesis: misDatos[0].diocesis,
                    nombre: misDatos[0].nombre,
                    direccion: misDatos[0].direccion,
                    telefono: misDatos[0].telefono,
                    ciudad: misDatos[0].ciudad
                });
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
            toast({ title: "Error", description: "No se pudieron cargar los borradores de la nube", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (resolvedParishId) {
            loadData(); 
        }
    }, [resolvedParishId]);

    const incrementParameters = async (count, bookType = 'ordinario') => {
        if (!fullParamsCache || !resolvedParishId) return;

        try {
            let p = { ...fullParamsCache };
            const prefix = bookType;

            let cFolio = parseInt(p[`${prefix}Folio`], 10) || 1;
            let cNumero = parseInt(p[`${prefix}Numero`], 10) || 1;
            let cLibro = parseInt(p[`${prefix}Libro`], 10) || 1;
            let pPorFolio = parseInt(p[`${prefix}Partidas`], 10) || 2;
            let restart = p[`${prefix}RestartNumber`];

            for (let i = 0; i < count; i++) {
                if (restart) {
                    if (cNumero >= pPorFolio) {
                        cFolio++;
                        cNumero = 1;
                    } else {
                        cNumero++;
                    }
                } else {
                    if (cNumero % pPorFolio === 0) {
                        cFolio++;
                    }
                    cNumero++;
                }
            }

            const updatedParams = { 
                ...p, 
                [`${prefix}Folio`]: String(cFolio).padStart(4, '0'), 
                [`${prefix}Numero`]: String(cNumero).padStart(4, '0'), 
                [`${prefix}Libro`]: String(cLibro).padStart(4, '0') 
            };

            await supabase
                .from('parish_parameters')
                .update({ bautizos_params: updatedParams })
                .eq('parish_id', resolvedParishId);

            setFullParamsCache(updatedParams);
            setNextNumbers({
                book: updatedParams[`${prefix}Libro`],
                page: updatedParams[`${prefix}Folio`],
                entry: updatedParams[`${prefix}Numero`]
            });

        } catch (err) {
            console.error("Error al incrementar parámetros:", err);
        }
    };

    const currentBaptism = pendingBaptisms[currentIndex];
    const currentIsFuture = currentBaptism ? isDateInFuture(currentBaptism.fechaSacramento) : false;

    const handleReprint = () => {
        if (!currentBaptism) return;
        setTimeout(() => window.print(), 300);
    };

    const handleRegisterIndividual = async () => {
        if (!currentBaptism || isSaving || currentIsFuture) return;

        setIsSaving(true);
        try {
            const result = await seatBaptism(currentBaptism.id, resolvedParishId, {});
            if (result.success) {
                await incrementParameters(1, 'ordinario'); 
                toast({ title: "Éxito", description: "Bautismo asentado permanentemente.", className: "bg-green-50 text-green-900 border-green-200" });
                await loadData();
                if (currentIndex >= pendingBaptisms.length - 1) setCurrentIndex(Math.max(0, pendingBaptisms.length - 2));
            }
        } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        finally { setIsSaving(false); }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingBaptisms
                .filter(b => !isDateInFuture(b.fechaSacramento))
                .map(b => b.id);
            setSelectedIds(validIds);
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id, isFuture) => {
        if (isFuture) return; 
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0 || isSaving) return;
        if (!window.confirm(`¿Asentar ${selectedIds.length} registros permanentemente?`)) return;

        setIsSaving(true);
        try {
            const result = await seatMultipleBaptisms(selectedIds, resolvedParishId);
            if (result.success) {
                await incrementParameters(selectedIds.length, 'ordinario'); 
                toast({ title: "Lote Procesado", className: "bg-green-50 text-green-900 border-green-200" });
                setSelectedIds([]);
                await loadData();
            }
        } catch (err) { toast({ title: "Error", variant: "destructive" }); }
        finally { setIsSaving(false); }
    };

    if (isLoading) return <DashboardLayout entityName={nombreParroquia}><div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7]" /></div></DashboardLayout>;

    if (pendingBaptisms.length === 0) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed">
                <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
                <h3 className="text-xl font-bold uppercase text-gray-400">Archivo al Día</h3>
                <p className="text-xs text-gray-400 mt-1">No hay borradores pendientes en la nube.</p>
                <Button variant="outline" className="mt-6 rounded-xl" onClick={() => navigate('/parroquia/bautismo/partidas')}>Ver Actas Permanentes</Button>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block">
                {currentBaptism && <BaptismTicket baptismData={currentBaptism} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-7xl mx-auto px-4 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter">Asentamiento de Libros</h1>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2"><Layers className="w-3 h-3 text-[#D4AF37]" /> Firma de Actas Temporales</p>
                        </div>
                    </div>

                    <div className="bg-gray-200/50 p-1.5 rounded-[1.5rem] border flex items-center gap-1">
                        <button onClick={() => setMode('individual')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'individual' ? "bg-white text-[#4B7BA7] shadow-lg" : "text-gray-500")}>
                            <BookOpenCheck className="w-4 h-4 inline mr-2" /> Individual
                        </button>
                        <button onClick={() => setMode('batch')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'batch' ? "bg-white text-[#4B7BA7] shadow-lg" : "text-gray-500")}>
                            <LayoutList className="w-4 h-4 inline mr-2" /> Por Lote
                        </button>
                    </div>
                </div>

                {mode === 'individual' && (
                    <div className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white p-4 rounded-t-[2rem] border shadow-sm flex items-center justify-between border-b-0">
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}><ChevronLeft /></Button>
                            <span className="font-black text-[10px] uppercase tracking-widest text-gray-500">Documento {currentIndex + 1} de {pendingBaptisms.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingBaptisms.length - 1, prev + 1))} disabled={currentIndex === pendingBaptisms.length - 1}><ChevronRight /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{String(nextNumbers.book).padStart(4, '0')}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{String(nextNumbers.page).padStart(4, '0')}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{String(nextNumbers.entry).padStart(4, '0')}</div></div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-blue-50 text-[#4B7BA7] rounded-xl flex items-center justify-center font-black">{currentIndex + 1}</div>
                                <p className="text-2xl font-black uppercase text-gray-900">{currentBaptism.nombres} {currentBaptism.apellidos}</p>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700 animate-pulse">
                                    <AlertCircle className="w-8 h-8" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del sacramento ({currentBaptism.fechaSacramento}) aún no ha ocurrido. No se puede asentar.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-10 opacity-100">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Nº Registro Previo</label><p className="font-black text-[#4B7BA7] text-lg">#{currentBaptism.numeroRegistro}</p></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Dirección</label><p className="font-bold text-gray-700 uppercase">{currentBaptism.direccion}</p></div>
                            </div>

                            <div className="flex justify-between items-center pt-8 border-t">
                                <Button variant="outline" onClick={handleReprint} className="rounded-xl"><Printer className="mr-2 w-4 h-4" /> Re-imprimir Boleta</Button>
                                <Button 
                                    onClick={handleRegisterIndividual} 
                                    disabled={isSaving || currentIsFuture} 
                                    className={cn(
                                        "px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl transition-all",
                                        currentIsFuture ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gradient-to-r from-[#D4AF37] to-[#B4932A] text-white hover:scale-105"
                                    )}
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : (currentIsFuture ? <Lock className="mr-2 w-4 h-4" /> : <Save className="mr-2" />)}
                                    {currentIsFuture ? "Bloqueado por Fecha" : "Firmar y Sellar Permanente"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'batch' && (
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b font-black text-[10px] text-gray-400 uppercase">
                                <tr>
                                    <th className="px-8 py-6 w-16 text-center"><button onClick={() => handleSelectAll(selectedIds.length !== pendingBaptisms.filter(b => !isDateInFuture(b.fechaSacramento)).length)}>{selectedIds.length > 0 && selectedIds.length === pendingBaptisms.filter(b => !isDateInFuture(b.fechaSacramento)).length ? <CheckSquare className="text-[#4B7BA7]" /> : <Square />}</button></th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Bautizando</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                    <th className="px-6 py-6">Dirección</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingBaptisms.map(baptism => {
                                    const isFuture = isDateInFuture(baptism.fechaSacramento);
                                    const isSelected = selectedIds.includes(baptism.id);
                                    return (
                                        <tr 
                                            key={baptism.id} 
                                            onClick={() => toggleSelection(baptism.id, isFuture)} 
                                            className={cn(
                                                "transition-colors", 
                                                isFuture ? "bg-gray-50/50 cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50",
                                                isSelected ? "bg-blue-50/50" : ""
                                            )}
                                        >
                                            <td className="px-8 py-4 text-center">
                                                {!isFuture && (
                                                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center mx-auto", isSelected ? "bg-[#4B7BA7] border-[#4B7BA7]" : "border-gray-200")}>
                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isFuture && <Lock className="w-4 h-4 text-gray-300 mx-auto" />}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isFuture ? <span className="text-[8px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-full uppercase">Futuro</span> : <span className="text-[8px] font-black bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Listo</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-gray-800">{baptism.apellidos}, {baptism.nombres}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">#{baptism.numeroRegistro}</p>
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-red-500" : "text-gray-600")}>
                                                {baptism.fechaSacramento}
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase">{baptism.direccion}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-gray-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Seleccionados: {selectedIds.length}</span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase">Registros aptos para firma</span>}
                            </div>
                            <Button onClick={handleBatchConfirm} disabled={selectedIds.length === 0 || isSaving} className="bg-[#4B7BA7] text-white px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-900/20">
                                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Asentar Selección
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default BaptismSentarRegistrosPage;