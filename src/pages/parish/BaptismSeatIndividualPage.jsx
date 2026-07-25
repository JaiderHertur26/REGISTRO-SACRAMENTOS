import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { 
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
    CheckCircle2, LogOut, User, Loader2, FileText,
    BookOpen, ScrollText, Printer, AlertCircle,
    LayoutList, BookOpenCheck, Settings2, Database,
    Layers, CheckSquare, Square, Users, Calendar, Hash, MapPin, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import BaptismTicket from '@/components/BaptismTicket'; 
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN CLAVE

const BaptismSeatIndividualPage = () => {
    const { user } = useAuth();
    const { 
        getPendingBaptisms, 
        seatBaptism, 
        purificarRegistroBautismo, 
        getMisDatosList 
    } = useAppData();
    
    const { toast } = useToast();
    const navigate = useNavigate();

    const [pendingBaptisms, setPendingBaptisms] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [nextNumbers, setNextNumbers] = useState(null); // 🚀 Números dinámicos desde Supabase
    const [fullParamsCache, setFullParamsCache] = useState(null); // 🚀 Objeto completo para incrementar luego
    const [parishInfo, setParishInfo] = useState(null); 

    const [includeCivilRegistry, setIncludeCivilRegistry] = useState(false);
    const [civilRegistryData, setCivilRegistryData] = useState({
        serialRegistro: '', oficinaRegistro: '', fechaExpedicionRegistro: ''
    });

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const now = new Date();
        const sacramentDate = new Date(dateString);
        return sacramentDate > now; 
    };

    // --- 1. CARGA DE DATOS ---
    const loadData = async () => {
        if (!user?.parishId) return;
        const entityId = user.parishId;
        setLoading(true);
        
        try {
            // 1. Cargar registros temporales locales
            const records = await getPendingBaptisms(entityId);
            
            const recordsMapped = records.map(r => {
                const purificado = purificarRegistroBautismo(r);
                return {
                    ...purificado,
                    numeroRegistro: r.numeroRegistro || purificado.numeroRegistro,
                    direccion: r.direccion || purificado.direccion,
                    nuip: r.nuip || purificado.nuip,
                    oficinaRegistro: r.oficinaRegistro || purificado.oficinaRegistro,
                    fechaSacramento: r.fechaSacramento || purificado.fechaSacramento 
                };
            });

            setPendingBaptisms(recordsMapped);

            // 🚀 2. CARGAR PARÁMETROS DESDE SUPABASE
            const { data: paramData, error } = await supabase
                .from('parish_parameters')
                .select('bautizos_params')
                .eq('parish_id', entityId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (paramData && paramData.bautizos_params) {
                const p = paramData.bautizos_params;
                setFullParamsCache(p);
                // Extraemos los números actuales para mostrar en la UI
                setNextNumbers({
                    book: p.ordinarioLibro || 1,
                    page: p.ordinarioFolio || 1,
                    entry: p.ordinarioNumero || 1
                });
            }

            // 3. CARGA DE MEMBRETE
            const misDatos = getMisDatosList(entityId);
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
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user?.parishId]);

    const currentBaptism = pendingBaptisms[currentIndex];
    const currentIsFuture = currentBaptism ? isDateInFuture(currentBaptism.fechaSacramento) : false;

    useEffect(() => {
        if (currentBaptism) {
            setCivilRegistryData({
                serialRegistro: currentBaptism.serialRegistro || '',
                oficinaRegistro: currentBaptism.oficinaRegistro || '',
                fechaExpedicionRegistro: currentBaptism.fechaExpedicionRegistro || ''
            });
            setIncludeCivilRegistry(false); 
        }
    }, [currentBaptism]);

    const handleReprint = () => {
        if (!currentBaptism) return;
        setTimeout(() => window.print(), 300);
    };

    // 🚀 LÓGICA DE INCREMENTO MATEMÁTICO EN SUPABASE
    const incrementParameters = async () => {
        if (!fullParamsCache || !user?.parishId) return;

        try {
            let p = { ...fullParamsCache };
            let cFolio = parseInt(p.ordinarioFolio) || 1;
            let cNumero = parseInt(p.ordinarioNumero) || 1;
            let cLibro = parseInt(p.ordinarioLibro) || 1;
            let pPorFolio = parseInt(p.ordinarioPartidas) || 2;
            let restart = p.ordinarioRestartNumber;

            // Incremento para 1 solo registro
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

            const updatedParams = { ...p, ordinarioFolio: cFolio, ordinarioNumero: cNumero, ordinarioLibro: cLibro };

            await supabase
                .from('parish_parameters')
                .update({ bautizos_params: updatedParams })
                .eq('parish_id', user.parishId);

        } catch (err) {
            console.error("Error al incrementar parámetros:", err);
        }
    };

    const handleConfirm = async () => {
        if (!currentBaptism || isSaving || currentIsFuture) return;
        setIsSaving(true);
        
        try {
            const updates = { ...civilRegistryData };
            
            if (includeCivilRegistry && civilRegistryData.serialRegistro && civilRegistryData.oficinaRegistro) {
                let formattedDate = civilRegistryData.fechaExpedicionRegistro ? 
                    ` DE FECHA: ${convertDateToSpanishText(civilRegistryData.fechaExpedicionRegistro).toUpperCase()}` : "";
                
                const autoNote = `REGISTRO CIVIL SERIAL No. ${civilRegistryData.serialRegistro}, EXPEDIDO POR ${civilRegistryData.oficinaRegistro.toUpperCase()}${formattedDate}.`;
                
                const existingNote = currentBaptism.marginNote || '';
                updates.marginNote = existingNote ? `${existingNote}\n\n${autoNote}`.trim() : autoNote;
            }

            // 🧠 SEAT BAPTISM
            const result = await seatBaptism(currentBaptism.id, user?.parishId, updates);
            
            if (result.success) {
                // 🚀 INCREMENTAMOS EL LIBRO/FOLIO/NUMERO EN LA NUBE
                await incrementParameters();

                toast({ title: "Registro Asentado", description: "Subido exitosamente a la base de datos central.", className: "bg-green-50 text-green-900 border-green-200" });
                
                // Refrescar y navegar si es necesario
                const newRecordsRaw = await getPendingBaptisms(user?.parishId);
                if (newRecordsRaw.length === 0) {
                    navigate('/parroquia/bautismo/sentar-registros');
                } else {
                    await loadData(); // Recargamos para traer los nuevos números
                    if (currentIndex >= newRecordsRaw.length) setCurrentIndex(newRecordsRaw.length - 1);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const Field = ({ label, value, highlight = false }) => (
        <div className={`p-4 rounded-2xl border ${highlight ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{label}</label>
            <p className={`text-sm font-bold truncate uppercase ${highlight ? 'text-blue-800' : 'text-gray-800'}`}>{value || '---'}</p>
        </div>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando Borradores...</p>
        </div>
    );

    if (pendingBaptisms.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] border border-gray-100 shadow-sm p-12">
            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[2rem] flex items-center justify-center mb-8 border border-green-100"><CheckCircle2 className="w-12 h-12" /></div>
            <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tighter">¡Todo al día!</h2>
            <p className="text-gray-400 font-medium">No hay registros pendientes por asentar.</p>
            <Button variant="outline" className="mt-8 px-10 py-7 rounded-2xl border-gray-200 font-black uppercase text-[10px]" onClick={() => navigate('/parroquia/bautismo/base-datos')}>Ver Base de Datos</Button>
        </div>
    );

    return (
        <div className="relative">
            {/* 🚀 VISTA DE IMPRESIÓN */}
            <div className="hidden print:block">
                {currentBaptism && <BaptismTicket baptismData={currentBaptism} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                
                {/* BARRA DE NAVEGACIÓN ENTRE BORRADORES */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                     <div className="flex items-center gap-5">
                         <div className="bg-amber-100 p-4 rounded-2xl text-amber-600 shadow-sm border border-amber-200"><User className="w-6 h-6" /></div>
                         <div>
                             <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Asentando {currentIndex + 1} de {pendingBaptisms.length}</h2>
                             <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-1">Revisión de Identidad y Registro Civil</p>
                         </div>
                     </div>

                     <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                         <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0 || isSaving}><ChevronsLeft className="w-4 h-4" /></Button>
                         <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentIndex(p => p - 1)} disabled={currentIndex === 0 || isSaving}><ChevronLeft className="w-4 h-4" /></Button>
                         <div className="px-4 font-black text-xs text-gray-600 border-x">{currentIndex + 1} / {pendingBaptisms.length}</div>
                         <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentIndex(p => p + 1)} disabled={currentIndex === pendingBaptisms.length - 1 || isSaving}><ChevronRight className="w-4 h-4" /></Button>
                         <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentIndex(pendingBaptisms.length - 1)} disabled={currentIndex === pendingBaptisms.length - 1 || isSaving}><ChevronsRight className="w-4 h-4" /></Button>
                     </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <div className="lg:col-span-1 space-y-6">
                        {/* ASIGNACIÓN DE FOLIO FÍSICO DESDE SUPABASE */}
                        <div className="bg-[#4B7BA7] rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 opacity-70 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Sello de Libro</h3>
                            <div className="space-y-5">
                                <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="text-[10px] font-bold opacity-70 uppercase">Libro Destino</span><span className="text-3xl font-black">{String(nextNumbers?.book || '---').padStart(3, '0')}</span></div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="text-[10px] font-bold opacity-70 uppercase">Folio Destino</span><span className="text-3xl font-black">{String(nextNumbers?.page || '---').padStart(3, '0')}</span></div>
                                <div className="flex justify-between items-center"><span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Acta Nº</span><span className="text-3xl font-black text-[#D4AF37]">{String(nextNumbers?.entry || '---').padStart(3, '0')}</span></div>
                            </div>
                        </div>

                        {/* BOTÓN RE-IMPRIMIR */}
                        <Button 
                            variant="outline" 
                            onClick={handleReprint}
                            className="w-full py-8 rounded-[2rem] border-gray-200 bg-white text-gray-600 font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-gray-50 flex items-center gap-3 transition-all"
                        >
                            <Printer className="w-5 h-5 text-[#4B7BA7]" /> Re-imprimir Boleta Actual
                        </Button>

                        {/* EDITAR REGISTRO CIVIL ANTES DE SELLAR */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 mb-5">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ScrollText className="w-4 h-4"/> Registro Civil</h3>
                                <label className="flex items-center gap-3 bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 cursor-pointer">
                                    <input type="checkbox" checked={includeCivilRegistry} onChange={(e) => setIncludeCivilRegistry(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500" />
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Inyectar como Nota</span>
                                </label>
                            </div>
                            <div className="space-y-4">
                                <div><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Serial</label><Input value={civilRegistryData.serialRegistro} onChange={(e) => setCivilRegistryData({...civilRegistryData, serialRegistro: e.target.value.toUpperCase()})} className="bg-gray-50 border-gray-100 rounded-xl font-bold uppercase mt-1" placeholder="Nº SERIAL" /></div>
                                <div><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Notaría/Oficina</label><Input value={civilRegistryData.oficinaRegistro} onChange={(e) => setCivilRegistryData({...civilRegistryData, oficinaRegistro: e.target.value.toUpperCase()})} className="bg-gray-50 border-gray-100 rounded-xl font-bold uppercase mt-1" placeholder="NOMBRE OFICINA" /></div>
                                <div><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Fecha Expedición</label><Input type="date" value={civilRegistryData.fechaExpedicionRegistro} onChange={(e) => setCivilRegistryData({...civilRegistryData, fechaExpedicionRegistro: e.target.value})} className="bg-gray-50 border-gray-100 rounded-xl font-bold mt-1" /></div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-[3rem] border border-gray-100 shadow-sm p-10 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none uppercase font-black text-8xl -rotate-12 select-none">Borrador</div>
                        
                        <h3 className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                            <FileText className="w-5 h-5" /> Datos del Borrador a Sellar
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <div className="md:col-span-2 flex items-center gap-5 bg-gray-50 p-6 rounded-2xl mb-4 border border-gray-100 shadow-inner">
                                <div className="w-14 h-14 bg-white rounded-[1rem] flex items-center justify-center font-black text-[#4B7BA7] shadow-sm text-2xl border uppercase">
                                    {String(currentBaptism?.sexo || 'M').charAt(0)}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-2">Sujeto Bautizado</p>
                                    <p className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">
                                        {currentBaptism?.apellidos} {currentBaptism?.nombres}
                                    </p>
                                </div>
                            </div>
                            
                            <Field label="Nº Registro Administrativo" value={currentBaptism?.numeroRegistro} highlight />
                            <Field label="Dirección de Residencia" value={currentBaptism?.direccion} highlight />
                            <Field label="Fecha Sacramento" value={currentBaptism?.fechaSacramento} />
                            <Field label="Lugar Bautismo" value={currentBaptism?.lugarBautismo} />
                            
                            {/* 🚨 AVISO DE FECHA FUTURA */}
                            {currentIsFuture && (
                                <div className="md:col-span-2 flex items-center gap-4 bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700 animate-pulse mt-4">
                                    <AlertCircle className="w-8 h-8" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del sacramento ({currentBaptism.fechaSacramento}) aún no ha ocurrido. No se puede asentar.</p>
                                    </div>
                                </div>
                            )}
                            
                            <div className="md:col-span-2 pt-4"><h4 className="text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-100 pb-2 mb-2">Filiación</h4></div>
                            <Field label="Padre" value={currentBaptism?.nombrePadre} />
                            <Field label="Madre" value={currentBaptism?.nombreMadre} />
                            <Field label="Abuelos Paternos" value={currentBaptism?.abuelosPaternos} />
                            <Field label="Abuelos Maternos" value={currentBaptism?.abuelosMaternos} />
                        </div>

                        <div className="mt-auto pt-10 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 relative z-10">
                            <Button variant="ghost" className="text-gray-400 hover:text-gray-900 font-black uppercase tracking-widest text-[10px] px-8" onClick={() => navigate('/parroquia/bautismo/sentar-registros')}>
                                <LogOut className="w-4 h-4 mr-2" /> Salir al Carrusel
                            </Button>
                            <Button 
                                className={cn(
                                    "px-10 py-7 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all transform active:scale-95 flex items-center gap-3 w-full sm:w-auto shadow-xl",
                                    currentIsFuture ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-2xl hover:shadow-yellow-500/30 text-white"
                                )}
                                onClick={handleConfirm}
                                disabled={isSaving || currentIsFuture}
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (currentIsFuture ? <Lock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                                {isSaving ? 'Sellar Registro...' : (currentIsFuture ? 'Bloqueado por Fecha' : 'Firmar y Asentar en Libro Permanente')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BaptismSeatIndividualPage;