import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { calculateNextConsecutive } from '@/services/sacramentParametersService';

const NewDecreeCorrectionPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [cloudParams, setCloudParams] = useState({});
    const [conceptos, setConceptos] = useState([]);
    
    // --- ESTADOS EXCLUSIVOS DE CANCILLERÍA ---
    const [parishesList, setParishesList] = useState([]);
    const [selectedSearchParish, setSelectedSearchParish] = useState('');
    const [chanceryNotesConfig, setChanceryNotesConfig] = useState(null);

    const [decreeData, setDecreeData] = useState({
        parroquia: '', numeroDeDecreto: '', fechaEmision: new Date().toISOString().split('T')[0],
        conceptoAnulacion: '', nombreBautizado: '', Libro: '', folio: '', numero: ''
    });

    const [foundRecord, setFoundRecord] = useState(null);
    const [targetParish, setTargetParish] = useState(null); 
    const [searchMessage, setSearchMessage] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    const [newPartida, setNewPartida] = useState({
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: '', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: '', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: ''
    });

    // 🚀 INICIALIZACIÓN (100% NUBE PARA CANCILLERÍA)
    useEffect(() => {
        const initializeData = async () => {
            if (!user) return;
            try {
                let currentDioceseId = user.dioceseId || user.diocese_id;

                if (!currentDioceseId && (user.chanceryId || user.chancery_id)) {
                    const cId = user.chanceryId || user.chancery_id;
                    const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', cId).single();
                    if (chanData) currentDioceseId = chanData.diocese_id;
                }

                // Cargar Membrete
                const entityId = user.chanceryId || user.id;
                const misDatos = getMisDatosList(entityId);
                let parishLabel = misDatos?.length > 0 ? `${misDatos[0].nombre} - ${misDatos[0].ciudad}` : `${user.dioceseName || 'CANCILLERÍA'} - COLOMBIA`;
                setDecreeData(prev => ({ ...prev, parroquia: parishLabel.toUpperCase() }));

                // Cargar Plantillas de Notas de Cancillería
                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', entityId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    setChanceryNotesConfig(chanceryParams.bautizos_params.plantillas_notas);
                }

                if (currentDioceseId) {
                    // Cargar Conceptos
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', currentDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porCorreccion' || (c.concepto && c.concepto.toLowerCase().includes('correcc'))));

                    // Cargar Parroquias de la Diócesis
                    const { data: pData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (pData) setParishesList(pData);
                }
            } catch (error) { 
                console.error("Error inicializando:", error); 
            }
        };
        initializeData();
    }, [user, getMisDatosList]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleDecreeChange = async (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: value }));

        if (['Libro', 'folio', 'numero'].includes(name)) { 
            setFoundRecord(null); 
            setTargetParish(null);
            setSearchMessage(null); 
        }

        if (name === 'nombreBautizado' && value.length > 2 && selectedSearchParish) {
            try {
                const { data } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish).ilike('nombres', `%${value}%`).limit(5);
                if (data) {
                    setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.nombres, lastName: d.apellidos })));
                    setShowSuggestions(true);
                }
            } catch (error) { setSuggestions([]); setShowSuggestions(false); }
        } else if (name === 'nombreBautizado') { 
            setSuggestions([]); setShowSuggestions(false); 
        }
    };

    const handleSuggestionClick = (record) => {
        setDecreeData(prev => ({ ...prev, nombreBautizado: `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`.trim() }));
        setShowSuggestions(false);
    };

    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));

    const getSafeValue = (obj, ...keys) => {
        for (const key of keys) { if (obj[key] !== undefined && obj[key] !== null) return obj[key]; }
        return '';
    };

    // 🚀 BÚSQUEDA INTELIGENTE EN LA PARROQUIA SELECCIONADA
    const handleSearch = async () => {
        if (!selectedSearchParish) {
            setSearchMessage({ type: 'error', text: "Debe seleccionar una Parroquia Origen." }); return;
        }

        const { Libro, folio, numero } = decreeData;
        if (!Libro || !folio || !numero) { 
            setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." }); return; 
        }

        setIsLoading(true); setSearchMessage(null); setFoundRecord(null); setTargetParish(null);

        try {
            const { data: dbRecord, error } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish)
                .eq('book_number', String(Libro).padStart(4, '0')).eq('folio', String(folio).padStart(4, '0')).eq('number', String(numero).padStart(4, '0')).maybeSingle();

            if (error) throw error;

            if (dbRecord) {
                if (dbRecord.status === 'anulada') {
                    setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA en esa parroquia." });
                } else {
                    const found = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };
                    setFoundRecord(found);
                    setTargetParish(selectedSearchParish);
                    setSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });
                    
                    if (!decreeData.nombreBautizado) {
                        setDecreeData(prev => ({ ...prev, nombreBautizado: `${dbRecord.nombres} ${dbRecord.apellidos}` }));
                    }
                    
                    // 1. Obtener parámetros de esa parroquia
                    const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();
                    if (paramsData && paramsData.bautizos_params) setCloudParams(paramsData.bautizos_params);

                    // 2. Obtener párroco activo de esa parroquia
                    let priestName = '';
                    const { data: pData } = await supabase.from('parrocos').select('payload').eq('parish_id', selectedSearchParish);
                    if (pData && pData.length > 0) {
                        const active = pData.find(r => String(r.payload.estado || r.payload.Estado) === '1');
                        if (active) {
                            priestName = `${active.payload.nombre || ''} ${active.payload.apellido || ''}`.trim();
                        }
                    }

                    // 3. Poblar Formulario
                    setNewPartida(prev => ({
                        ...prev,
                        nombres: dbRecord.nombres || '', apellidos: dbRecord.apellidos || '',
                        fechaSacramento: dbRecord.celebration_date || '', fechaNacimiento: dbRecord.fecha_nacimiento || '',
                        lugarNacimiento: dbRecord.lugar_nacimiento || '', lugarBautismo: dbRecord.lugar_bautismo || '',
                        sexo: dbRecord.sexo || '', nombrePadre: dbRecord.nombre_padre || '', nombreMadre: dbRecord.nombre_madre || '',
                        tipoUnionPadres: dbRecord.tipo_union_padres || '', abuelosPaternos: dbRecord.abuelos_paternos || '',
                        abuelosMaternos: dbRecord.abuelos_maternos || '', padrinos: dbRecord.padrinos || '',
                        ministro: dbRecord.ministro || '', daFe: priestName || dbRecord.da_fe || ''
                    }));
                }
            } else { 
                setSearchMessage({ type: 'error', text: "No se encontró ninguna partida en la parroquia seleccionada." }); 
            }
        } catch (error) { 
            setSearchMessage({ type: 'error', text: "Error conectando con la base de datos." }); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const validateForm = () => {
        if (!decreeData.numeroDeDecreto || !decreeData.conceptoAnulacion || !foundRecord || !targetParish) return false;
        return ['fechaSacramento', 'nombres', 'apellidos'].every(field => newPartida[field]);
    };

    // 🚀 EJECUCIÓN DIRECTA A SUPABASE (SIN LOCALSTORAGE NI FORM SUBMIT HTML)
    const handleSave = async () => {
        if (!validateForm()) { 
            toast({ title: "Validación", description: "Complete todos los campos requeridos y asegúrese de haber buscado la partida.", variant: "destructive" }); 
            return; 
        }
        setIsLoading(true);

        try {
            // 1. Evitar Duplicados en esa Parroquia
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'correccion')
                .eq('parish_id', targetParish).contains('payload', { decreeNumber: decreeData.numeroDeDecreto }).maybeSingle();

            if (existingDecree) {
                setIsLoading(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${decreeData.numeroDeDecreto} ya existe en esa parroquia.`, variant: "destructive" }); 
                return;
            }

            const supletorioLibro = String(cloudParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(cloudParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(cloudParams.suplementarioNumero || '1').padStart(4, '0');

            // 2. MOTOR DE NOTAS (Con Regex blindado para errores ortográficos en plantilla)
            let templateAnulada = chanceryNotesConfig?.correccion_anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].";
            let noteAnulada = templateAnulada
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[LIBRO_NUEVA[\]\)]|\[LIBRO_PARTIDA_NUEVA[\]\)]|\[LIBRO NUEVA[\]\)]/gi, supletorioLibro)
                .replace(/\[FOLIO_NUEVA[\]\)]|\[FOLIO_PARTIDA_NUEVA[\]\)]|\[FOLIO NUEVA[\]\)]/gi, supletorioFolio)
                .replace(/\[NUMERO_NUEVA[\]\)]|\[NUMERO NUEVA[\]\)]|\[NUMERO_PARTIDA_NUEVA[\]\)]/gi, supletorioNumero);

            let templateNueva = chanceryNotesConfig?.correccion_nueva || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [MINISTRO].";
            let notaSupletoriaFinal = templateNueva
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                .replace(/\[LIBRO_ANULADA\]/g, String(decreeData.Libro).padStart(4, '0'))
                .replace(/\[FOLIO_ANULADA\]/g, String(decreeData.folio).padStart(4, '0'))
                .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(decreeData.numero).padStart(4, '0'))
                .replace(/\[MINISTRO\]|\[NOMBRE_SACERDOTE\]/gi, newPartida.daFe);

            const partidaToSave = {
                ...newPartida,
                Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
                book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
                anulado: false, estado: 'permanente', status: 'seated', notaMarginal: notaSupletoriaFinal
            };

            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto, 
                decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacion, 
                observaciones: newPartida.observaciones,
                targetName: decreeData.nombreBautizado, 
                newTargetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), 
                
                fechaSacramento: newPartida.fechaSacramento, sexo: newPartida.sexo,
                fechaNacimiento: newPartida.fechaNacimiento, lugarNacimiento: newPartida.lugarNacimiento,
                nombrePadre: newPartida.nombrePadre, nombreMadre: newPartida.nombreMadre,
                tipoUnionPadres: newPartida.tipoUnionPadres, abuelosPaternos: newPartida.abuelosPaternos,
                abuelosMaternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, daFe: newPartida.daFe,

                originalPartidaId: foundRecord.id,
                originalPartidaSummary: { 
                    book: decreeData.Libro, page: decreeData.folio, entry: decreeData.numero,
                    nombres: foundRecord.nombres || foundRecord.first_name || '', apellidos: foundRecord.apellidos || foundRecord.last_name || ''
                },
                newPartidaSummary: { 
                    book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero,
                    nombres: newPartida.nombres, apellidos: newPartida.apellidos
                }
            };

            // 3. Marcar original como anulada en Supabase
            await supabase.from('baptisms').update({ 
                status: 'anulada', nota_marginal: noteAnulada, 
                raw_data: { ...foundRecord, notaMarginal: noteAnulada, anulado: true, status: 'anulada' } 
            }).eq('id', foundRecord.id);

            // 4. Calcular e incrementar consecutivos correctamente con el motor
            const siguientesSupletorios = calculateNextConsecutive(
                cloudParams.suplementarioNumero,
                cloudParams.suplementarioFolio,
                cloudParams.suplementarioLibro,
                cloudParams.suplementarioPartidas || 2, 
                cloudParams.suplementarioReiniciar || false
            );

            const newParams = { 
                ...cloudParams, 
                suplementarioNumero: siguientesSupletorios.numero,
                suplementarioFolio: siguientesSupletorios.folio,
                suplementarioLibro: siguientesSupletorios.libro
            };

            await supabase.from('parish_parameters').upsert({ 
                parish_id: targetParish, 
                bautizos_params: newParams 
            }, { onConflict: 'parish_id' });

            // 5. Crear Nueva Partida Supletoria
            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: targetParish,
                book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
                celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos, sexo: newPartida.sexo,
                fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, lugar_bautismo: newPartida.lugarBautismo,
                nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, tipo_union_padres: newPartida.tipoUnionPadres, 
                abuelos_paternos: newPartida.abuelosPaternos, abuelos_maternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, da_fe: newPartida.daFe, status: 'seated', nota_marginal: notaSupletoriaFinal,
                raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            // 6. Crear Decreto Final
            payloadDecree.newPartidaId = newBap.id;
            await supabase.from('decretos').insert([{ parish_id: targetParish, tipo: 'correccion', payload: payloadDecree }]);

            setIsLoading(false);
            toast({ title: "Éxito", description: "Decreto guardado remotamente en la Parroquia.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-correction/view');
            
        } catch (error) {
            setIsLoading(false); console.error("Error al guardar:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="max-w-6xl mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/chancery/decree-correction/view')} className="rounded-full"><ArrowLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif">Decreto de Corrección Magistral</h1>
                            <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold border border-blue-200">ACCESO CANCILLERÍA</span>
                                Inyección remota en libros parroquiales
                            </p>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="bautizos" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-10 bg-gray-100 p-1 rounded-2xl h-14">
                        <TabsTrigger value="bautizos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmaciones" disabled className="opacity-30 rounded-xl font-bold uppercase text-[10px] tracking-widest">Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonios" disabled className="opacity-30 rounded-xl font-bold uppercase text-[10px] tracking-widest">Matrimonios</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautizos" className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" /><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">01. Información del Decreto</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-3">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Entidad Emisora</label>
                                    <Input value={decreeData.parroquia} readOnly className="bg-gray-100 font-bold text-gray-600" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Número de Decreto</label>
                                    <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej: 024-2025" className="py-6 font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Fecha de Emisión</label>
                                    <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className="py-6" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Concepto</label>
                                    <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
                                        <option value="">SELECCIONE...</option>
                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="mx-8 mb-8 p-8 bg-[#4B7BA7]/5 rounded-3xl border border-[#4B7BA7]/10">
                                <h4 className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Localizar Partida Original para Anulación Remota
                                </h4>
                                
                                <div className="mb-6">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Parroquia Origen del Registro <span className="text-red-500">*</span></label>
                                    <select 
                                        value={selectedSearchParish} 
                                        onChange={(e) => {
                                            setSelectedSearchParish(e.target.value);
                                            setSuggestions([]); setFoundRecord(null); setSearchMessage(null);
                                        }} 
                                        className="w-full h-[50px] px-4 border border-blue-200 rounded-xl text-sm font-bold bg-white uppercase outline-none focus:ring-2 focus:ring-blue-500/50 text-blue-900 shadow-sm"
                                    >
                                        <option value="">-- SELECCIONE LA PARROQUIA DE LA DIÓCESIS --</option>
                                        {parishesList.map(p => <option key={p.id} value={p.id}>{p.name} - {p.city}</option>)}
                                    </select>
                                </div>

                                <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-opacity duration-300 ${!selectedSearchParish ? 'opacity-40 pointer-events-none' : ''}`} ref={wrapperRef}>
                                    <div className="md:col-span-2 relative">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nombre Bautizado</label>
                                        <Input name="nombreBautizado" value={decreeData.nombreBautizado} onChange={handleDecreeChange} autoComplete="off" />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                                                {suggestions.map((r, i) => <div key={i} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm font-bold text-gray-700" onClick={() => handleSuggestionClick(r)}>{r.firstName} {r.lastName}</div>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Libro</label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className="text-center font-mono font-bold" /></div>
                                    <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Folio</label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className="text-center font-mono font-bold" /></div>
                                    <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Número</label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className="text-center font-mono font-bold" /></div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button onClick={handleSearch} disabled={isLoading || !selectedSearchParish} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] px-8 h-[45px]">
                                        {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />} 
                                        {isLoading ? 'Buscando...' : 'Buscar en Parroquia'}
                                    </Button>
                                </div>
                                {searchMessage && (
                                    <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {searchMessage.text.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-500 ${!foundRecord ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-green-600" /><h3 className="text-xs font-black text-green-600 uppercase tracking-widest">02. Datos Corregidos para Libro Supletorio</h3>
                            </div>
                            <div className="p-10 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Apellidos</label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Nombres</label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo</label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} className="py-6" /></div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Sexo</label>
                                        <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase">
                                            <option value="">SELECCIONE...</option><option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nacimiento</label><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChangeUpper} /></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                                    <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
                                        <Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
                                    </div>
                                    <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4">
                                        <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
                                        <Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Paternos</label><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChangeUpper} /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Maternos</label><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChangeUpper} /></div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Unión</label>
                                        <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChangeRaw} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase">
                                            <option value="">SELECCIONE...</option><option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Padrinos</label><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Sacerdote Celebrante</label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} className="py-6 font-black text-blue-900" /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Da Fe (Firma Local Parroquia)</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold text-gray-500 bg-gray-50" /></div>
                                </div>

                                <div className="space-y-2 border-t pt-10">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Observaciones del Decreto (Opcional)</label>
                                    <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChangeUpper} rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase font-bold text-gray-700 bg-amber-50" placeholder="OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..." />
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-8 right-8 z-50">
                            <Button onClick={handleSave} disabled={!foundRecord || isLoading} className="bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-2xl text-white px-12 py-8 rounded-full font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                                {isLoading ? <Loader2 className="animate-spin w-5 h-5 mr-3" /> : <Save className="w-6 h-6 mr-3" />} Ejecutar Sincronización Remota
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeCorrectionPage;