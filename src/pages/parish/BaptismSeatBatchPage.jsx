import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import DashboardLayout from '@/components/DashboardLayout'; 
import { 
    CheckCircle2, AlertCircle, X, Loader2, Users, 
    Calendar, Hash, CheckSquare, Square, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN CLAVE

const BaptismSeatBatchPage = () => {
    const { user } = useAuth();
    const { getPendingBaptisms, seatMultipleBaptisms, purificarRegistroBautismo } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [pendingBaptisms, setPendingBaptisms] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fullParamsCache, setFullParamsCache] = useState(null); // 🚀 Caché para parámetros

    // --- CARGA DE DATOS ---
    const loadData = async () => {
        if (!user?.parishId) return;
        setLoading(true);
        try {
            // 1. Cargar Registros Temporales
            const records = await getPendingBaptisms(user.parishId);
            
            const recordsMapped = records.map(r => {
                const purificado = purificarRegistroBautismo(r);
                return {
                    ...purificado,
                    numeroRegistro: r.numeroRegistro || '---',
                    direccion: r.direccion || '---',
                    nuip: r.nuip || '---'
                };
            });

            setPendingBaptisms(recordsMapped);

            // 🚀 2. CARGAR PARÁMETROS DESDE SUPABASE
            const { data: paramData, error } = await supabase
                .from('parish_parameters')
                .select('bautizos_params')
                .eq('parish_id', user.parishId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (paramData && paramData.bautizos_params) {
                setFullParamsCache(paramData.bautizos_params);
            }

        } catch (error) {
            console.error("Error cargando lote:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user?.parishId]);

    // --- SELECCIÓN EN LOTE ---
    const handleSelectAll = (checked) => {
        if (checked) setSelectedIds(pendingBaptisms.map(b => b.id));
        else setSelectedIds([]);
    };

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    // 🚀 LÓGICA DE INCREMENTO MATEMÁTICO EN SUPABASE
    const incrementParameters = async (count) => {
        if (!fullParamsCache || !user?.parishId) return;

        try {
            let p = { ...fullParamsCache };
            let cFolio = parseInt(p.ordinarioFolio) || 1;
            let cNumero = parseInt(p.ordinarioNumero) || 1;
            let cLibro = parseInt(p.ordinarioLibro) || 1;
            let pPorFolio = parseInt(p.ordinarioPartidas) || 2;
            let restart = p.ordinarioRestartNumber;

            // Simular el ciclo de incrementos
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

            const updatedParams = { ...p, ordinarioFolio: cFolio, ordinarioNumero: cNumero, ordinarioLibro: cLibro };

            await supabase
                .from('parish_parameters')
                .update({ bautizos_params: updatedParams })
                .eq('parish_id', user.parishId);

            // Refrescar caché local
            setFullParamsCache(updatedParams);

        } catch (err) {
            console.error("Error al incrementar parámetros en Supabase:", err);
        }
    };

    // --- ASENTAMIENTO MASIVO ---
    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0) return;
        
        const confirmMsg = `¿Está seguro de asentar ${selectedIds.length} registros permanentemente? Esta acción asignará Libro, Folio y Acta automáticamente a cada uno según la configuración de Supabase.`;
        if (!window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            const result = await seatMultipleBaptisms(selectedIds, user?.parishId);
            
            if (result.success) {
                // 🚀 INCREMENTAMOS EL LIBRO/FOLIO/NUMERO EN LA NUBE N VECES
                await incrementParameters(selectedIds.length);

                toast({
                    title: "Lote Procesado con Éxito",
                    description: `Se han asentado ${selectedIds.length} bautismos correctamente y los parámetros se han actualizado.`,
                    className: "bg-green-50 border-green-200 text-green-900"
                });
                setSelectedIds([]);
                await loadData();
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            toast({ title: "Error en el Lote", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Preparando registros para firma...</p>
        </div>
    );

    if (pendingBaptisms.length === 0) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 bg-white rounded-[3rem] border border-gray-100 shadow-sm p-12">
                    <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[2rem] flex items-center justify-center mb-8 border border-green-100">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tighter">¡Todo Asentado!</h2>
                    <p className="text-gray-400 font-medium text-sm">No existen borradores locales pendientes de proceso en bloque.</p>
                    <Button variant="outline" className="mt-8 px-10 py-7 rounded-2xl border-gray-200 font-black uppercase text-[10px]" onClick={() => navigate('/parroquia/bautismo/base-datos')}>Ir a Base de Datos</Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
                
                {/* CABECERA INFORMATIVA */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Asentamiento Masivo</h1>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-2">Firma digital de múltiples partidas en un solo paso</p>
                    </div>
                    <div className="bg-blue-50 px-6 py-4 rounded-2xl border border-blue-100">
                        <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">Registros Disponibles</span>
                        <span className="text-2xl font-black text-[#4B7BA7]">{pendingBaptisms.length}</span>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex-1">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 font-black text-[10px] text-gray-400 uppercase tracking-[0.2em]">
                                    <th className="px-8 py-6 w-16 text-center">
                                        <button onClick={() => handleSelectAll(selectedIds.length !== pendingBaptisms.length)} className="hover:scale-110 transition-transform">
                                            {selectedIds.length === pendingBaptisms.length ? <CheckSquare className="w-5 h-5 text-[#4B7BA7]" /> : <Square className="w-5 h-5 text-gray-300" />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-6"><div className="flex items-center gap-2"><Hash className="w-4 h-4 text-blue-400"/> Nº REG.</div></th>
                                    <th className="px-6 py-6"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-400"/> Bautizando</div></th>
                                    <th className="px-6 py-6"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400"/> Fecha Sacramento</div></th>
                                    <th className="px-6 py-6"><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-400"/> Dirección</div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pendingBaptisms.map((baptism, index) => {
                                    const isSelected = selectedIds.includes(baptism.id);
                                    return (
                                        <tr 
                                            key={baptism.id} 
                                            onClick={() => toggleSelection(baptism.id)}
                                            className={cn("transition-all cursor-pointer group", isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50')}
                                        >
                                            <td className="px-8 py-5 text-center">
                                                <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all mx-auto", isSelected ? "bg-[#4B7BA7] border-[#4B7BA7]" : "border-gray-200 group-hover:border-gray-300")}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-[11px] font-black text-[#4B7BA7]">#{baptism.numeroRegistro}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="font-black text-gray-900 uppercase text-xs">
                                                    {baptism.apellidos}, {baptism.nombres}
                                                </p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                    ID: {baptism.nuip}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-gray-600 font-bold text-[11px] uppercase">
                                                    {baptism.fechaSacramento || 'SIN FECHA'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase truncate max-w-xs">
                                                    {baptism.direccion}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* BARRA DE ACCIÓN FLOTANTE */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-5xl z-30">
                    <div className="bg-white/90 backdrop-blur-xl border border-gray-200 p-5 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-8 px-6">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Seleccionados</span>
                                <span className="text-3xl font-black text-[#4B7BA7] leading-none">{selectedIds.length}</span>
                            </div>
                            <div className="h-10 w-px bg-gray-200"></div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Pendientes</span>
                                <span className="text-2xl font-black text-gray-800 leading-none mt-1">{pendingBaptisms.length}</span>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 w-full md:w-auto px-2">
                            <Button 
                                variant="ghost" 
                                className="flex-1 md:flex-none px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-100" 
                                onClick={() => navigate('/parroquia/bautismo/sentar-registros')}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                className={cn(
                                    "flex-1 md:flex-none px-12 py-8 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all",
                                    selectedIds.length === 0 ? "bg-gray-100 text-gray-400" : "bg-gradient-to-r from-[#D4AF37] to-[#B4932A] text-white shadow-xl shadow-yellow-900/20 transform active:scale-95"
                                )}
                                disabled={selectedIds.length === 0 || isProcessing}
                                onClick={handleBatchConfirm}
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-3" /> Firmar y Asentar Lote</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BaptismSeatBatchPage;