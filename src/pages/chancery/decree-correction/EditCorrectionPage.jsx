import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, Loader2, Search, Trash2, ArrowLeft, History, BookOpen, Calendar, User, Fingerprint, PenTool, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete'; 
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService';

const EditCorrectionPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { getMisDatosList, getCiudadesList, getParrocos, obtenerNotasAlMargen } = useAppData();

    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [originalPayload, setOriginalPayload] = useState(null);
    const [foundRecord, setFoundRecord] = useState(null);
    const [auxiliares, setAuxiliares] = useState({ ciudades: [], ministros: [] });
    const [chanceryNotesConfig, setChanceryNotesConfig] = useState(null);

    const [decreeData, setDecreeData] = useState({ parroquia: '', decreeNumber: '', decreeDate: '', targetName: '', conceptoAnulacionId: '' });
    const [newPartida, setNewPartida] = useState({
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: 'MASCULINO', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: '', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: '', book_number: '', page_number: '', entry_number: '', parishId: ''
    });

    const decreeId = searchParams.get('id');

    useEffect(() => {
        const loadDecreeData = async () => {
            if (!user) return;
            setIsLoading(true);

            try {
                let targetDioceseId = user.dioceseId || user.diocese_id;
                if (!targetDioceseId && (user.chanceryId || user.chancery_id)) {
                    const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', user.chanceryId || user.chancery_id).single();
                    if (chanData) targetDioceseId = chanData.diocese_id;
                }

                // Cargar Plantillas de Notas de Cancillería
                const entityId = user.chanceryId || user.id;
                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', entityId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    setChanceryNotesConfig(chanceryParams.bautizos_params.plantillas_notas);
                }

                if (targetDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', targetDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porCorreccion' || (c.concepto && c.concepto.toLowerCase().includes('correcc'))));
                }

                const { data: parishesData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', targetDioceseId);
                const pIds = parishesData ? parishesData.map(p => p.id) : [];

                if (pIds.length > 0) {
                    const { data: decData } = await supabase.from('decretos').select('*').eq('tipo', 'correccion').in('parish_id', pIds).order('created_at', { ascending: false });
                    if (decData) {
                        const formattedData = decData.map(item => ({ 
                            id: item.id, targetParishId: item.parish_id,
                            targetParishName: parishesData.find(p => p.id === item.parish_id)?.name || 'Sede Central',
                            ...item.payload 
                        }));
                        setDecrees(formattedData);
                    }
                }

                if (decreeId) {
                    const { data: decree, error } = await supabase.from('decretos').select('*').eq('id', decreeId).single();
                    if (error) throw error;

                    const payload = typeof decree.payload === 'string' ? JSON.parse(decree.payload) : decree.payload;
                    const parishId = decree.parish_id;
                    setOriginalPayload(payload);
                    setSelectedDecreeId(decreeId);

                    // 🧠 MAGIA HOMOLOGADA: Búsqueda Inteligente de la Partida Original
                    const pad = (num) => String(num).padStart(4, '0');
                    let origDataRaw = {};
                    if (payload.originalPartidaSummary?.book || payload.originalPartidaSummary?.Libro) {
                        const b = payload.originalPartidaSummary.book || payload.originalPartidaSummary.Libro;
                        const p = payload.originalPartidaSummary.page || payload.originalPartidaSummary.folio;
                        const e = payload.originalPartidaSummary.entry || payload.originalPartidaSummary.numero;
                        
                        const { data: origData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', parishId).eq('book_number', pad(b)).eq('folio', pad(p)).eq('number', pad(e)).maybeSingle();
                        if (origData) {
                            origDataRaw = origData.raw_data || {};
                            setFoundRecord({ ...origData.raw_data, id: origData.id });
                        }
                    }

                    const parishObj = parishesData?.find(p => p.id === parishId);
                    setDecreeData({
                        parroquia: parishObj ? `${parishObj.name} - ${parishObj.city}` : 'Parroquia',
                        decreeNumber: payload.decreeNumber || payload.numeroDecreto || '',
                        decreeDate: payload.decreeDate || payload.fechaEmision || '',
                        conceptoAnulacionId: payload.conceptoAnulacionId || payload.conceptoAnulacion || '',
                        targetName: payload.targetName || payload.nombreBautizado || '',
                        Libro: payload.originalPartidaSummary?.book || payload.originalPartidaSummary?.Libro || '',
                        folio: payload.originalPartidaSummary?.page || payload.originalPartidaSummary?.folio || '',
                        numero: payload.originalPartidaSummary?.entry || payload.originalPartidaSummary?.numero || ''
                    });

                    const listaCruda = getCiudadesList(parishId) || [];
                    const parrocosList = getParrocos(parishId) || [];
                    setAuxiliares({
                        ciudades: listaCruda.map(c => (c.nombre || '').toUpperCase()),
                        ministros: parrocosList.map(s => `${s.nombre} ${s.apellido || ''}`.trim().toUpperCase())
                    });

                    const bd = payload.datosNuevaPartida || payload.newPartidaSummary || {};
                    
                    setNewPartida({
                        parishId: parishId,
                        lugarBautismo: payload.lugarBautismo || bd.lugarBautismo || origDataRaw.lugarBautismo || origDataRaw.lugar_bautismo || '',
                        fechaSacramento: payload.fechaSacramento || bd.fechaSacramento || origDataRaw.fechaSacramento || origDataRaw.celebration_date || '',
                        apellidos: payload.apellidos || bd.apellidos || origDataRaw.apellidos || origDataRaw.lastName || '',
                        nombres: payload.nombres || bd.nombres || origDataRaw.nombres || origDataRaw.firstName || '',
                        fechaNacimiento: payload.fechaNacimiento || bd.fechaNacimiento || origDataRaw.fechaNacimiento || '',
                        lugarNacimiento: payload.lugarNacimiento || bd.lugarNacimiento || origDataRaw.lugarNacimiento || origDataRaw.lugarNacimientoDetalle || '',
                        sexo: payload.sexo || bd.sexo || bd.sex || origDataRaw.sexo || 'MASCULINO',
                        nombrePadre: payload.nombrePadre || bd.nombrePadre || origDataRaw.nombrePadre || origDataRaw.fatherName || '',
                        nombreMadre: payload.nombreMadre || bd.nombreMadre || origDataRaw.nombreMadre || origDataRaw.motherName || '',
                        tipoUnionPadres: payload.tipoUnionPadres || bd.tipoUnionPadres || origDataRaw.tipoUnionPadres || origDataRaw.tipohijo || 'MATRIMONIO CATÓLICO',
                        abuelosPaternos: payload.abuelosPaternos || bd.abuelosPaternos || origDataRaw.abuelosPaternos || origDataRaw.paternalGrandparents || '',
                        abuelosMaternos: payload.abuelosMaternos || bd.abuelosMaternos || origDataRaw.abuelosMaternos || origDataRaw.maternalGrandparents || '',
                        padrinos: payload.padrinos || bd.padrinos || origDataRaw.padrinos || origDataRaw.godparents || '',
                        ministro: payload.ministro || bd.ministro || origDataRaw.ministro || origDataRaw.minister || '',
                        daFe: payload.daFe || bd.daFe || bd.ministerFaith || origDataRaw.daFe || '',
                        observaciones: payload.observaciones || '',
                        book_number: bd.book || bd.book_number || '',
                        page_number: bd.page || bd.page_number || '',
                        entry_number: bd.entry || bd.entry_number || ''
                    });
                }
            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/chancery/decree-correction/view');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, decreeId, getCiudadesList, getParrocos]);

    const handleDecreeChange = (e) => setDecreeData(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleNewPartidaChange = handleNewPartidaChangeUpper; 
    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);

        try {
            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const targetParish = newPartida.parishId;
            const supSum = originalPayload?.newPartidaSummary;
            
            // Usamos la info original asegurando que los consecutivos queden estáticos al editar
            const currentBook = pad(supSum?.book || supSum?.Libro || newPartida.book_number);
            const currentPage = pad(supSum?.page || supSum?.folio || newPartida.page_number);
            const currentEntry = pad(supSum?.entry || supSum?.numero || newPartida.entry_number);

            const reemplazarVariables = (template) => {
                if (!template) return "";
                return template
                    .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                    .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                    .replace(/\[LIBRO_NUEVA[\]\)]|\[LIBRO_PARTIDA_NUEVA[\]\)]|\[LIBRO NUEVA[\]\)]/gi, currentBook)
                    .replace(/\[FOLIO_NUEVA[\]\)]|\[FOLIO_PARTIDA_NUEVA[\]\)]|\[FOLIO NUEVA[\]\)]/gi, currentPage)
                    .replace(/\[NUMERO_NUEVA[\]\)]|\[NUMERO_PARTIDA_NUEVA[\]\)]|\[NUMERO NUEVA[\]\)]/gi, currentEntry)
                    .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                    .replace(/\[LIBRO_ANULADA\]/g, pad(decreeData.Libro))
                    .replace(/\[FOLIO_ANULADA\]/g, pad(decreeData.folio))
                    .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, pad(decreeData.numero))
                    .replace(/\[MINISTRO\]|\[NOMBRE_SACERDOTE\]/gi, newPartida.daFe);
            };

            const templateAnulada = chanceryNotesConfig?.correccion_anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].";
            const noteAnulada = reemplazarVariables(templateAnulada);

            const templateNueva = chanceryNotesConfig?.correccion_nueva || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [MINISTRO].";
            const notaSupletoriaFinal = reemplazarVariables(templateNueva);

            // 1. Actualizar Partida Original
            if (foundRecord) {
                const oldRawData = { ...foundRecord };
                oldRawData.notaMarginal = noteAnulada;
                oldRawData.estado = "anulada";
                oldRawData.status = "anulada";
                oldRawData.isAnnulled = true;
                oldRawData.annulmentDate = decreeData.fechaEmision;
                oldRawData.annulmentDecree = decreeData.numeroDeDecreto;
                oldRawData.conceptoAnulacionId = decreeData.conceptoAnulacionId || decreeData.conceptoAnulacion;
                oldRawData.tipoNotaAlMargen = "porCorreccion.anulada";

                await supabase.from('baptisms').update({ status: 'anulada', nota_marginal: noteAnulada, raw_data: oldRawData }).eq('id', foundRecord.id);
            }

            // 2. Actualizar Partida Supletoria
            const { data: supData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', targetParish).eq('book_number', currentBook).eq('folio', currentPage).eq('number', currentEntry).maybeSingle();

            if (supData) {
                const updatedRaw = {
                    ...supData.raw_data, ...newPartida,
                    nombres: newPartida.nombres, apellidos: newPartida.apellidos, fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento, lugarn: newPartida.lugarNacimiento, sex: newPartida.sexo, padre: newPartida.nombrePadre, madre: newPartida.nombreMadre, tipohijo: newPartida.tipoUnionPadres, godparents: newPartida.padrinos, ministro: newPartida.ministro, dafe: newPartida.daFe, notaMarginal: notaSupletoriaFinal
                };
                
                await supabase.from('baptisms').update({ 
                    celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos,
                    sexo: newPartida.sexo, fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, 
                    lugar_bautismo: newPartida.lugarBautismo, nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, 
                    padrinos: newPartida.padrinos, ministro: newPartida.ministro, da_fe: newPartida.daFe, tipo_union_padres: newPartida.tipoUnionPadres, 
                    nota_marginal: notaSupletoriaFinal, raw_data: updatedRaw
                }).eq('id', supData.id);
            }

            // 3. Actualizar Decreto
            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.numeroDeDecreto, decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacionId || decreeData.conceptoAnulacion,
                targetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: currentBook, page: currentPage, entry: currentEntry },
                newPartidaSummary: { book: currentBook, page: currentPage, entry: currentEntry, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
            };

            await supabase.from('decretos').update({ payload: newPayload }).eq('id', selectedDecreeId);

            toast({ title: "Guardado Exitoso", description: "La corrección se actualizó en la Parroquia Destino.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-correction/view');

        } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const targetParishId = newPartida.parishId;
            
            // ⚠️ FIX CLAVE: Extraer los datos a borrar del payload original igual que en la Parroquia
            const supSum = originalPayload?.newPartidaSummary;

            if (foundRecord) {
                const cleanedRaw = { ...foundRecord };
                delete cleanedRaw.notaMarginal; delete cleanedRaw.anulado; delete cleanedRaw.isAnnulled;
                cleanedRaw.status = 'seated'; cleanedRaw.estado = 'permanente';
                await supabase.from('baptisms').update({ status: 'seated', nota_marginal: null, raw_data: cleanedRaw }).eq('id', foundRecord.id);
            }

            if (supSum) {
                const delBook = pad(supSum.book || supSum.Libro);
                const delPage = pad(supSum.page || supSum.folio);
                const delEntry = pad(supSum.entry || supSum.numero);

                await supabase.from('baptisms').delete()
                    .eq('parish_id', targetParishId).eq('book_number', delBook).eq('folio', delPage).eq('number', delEntry);
                
                try {
                    const { data: paramsData } = await supabase.from('parish_parameters')
                        .select('bautizos_params').eq('parish_id', targetParishId).maybeSingle();

                    if (paramsData && paramsData.bautizos_params) {
                        const cloudParams = paramsData.bautizos_params;
                        
                        const previosSupletorios = calculatePreviousConsecutive(
                            cloudParams.suplementarioNumero,
                            cloudParams.suplementarioFolio,
                            cloudParams.suplementarioLibro,
                            cloudParams.suplementarioPartidas || 2,
                            cloudParams.suplementarioReiniciar || false
                        );

                        if (parseInt(delEntry, 10) === parseInt(previosSupletorios.numero, 10)) {
                            const newParams = { 
                                ...cloudParams, 
                                suplementarioNumero: pad(previosSupletorios.numero), // FORZANDO LOS CEROS A LA BD
                                suplementarioFolio: pad(previosSupletorios.folio),   // FORZANDO LOS CEROS A LA BD
                                suplementarioLibro: pad(previosSupletorios.libro)
                            };

                            await supabase.from('parish_parameters').update({ bautizos_params: newParams }).eq('parish_id', targetParishId);
                        }
                    }
                } catch (err) { console.error("Error revirtiendo el consecutivo en la nube:", err); }
            }

            await supabase.from('decretos').delete().eq('id', selectedDecreeId);

            toast({ title: "Eliminado", description: "Decreto removido y consecutivos restaurados remotamente.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-correction/view');
        } catch (e) { 
            toast({ title: "Error", description: "Fallo al restaurar y eliminar.", variant: "destructive" }); 
        } finally { 
            setIsSubmitting(false); setShowDeleteModal(false); 
        }
    };

    const filteredDecrees = decrees.filter(d => (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-blue-500" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <datalist id="ciudades-list">{auxiliares.ciudades?.map((c, i) => <option key={i} value={c} />)}</datalist>
            <datalist id="ministros-list">{auxiliares.ministros?.map((m, i) => <option key={i} value={m} />)}</datalist>

            <div className="max-w-[1400px] mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/chancery/decree-correction/view')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Editor de Corrección</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Modificación del Asiento Supletorio Remoto en Nube</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-180px)] min-h-[600px]">
                    <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                <input placeholder="Buscar decreto..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredDecrees.length === 0 ? (<p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center py-8">No hay decretos.</p>) : (
                                filteredDecrees.map((decree) => (
                                    <button key={decree.id} onClick={() => navigate(`/chancery/decree-correction/edit?id=${decree.id}`)} className={cn("w-full text-left p-4 rounded-2xl transition-all border group", selectedDecreeId === decree.id ? "bg-blue-50 border-blue-200 ring-1 ring-blue-300 shadow-sm" : "bg-white border-transparent hover:border-gray-200 text-gray-600")}>
                                        <div className="font-black text-gray-800 flex justify-between items-center"><span className={cn("font-mono text-sm tracking-tighter", selectedDecreeId === decree.id ? "text-blue-700" : "")}>{decree.decreeNumber || decree.numeroDecreto}</span></div>
                                        <div className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === decree.id ? "text-blue-900" : "text-gray-400")}>{decree.targetName || decree.nombres}</div>
                                        <div className={cn("text-[9px] mt-1 uppercase truncate", selectedDecreeId === decree.id ? "text-blue-500" : "text-gray-300")}>{decree.targetParishName}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-[#D4AF37] to-blue-500"></div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                            {!selectedDecreeId ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                                    <History className="w-16 h-16" />
                                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto de la lista</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSave} className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
                                    <section>
                                        <SectionHeader number="01" title="Decreto Maestro (Corrección)" icon={FileText} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="col-span-3"><label className={labelClass}>Parroquia Destino</label><input readOnly value={decreeData.parroquia} className={`${inputClass} bg-blue-50 border-blue-200 text-blue-700`} /></div>
                                            <div><label className={labelClass}>Número de Decreto</label><input name="decreeNumber" value={decreeData.decreeNumber} onChange={handleDecreeChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Fecha Emisión</label><input type="date" name="decreeDate" value={decreeData.decreeDate} onChange={handleDecreeChange} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Concepto Anulación</label>
                                                <select name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className={inputClass}>
                                                    <option value="">SELECCIONE CONCEPTO...</option>
                                                    {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="mx-8 mb-8 p-6 bg-red-50/50 rounded-2xl border border-red-100">
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertCircle className="w-4 h-4 text-red-500" />
                                            <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Partida Original Anulada (Lectura Remota)</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Titular</label><Input value={originalPayload?.targetName || '---'} readOnly className="bg-white/50 border-red-100 text-gray-500 font-bold uppercase" /></div>
                                            <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Libro</label><Input value={decreeData.Libro} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                            <div className="space-y-1 flex gap-2">
                                                <div className="flex-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Folio</label><Input value={decreeData.folio} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                                <div className="flex-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Número</label><Input value={decreeData.numero} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                            </div>
                                        </div>
                                    </div>

                                    <section>
                                        <SectionHeader number="02" title="Ubicación Nueva Partida" icon={BookOpen} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                            <div><label className={labelClass}>Libro (Supletorio)</label><input readOnly name="book_number" value={newPartida.book_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-blue-700 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Folio (Supletorio)</label><input readOnly name="page_number" value={newPartida.page_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Acta (Supletorio)</label><input readOnly name="entry_number" value={newPartida.entry_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="03" title="Identidad Corregida" icon={User} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Apellidos</label><input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                            <div><label className={labelClass}>Nombres</label><input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div>
                                                <label className={labelClass}>Sexo</label>
                                                <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className={inputClass}>
                                                    <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                                </select>
                                            </div>
                                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Lugar de Nacimiento</label>
                                                <CityAutocomplete name="placeOfBirth" value={newPartida.lugarNacimiento} onChange={handleCityChange} cities={auxiliares.ciudades} className={inputClass} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-8">
                                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} className={inputClass} /></div>
                                            <div><label className={labelClass}>Lugar de Bautismo</label><input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="04" title="Filiación y Genealogía" icon={Fingerprint} />
                                        <div className="mb-8">
                                            <label className={labelClass}>Tipo de Unión de Padres</label>
                                            <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChangeRaw} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                                <input name="nombrePadre" placeholder="NOMBRE DEL PADRE" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} className={inputClass} />
                                                <textarea name="abuelosPaternos" placeholder="ABUELOS PATERNOS" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChangeUpper} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                            <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                                <input name="nombreMadre" placeholder="NOMBRE DE LA MADRE" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} className={inputClass} />
                                                <textarea name="abuelosMaternos" placeholder="ABUELOS MATERNOS" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChangeUpper} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="05" title="Ministro y Autoridad" icon={PenTool} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" list="ministros-list" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} className={`${inputClass} border-l-8 border-l-blue-500`} /></div>
                                            <div><label className={labelClass}>Firma (Da Fe)</label><input name="daFe" required list="ministros-list" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                        </div>
                                        <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} className={`${inputClass} py-5`} /></div>
                                    </section>

                                    <div className="flex justify-between gap-4 border-t border-gray-100 pt-12">
                                        <Button type="button" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting} className="px-10 py-8 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 font-black uppercase text-[10px] transition-all"><Trash2 className="w-5 h-5 mr-3"/> Revertir Corrección Remota</Button>
                                        <div className="flex gap-3">
                                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Cancelar</Button>
                                            <Button type="button" onClick={handleSave} disabled={isSubmitting || isLoading} className="bg-gradient-to-r from-blue-600 to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Sincronizar Cambios
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <ConfirmationDialog 
                    isOpen={showDeleteModal}
                    title="Restaurar Partida Original y Eliminar"
                    message="La partida original recuperará su validez canónica remotamente (se borrará su anulación). El decreto será eliminado de la nube y la partida supletoria será destruida."
                    onConfirm={handleDelete}
                    onClose={() => setShowDeleteModal(false)}
                    variant="destructive"
                    confirmText="Sí, Ejecutar Restauración"
                />
            </div>
        </DashboardLayout>
    );
};

export default EditCorrectionPage;