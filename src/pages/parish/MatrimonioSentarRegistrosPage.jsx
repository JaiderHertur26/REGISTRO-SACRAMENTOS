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
    Layers, CheckSquare, Square, Lock, Heart, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; 

const MatrimonioSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { 
        seatMatrimonio, 
        seatMultipleMatrimonios, 
        getMisDatosList,
        getPendingMatrimonios
    } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    const [mode, setMode] = useState('individual'); // 'individual' o 'batch'
    const [pendingMarriages, setPendingMarriages] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [nextNumbers, setNextNumbers] = useState({ book: '---', page: '---', entry: '---' });
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const now = new Date();
        const sacramentDate = new Date(dateString);
        return sacramentDate > now; 
    };

    // 🚀 1. RASTREADOR DE PARROQUIA
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

    // 🚀 2. CARGA DE BORRADORES DE MATRIMONIO
    const loadData = async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);

        try {
            // Intentar cargar de Supabase o local
            let records = [];
            const { data: tempData, error: tempError } = await supabase
                .from('marriages')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (!tempError && tempData && tempData.length > 0) {
                records = tempData.map(m => {
                    const raw = typeof m.raw_data === 'string' ? JSON.parse(m.raw_data) : (m.raw_data || {});
                    return { ...raw, id: m.id, status: 'pending' };
                });
            } else {
                records = JSON.parse(localStorage.getItem(`pendingMatrimonios_${resolvedParishId}`) || '[]');
            }

            setPendingMarriages(records);

            // Cargar Parámetros de Matrimonio
            const { data: paramData } = await supabase
                .from('parish_parameters')
                .select('matrimonios_params')
                .eq('parish_id', resolvedParishId)
                .maybeSingle();

            if (paramData?.matrimonios_params) {
                const p = paramData.matrimonios_params;
                setFullParamsCache(p);
                setNextNumbers({
                    book: String(p.ordinarioLibro || '1').padStart(4, '0'),
                    page: String(p.ordinarioFolio || '1').padStart(4, '0'),
                    entry: String(p.ordinarioNumero || '1').padStart(4, '0')
                });
            } else {
                const localParams = JSON.parse(localStorage.getItem(`matrimonioParameters_${resolvedParishId}`) || '{}');
                setFullParamsCache(localParams);
                setNextNumbers({
                    book: String(localParams.ordinarioLibro || '1').padStart(4, '0'),
                    page: String(localParams.ordinarioFolio || '1').padStart(4, '0'),
                    entry: String(localParams.ordinarioNumero || '1').padStart(4, '0')
                });
            }
        } catch (error) {
            console.error("Error cargando datos de matrimonio:", error);
            toast({ title: "Error", description: "No se pudieron cargar los borradores", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (resolvedParishId) {
            loadData(); 
        }
    }, [resolvedParishId]);

    const incrementParameters = async (count) => {
        if (!fullParamsCache || !resolvedParishId) return;

        try {
            let p = { ...fullParamsCache };
            let cFolio = parseInt(p.ordinarioFolio, 10) || 1;
            let cNumero = parseInt(p.ordinarioNumero, 10) || 1;
            let cLibro = parseInt(p.ordinarioLibro, 10) || 1;
            let pPorFolio = parseInt(p.ordinarioPartidas, 10) || 1;
            let restart = p.ordinarioRestartNumber;

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
                ordinarioFolio: String(cFolio).padStart(4, '0'), 
                ordinarioNumero: String(cNumero).padStart(4, '0'), 
                ordinarioLibro: String(cLibro).padStart(4, '0') 
            };

            await supabase
                .from('parish_parameters')
                .update({ matrimonios_params: updatedParams })
                .eq('parish_id', resolvedParishId);

            localStorage.setItem(`matrimonioParameters_${resolvedParishId}`, JSON.stringify(updatedParams));

            setFullParamsCache(updatedParams);
            setNextNumbers({
                book: updatedParams.ordinarioLibro,
                page: updatedParams.ordinarioFolio,
                entry: updatedParams.ordinarioNumero
            });

        } catch (err) {
            console.error("Error al incrementar parámetros de matrimonio:", err);
        }
    };

    const currentMarriage = pendingMarriages[currentIndex];
    const currentIsFuture = currentMarriage ? isDateInFuture(currentMarriage.fechaSacramento || currentMarriage.fechaMatrimonio) : false;

    const handleRegisterIndividual = async () => {
        if (!currentMarriage || isSaving || currentIsFuture) return;

        setIsSaving(true);
        try {
            const result = await seatMatrimonio(currentMarriage.id, resolvedParishId);
            if (result.success) {
                await incrementParameters(1); 
                toast({ title: "Éxito", description: "Matrimonio asentado permanentemente.", className: "bg-green-50 text-green-900 border-green-200" });
                await loadData();
                if (currentIndex >= pendingMarriages.length - 1) setCurrentIndex(Math.max(0, pendingMarriages.length - 2));
            }
        } catch (error) { 
            toast({ title: "Error", variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingMarriages
                .filter(m => !isDateInFuture(m.fechaSacramento || m.fechaMatrimonio))
                .map(m => m.id);
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
        if (!window.confirm(`¿Asentar ${selectedIds.length} actas de matrimonio permanentemente?`)) return;

        setIsSaving(true);
        try {
            const result = await seatMultipleMatrimonios(selectedIds, resolvedParishId);
            if (result.success) {
                await incrementParameters(selectedIds.length); 
                toast({ title: "Lote Procesado", className: "bg-green-50 text-green-900 border-green-200" });
                setSelectedIds([]);
                await loadData();
            }
        } catch (err) { 
            toast({ title: "Error", variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    if (isLoading) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7] w-8 h-8" /></div>
        </DashboardLayout>
    );

    if (pendingMarriages.length === 0) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed">
                <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
                <h3 className="text-xl font-bold uppercase text-gray-400">Archivo al Día</h3>
                <p className="text-xs text-gray-400 mt-1">No hay borradores de matrimonio pendientes.</p>
                <Button variant="outline" className="mt-6 rounded-xl" onClick={() => navigate('/parroquia/matrimonio/partidas')}>Ver Actas de Matrimonio</Button>
            </div>
        </DashboardLayout>
    );

    const esposoNombre = currentMarriage?.esposo?.nombres || currentMarriage?.nombres_esposo || currentMarriage?.husbandName || '---';
    const esposoApellido = currentMarriage?.esposo?.apellidos || currentMarriage?.apellidos_esposo || currentMarriage?.husbandSurname || '';
    const esposaNombre = currentMarriage?.esposa?.nombres || currentMarriage?.nombres_esposa || currentMarriage?.wifeName || '---';
    const esposaApellido = currentMarriage?.esposa?.apellidos || currentMarriage?.apellidos_esposa || currentMarriage?.wifeSurname || '';
    const fechaMatrimonio = currentMarriage?.fechaSacramento || currentMarriage?.fechaMatrimonio || 'SIN FECHA';

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-7xl mx-auto px-4 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/matrimonio/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter">Asentamiento de Matrimonios</h1>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2"><Layers className="w-3 h-3 text-[#D4AF37]" /> Firma de Actas Matrimoniales</p>
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
                            <span className="font-black text-[10px] uppercase tracking-widest text-gray-500">Expediente {currentIndex + 1} de {pendingMarriages.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingMarriages.length - 1, prev + 1))} disabled={currentIndex === pendingMarriages.length - 1}><ChevronRight /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{String(nextNumbers.book).padStart(4, '0')}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{String(nextNumbers.page).padStart(4, '0')}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{String(nextNumbers.entry).padStart(4, '0')}</div></div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center font-black">
                                    <Heart className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black uppercase text-gray-900">{esposoNombre} {esposoApellido}</p>
                                    <p className="text-lg font-bold uppercase text-pink-600">& {esposaNombre} {esposaApellido}</p>
                                </div>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700 animate-pulse">
                                    <AlertCircle className="w-8 h-8" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del matrimonio ({fechaMatrimonio}) aún no ha ocurrido. No se puede asentar.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-10">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Fecha Sacramento</label><p className="font-black text-[#4B7BA7] text-lg">{fechaMatrimonio}</p></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase">Lugar</label><p className="font-bold text-gray-700 uppercase">{currentMarriage?.lugarMatrimonio || nombreParroquia}</p></div>
                            </div>

                            <div className="flex justify-end items-center pt-8 border-t">
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
                                    <th className="px-8 py-6 w-16 text-center">
                                        <button onClick={() => handleSelectAll(selectedIds.length !== pendingMarriages.filter(m => !isDateInFuture(m.fechaSacramento || m.fechaMatrimonio)).length)}>
                                            {selectedIds.length > 0 && selectedIds.length === pendingMarriages.filter(m => !isDateInFuture(m.fechaSacramento || m.fechaMatrimonio)).length ? <CheckSquare className="text-[#4B7BA7]" /> : <Square />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Contrayentes</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingMarriages.map(marriage => {
                                    const dateStr = marriage.fechaSacramento || marriage.fechaMatrimonio;
                                    const isFuture = isDateInFuture(dateStr);
                                    const isSelected = selectedIds.includes(marriage.id);
                                    const hName = marriage.esposo?.nombres || marriage.nombres_esposo || marriage.husbandName || '';
                                    const hSur = marriage.esposo?.apellidos || marriage.apellidos_esposo || marriage.husbandSurname || '';
                                    const wName = marriage.esposa?.nombres || marriage.nombres_esposa || marriage.wifeName || '';
                                    const wSur = marriage.esposa?.apellidos || marriage.apellidos_esposa || marriage.wifeSurname || '';

                                    return (
                                        <tr 
                                            key={marriage.id} 
                                            onClick={() => toggleSelection(marriage.id, isFuture)} 
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
                                                <p className="font-black uppercase text-xs text-gray-800">{hName} {hSur}</p>
                                                <p className="text-[10px] font-bold text-pink-600 uppercase">& {wName} {wSur}</p>
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-red-500" : "text-gray-600")}>
                                                {dateStr || 'SIN FECHA'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-gray-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Seleccionados: {selectedIds.length}</span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase">Actas listas para firma</span>}
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

export default MatrimonioSentarRegistrosPage;