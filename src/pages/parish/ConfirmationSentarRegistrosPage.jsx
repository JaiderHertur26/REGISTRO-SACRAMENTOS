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
import ConfirmationTicket from '@/components/ConfirmationTicket';
import { supabase } from '@/lib/supabaseClient'; 
import { calculateNextConsecutive } from '@/services/sacramentParametersService';

const ConfirmationSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { 
        seatConfirmation, 
        seatMultipleConfirmations, 
        getMisDatosList, 
        getConfirmationParameters,
        updateConfirmationParameters,
        getParrocos // 🚀 Extraemos la lista de sacerdotes
    } = useAppData();
    
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA PADRE MISERICORDIOSO');
    const [mode, setMode] = useState('individual'); 
    const [pendingConfirmations, setPendingConfirmations] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [nextNumbers, setNextNumbers] = useState({ book: '0001', page: '0001', entry: '0001' });
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [parishInfo, setParishInfo] = useState(null); 

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const now = new Date();
        const sacramentDate = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
        return sacramentDate > now; 
    };

    useEffect(() => {
        const resolveParish = async () => {
            if (!user) return;
            const pId = user.parish_id || user.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
            setResolvedParishId(pId);
            setNombreParroquia(user.parishName || user.parish_name || 'PARROQUIA PADRE MISERICORDIOSO');
        };
        resolveParish();
    }, [user]);

    const loadData = async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);

        try {
            // 🚀 OBTENER BORRADORES DE LA NUBE (CORRECCIÓN: Buscamos en 'confirmations' con status 'pending')
            const { data: tempData, error: tempError } = await supabase
                .from('confirmations')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            let recordsMapped = [];
            const sacerdotes = getParrocos(resolvedParishId) || []; 
            
            if (!tempError && tempData && tempData.length > 0) {
                const cloudPending = tempData.map(pb => {
                    const raw = typeof pb.raw_data === 'string' ? JSON.parse(pb.raw_data) : (pb.raw_data || {});
                    return { ...raw, id: pb.id, status: 'pending' };
                });
                
                localStorage.setItem(`pendingConfirmations_${resolvedParishId}`, JSON.stringify(cloudPending));

                recordsMapped = cloudPending.map(r => {
                    let fechaSac = r.fechaSacramento || r.celebration_date || r.sacramentDate;

                    // 🚀 MÁQUINA DEL TIEMPO PARA CORRECCIÓN (Da Fe)
                    let historicalPriest = null;
                    if (fechaSac && sacerdotes.length > 0) {
                        const fDate = new Date(fechaSac.includes('T') ? fechaSac : `${fechaSac}T12:00:00`);
                        const sEpoca = sacerdotes.find(s => {
                            if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                            const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                            const inicio = new Date(iStr);
                            const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                            return fDate >= inicio && fDate <= fin;
                        });
                        if (sEpoca) historicalPriest = `${sEpoca.nombre} ${sEpoca.apellido || ''}`.trim().toUpperCase();
                    }

                    // Corrección Da Fe
                    let rawDaFe = r.daFe || r.ministerFaith || r.dafe || r.da_fe;
                    if (!rawDaFe || !isNaN(Number(String(rawDaFe).trim()))) {
                        rawDaFe = historicalPriest || '';
                    }

                    return {
                        ...r,
                        numeroRegistro: r.numeroRegistro || r.inscripcionNumero || '---',
                        lugarSacramento: r.lugarSacramento || r.place || r.sacramentPlace || '---',
                        fechaSacramento: fechaSac,
                        ministro: r.ministro || r.minister || '',
                        daFe: rawDaFe
                    };
                });
            }
            
            setPendingConfirmations(recordsMapped);

            // Cargar Consecutivos desde Parameters
            const p = await getConfirmationParameters(resolvedParishId);
            setFullParamsCache(p);
            setNextNumbers({
                book: String(p.ordinarioLibro || 1).padStart(4, '0'),
                page: String(p.ordinarioFolio || 1).padStart(4, '0'),
                entry: String(p.ordinarioNumero || 1).padStart(4, '0')
            });

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
        if (!resolvedParishId) return;

        try {
            const p = fullParamsCache || await getConfirmationParameters(resolvedParishId);
            const prefix = bookType;

            let cFolio = parseInt(p[`${prefix}Folio`], 10) || 1;
            let cNumero = parseInt(p[`${prefix}Numero`], 10) || 1;
            let cLibro = parseInt(p[`${prefix}Libro`], 10) || 1;
            let pPorFolio = parseInt(p[`${prefix}Partidas`], 10) || 2;
            let restart = p[`${prefix}RestartNumber`];

            for (let i = 0; i < count; i++) {
                const siguiente = calculateNextConsecutive(cNumero, cFolio, cLibro, pPorFolio, restart);
                cNumero = parseInt(siguiente.numero, 10);
                cFolio = parseInt(siguiente.folio, 10);
                cLibro = parseInt(siguiente.libro, 10);
            }

            const updatedParams = { 
                ...p, 
                [`${prefix}Folio`]: cFolio, 
                [`${prefix}Numero`]: cNumero, 
                [`${prefix}Libro`]: cLibro 
            };

            await updateConfirmationParameters(resolvedParishId, updatedParams);
            setFullParamsCache(updatedParams);
            setNextNumbers({
                book: String(cLibro).padStart(4, '0'),
                page: String(cFolio).padStart(4, '0'),
                entry: String(cNumero).padStart(4, '0')
            });
        } catch (err) {
            console.error("Error al incrementar parámetros:", err);
        }
    };

    const currentConfirmation = pendingConfirmations[currentIndex];
    const currentIsFuture = currentConfirmation ? isDateInFuture(currentConfirmation.fechaSacramento) : false;

    const handleReprint = () => {
        if (!currentConfirmation) return;
        setTimeout(() => window.print(), 300);
    };

    const handleRegisterIndividual = async () => {
        if (!currentConfirmation || isSaving || currentIsFuture) return;

        setIsSaving(true);
        try {
            const result = await seatConfirmation(currentConfirmation.id, resolvedParishId, currentConfirmation);
            if (result.success) {
                await incrementParameters(1, 'ordinario'); 
                toast({ title: "Éxito", description: "Confirmación asentada permanentemente.", className: "bg-green-50 text-green-900 border-green-200" });
                await loadData();
                if (currentIndex >= pendingConfirmations.length - 1) setCurrentIndex(Math.max(0, pendingConfirmations.length - 2));
            } else {
                throw new Error(result.message);
            }
        } catch (error) { 
            toast({ title: "Error", description: error.message, variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingConfirmations
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
            const result = await seatMultipleConfirmations(selectedIds, resolvedParishId);
            if (result.success) {
                await incrementParameters(selectedIds.length, 'ordinario'); 
                toast({ title: "Lote Procesado", className: "bg-green-50 text-green-900 border-green-200" });
                setSelectedIds([]);
                await loadData();
            } else {
                throw new Error(result.message);
            }
        } catch (err) { 
            toast({ title: "Error", description: err.message, variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    if (isLoading) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600 w-8 h-8" /></div>
        </DashboardLayout>
    );

    if (pendingConfirmations.length === 0) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed border-gray-200 shadow-sm">
                <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
                <h3 className="text-xl font-bold uppercase text-gray-400">Archivo al Día</h3>
                <p className="text-xs text-gray-400 mt-1">No hay borradores pendientes de confirmación en la nube.</p>
                <Button variant="outline" className="mt-6 rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => navigate('/parroquia/confirmacion/partidas')}>Ver Actas Permanentes</Button>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block">
                {currentConfirmation && <ConfirmationTicket confirmationData={currentConfirmation} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-7xl mx-auto px-4 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft className="text-gray-500"/></Button>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900">Asentamiento de Confirmaciones</h1>
                            <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mt-1"><Layers className="w-3 h-3 text-red-600" /> Firma de Actas Temporales</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 rounded-[1.5rem] border shadow-sm flex items-center gap-1">
                        <button onClick={() => setMode('individual')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'individual' ? "bg-red-50 text-red-700 shadow-sm border border-red-100" : "text-gray-500 hover:bg-gray-50")}>
                            <BookOpenCheck className="w-4 h-4 inline mr-2" /> Individual
                        </button>
                        <button onClick={() => setMode('batch')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'batch' ? "bg-red-50 text-red-700 shadow-sm border border-red-100" : "text-gray-500 hover:bg-gray-50")}>
                            <LayoutList className="w-4 h-4 inline mr-2" /> Por Lote
                        </button>
                    </div>
                </div>

                {mode === 'individual' && (
                    <div className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white p-4 rounded-t-[2rem] border shadow-sm flex items-center justify-between border-b-0">
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}><ChevronLeft className="w-4 h-4 text-gray-600" /></Button>
                            <span className="font-black text-[10px] uppercase tracking-widest text-red-600 bg-red-50 px-4 py-1.5 rounded-full border border-red-100">Documento {currentIndex + 1} de {pendingConfirmations.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingConfirmations.length - 1, prev + 1))} disabled={currentIndex === pendingConfirmations.length - 1}><ChevronRight className="w-4 h-4 text-gray-600" /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-red-600">{nextNumbers.book}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-red-600">{nextNumbers.page}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{nextNumbers.entry}</div></div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black border border-red-100">{currentIndex + 1}</div>
                                <p className="text-2xl font-black uppercase text-gray-900">{currentConfirmation?.nombres} {currentConfirmation?.apellidos}</p>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-red-50 p-6 rounded-2xl border border-red-200 text-red-700 animate-pulse">
                                    <AlertCircle className="w-8 h-8 flex-shrink-0" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del sacramento ({currentConfirmation?.fechaSacramento}) aún no ha ocurrido. No se puede asentar antes de su celebración.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-10 opacity-100 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Nº Registro Previo</label><p className="font-black text-red-600 text-lg">#{currentConfirmation?.numeroRegistro || '---'}</p></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Lugar de Confirmación</label><p className="font-bold text-gray-700 uppercase">{currentConfirmation?.lugarSacramento || '---'}</p></div>
                            </div>

                            <div className="flex justify-between items-center pt-8 border-t">
                                <Button variant="outline" onClick={handleReprint} className="rounded-xl border-gray-300 text-gray-600 hover:bg-gray-50"><Printer className="mr-2 w-4 h-4" /> Re-imprimir Boleta</Button>
                                <Button 
                                    onClick={handleRegisterIndividual} 
                                    disabled={isSaving || currentIsFuture} 
                                    className={cn(
                                        "px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl transition-all",
                                        currentIsFuture ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none" : "bg-red-600 hover:bg-red-800 text-white hover:scale-105 shadow-red-900/20"
                                    )}
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : (currentIsFuture ? <Lock className="mr-2 w-5 h-5" /> : <Save className="mr-2 w-5 h-5" />)}
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
                                    <th className="px-8 py-6 w-16 text-center"><button onClick={() => handleSelectAll(selectedIds.length !== pendingConfirmations.filter(b => !isDateInFuture(b.fechaSacramento)).length)}>{selectedIds.length > 0 && selectedIds.length === pendingConfirmations.filter(b => !isDateInFuture(b.fechaSacramento)).length ? <CheckSquare className="text-red-600" /> : <Square />}</button></th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Confirmando</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                    <th className="px-6 py-6">Lugar de Celebración</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pendingConfirmations.map(conf => {
                                    const isFuture = isDateInFuture(conf.fechaSacramento);
                                    const isSelected = selectedIds.includes(conf.id);
                                    return (
                                        <tr 
                                            key={conf.id} 
                                            onClick={() => toggleSelection(conf.id, isFuture)} 
                                            className={cn(
                                                "transition-colors", 
                                                isFuture ? "bg-gray-50/50 cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-red-50/30",
                                                isSelected ? "bg-red-50/60" : ""
                                            )}
                                        >
                                            <td className="px-8 py-4 text-center">
                                                {!isFuture && (
                                                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center mx-auto", isSelected ? "bg-red-600 border-red-600" : "border-gray-300")}>
                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isFuture && <Lock className="w-4 h-4 text-gray-300 mx-auto" />}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isFuture ? <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded-full uppercase border border-gray-200">Futuro</span> : <span className="text-[8px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase border border-green-200">Listo</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-gray-800">{conf.apellidos}, {conf.nombres}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">#{conf.numeroRegistro || '---'}</p>
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-gray-400" : "text-gray-600")}>
                                                {conf.fechaSacramento}
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase">{conf.lugarSacramento || '---'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-gray-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Seleccionados: <span className="text-red-600 text-sm">{selectedIds.length}</span></span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase mt-1">Registros aptos para firma</span>}
                            </div>
                            <Button onClick={handleBatchConfirm} disabled={selectedIds.length === 0 || isSaving} className="bg-red-600 hover:bg-red-800 text-white px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-red-900/20 active:scale-95 transition-transform">
                                {isSaving ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <CheckCircle2 className="mr-2 w-5 h-5" />} Asentar Selección
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default ConfirmationSentarRegistrosPage;