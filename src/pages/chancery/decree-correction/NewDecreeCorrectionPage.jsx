import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2, MapPin, ShieldCheck, BookOpen, Calendar, User, Fingerprint, PenTool } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete';

const NewDecreeCorrectionPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, createNotification, getCiudadesList, getParrocos } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [targetDioceseId, setTargetDioceseId] = useState(null);
    const [conceptos, setConceptos] = useState([]);
    
    // LISTAS AUXILIARES DINÁMICAS (Cambian al seleccionar Parroquia)
    const [auxiliares, setAuxiliares] = useState({ ciudades: [], ministros: [] });
    const [parishesList, setParishesList] = useState([]);
    const [selectedSearchParish, setSelectedSearchParish] = useState('');

    const [decreeData, setDecreeData] = useState({ 
        parroquia: '', numeroDeDecreto: '', fechaEmision: new Date().toISOString().split('T')[0], conceptoAnulacion: '', nombreBautizado: '', Libro: '', folio: '', numero: '' 
    });
    
    const [foundRecord, setFoundRecord] = useState(null);
    const [targetParishNameStr, setTargetParishNameStr] = useState('');
    const [searchMessage, setSearchMessage] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    const [newPartida, setNewPartida] = useState({ 
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: '', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: '', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: '', Libro: '', folio: '', numero: '' 
    });

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
                setTargetDioceseId(currentDioceseId);

                const entityId = user.chanceryId || user.id;
                const misDatosList = getMisDatosList(entityId);
                let entityLabel = '';
                if (misDatosList && misDatosList.length > 0) {
                    const dato = misDatosList[0];
                    const nombre = (dato.nombre || dato.nombreCancilleria || user.dioceseName || 'CANCILLERÍA').toUpperCase();
                    const ciudad = (dato.ciudad || user.city || 'BARRANQUILLA').toUpperCase();
                    entityLabel = `${nombre} - ${ciudad}, COLOMBIA`;
                } else {
                    entityLabel = `${(user.dioceseName || 'CANCILLERÍA').toUpperCase()} - BARRANQUILLA, COLOMBIA`;
                }
                setDecreeData(prev => ({ ...prev, parroquia: entityLabel }));

                if (currentDioceseId) {
                    const { data: conceptosData } = await supabase.from('conceptos_anulacion').select(`id, codigo, concepto, tipo, chancelleries!inner ( diocese_id )`).eq('chancelleries.diocese_id', currentDioceseId).ilike('tipo', 'porCorreccion').order('codigo', { ascending: true });
                    if (conceptosData) setConceptos(conceptosData);

                    const { data: parroquiasData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (parroquiasData) setParishesList(parroquiasData);
                }
            } catch (error) { console.error("Error inicializando:", error); }
        };
        initializeData();
    }, [user, getMisDatosList]);

    // EFECTO DINÁMICO PARA CARGAR CIUDADES Y PADRES DE LA PARROQUIA SELECCIONADA
    useEffect(() => {
        if (selectedSearchParish) {
            const listaCiudadesCruda = getCiudadesList(selectedSearchParish) || [];
            const parrocosList = getParrocos(selectedSearchParish) || [];
            setAuxiliares({
                ciudades: listaCiudadesCruda.map(c => (c.nombre || '').toUpperCase()),
                ministros: parrocosList.map(s => `${s.nombre} ${s.apellido || ''}`.trim().toUpperCase())
            });
        }
    }, [selectedSearchParish, getCiudadesList, getParrocos]);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const getSafeValue = (obj, ...keys) => {
        for (const key of keys) { if (obj[key] !== undefined && obj[key] !== null) return obj[key]; }
        return '';
    };

    const handleDecreeChange = async (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: value.toUpperCase() }));
        
        if (['Libro', 'folio', 'numero'].includes(name)) {
            setFoundRecord(null); setTargetParishNameStr(''); setSearchMessage(null);
        }

        if (name === 'nombreBautizado') {
            if (!selectedSearchParish) return; 
            if (value.length > 2) {
                try {
                    const { data, error } = await supabase.from('baptisms').select('id, raw_data, first_name, last_name').eq('parish_id', selectedSearchParish).ilike('first_name', `%${value}%`).limit(5);
                    if (!error && data) {
                        setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.first_name, lastName: d.last_name })));
                        setShowSuggestions(true);
                    }
                } catch (error) { setSuggestions([]); setShowSuggestions(false); }
            } else { setSuggestions([]); setShowSuggestions(false); }
        }
    };

    const handleSuggestionClick = (record) => {
        const fullName = `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`.toUpperCase();
        setDecreeData(prev => ({ ...prev, nombreBautizado: fullName }));
        setShowSuggestions(false);
    };

    const handleNewPartidaChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'padrinos', 'ministro', 'daFe', 'lugarBautismo'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setNewPartida(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleSearch = async () => {
        if (!selectedSearchParish) { setSearchMessage({ type: 'error', text: "Seleccione una parroquia primero." }); return; }
        const { Libro, folio, numero } = decreeData;
        if (!Libro || !folio || !numero) { setSearchMessage({ type: 'error', text: "Ingrese Libro, Folio y Número." }); return; }

        setIsLoading(true); setSearchMessage(null); setFoundRecord(null);

        try {
            const formattedBook = String(Libro).padStart(4, '0');
            const formattedPage = String(folio).padStart(4, '0');
            const formattedEntry = String(numero).padStart(4, '0');

            const { data: dbRecord, error } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish).eq('book_number', formattedBook).eq('page_number', formattedPage).eq('entry_number', formattedEntry).maybeSingle();

            if (error) throw error;

            if (dbRecord) {
                if (dbRecord.status === 'anulada') {
                    setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA en su parroquia." });
                } else {
                    const found = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };
                    const parishObj = parishesList.find(p => p.id === selectedSearchParish);
                    setTargetParishNameStr(parishObj ? `${parishObj.name} - ${parishObj.city}`.toUpperCase() : 'PARROQUIA');
                    setFoundRecord(found);
                    setSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });
                    
                    const foundName = `${dbRecord.first_name || found.nombres || ''} ${dbRecord.last_name || found.apellidos || ''}`.trim().toUpperCase();
                    setDecreeData(prev => ({ ...prev, targetName: foundName, nombreBautizado: foundName }));
                    
                    let supletorioLibro = '0001', supletorioFolio = '0001', supletorioNumero = '0001';
                    const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();
                    if (paramsData && paramsData.bautizos_params) {
                        supletorioLibro = String(paramsData.bautizos_params.suplementarioLibro || '1').padStart(4, '0');
                        supletorioFolio = String(paramsData.bautizos_params.suplementarioFolio || '1').padStart(4, '0');
                        supletorioNumero = String(paramsData.bautizos_params.suplementarioNumero || '1').padStart(4, '0');
                    }

                    const rawSex = String(dbRecord.gender || getSafeValue(found, 'sex', 'sexo', 'genero')).toUpperCase();
                    let mappedSex = '';
                    if (rawSex === '2' || rawSex === 'FEMENINO' || rawSex === 'F') mappedSex = 'FEMENINO';
                    else if (rawSex === '1' || rawSex === 'MASCULINO' || rawSex === 'M') mappedSex = 'MASCULINO';
                    else mappedSex = rawSex; 

                    const rawUnion = String(dbRecord.tipo_union_padres || getSafeValue(found, 'tipoUnionPadres', 'tipohijo') || '').toUpperCase();
                    let mappedUnion = '';
                    if (rawUnion === '1' || rawUnion.includes('CATÓLICO') || rawUnion.includes('CATOLICO')) mappedUnion = 'MATRIMONIO CATÓLICO';
                    else if (rawUnion === '2' || rawUnion.includes('CIVIL')) mappedUnion = 'MATRIMONIO CIVIL';
                    else if (rawUnion === '3' || rawUnion.includes('LIBRE')) mappedUnion = 'UNIÓN LIBRE';
                    else if (rawUnion === '4' || rawUnion.includes('SOLTERA')) mappedUnion = 'MADRE SOLTERA';
                    else if (rawUnion === '5' || rawUnion.includes('OTRO')) mappedUnion = 'OTRO CASO';
                    else mappedUnion = rawUnion; 

                    setNewPartida({
                        nombres: (dbRecord.first_name || getSafeValue(found, 'firstName', 'nombres')).toUpperCase(),
                        apellidos: (dbRecord.last_name || getSafeValue(found, 'lastName', 'apellidos')).toUpperCase(),
                        fechaNacimiento: dbRecord.birth_date || getSafeValue(found, 'birthDate', 'fechaNacimiento', 'fecnac'),
                        fechaSacramento: dbRecord.sacrament_date || getSafeValue(found, 'sacramentDate', 'fechaSacramento', 'fecbau'),
                        lugarNacimiento: (dbRecord.birth_place || getSafeValue(found, 'lugarNacimientoDetalle', 'lugarNacimiento', 'lugarn', 'lugnac')).toUpperCase(),
                        lugarBautismo: (dbRecord.sacrament_place || getSafeValue(found, 'lugarBautismo', 'lugbau', 'lugarBautismoDetalle')).toUpperCase(),
                        sexo: mappedSex,
                        nombrePadre: (dbRecord.father_name || getSafeValue(found, 'fatherName', 'nombrePadre', 'padre')).toUpperCase(),
                        nombreMadre: (dbRecord.mother_name || getSafeValue(found, 'motherName', 'nombreMadre', 'madre')).toUpperCase(),
                        tipoUnionPadres: mappedUnion,
                        abuelosPaternos: getSafeValue(found, 'paternalGrandparents', 'abuelosPaternos', 'abuepat').toUpperCase(),
                        abuelosMaternos: getSafeValue(found, 'maternalGrandparents', 'abuelosMaternos', 'abuemat').toUpperCase(),
                        padrinos: Array.isArray(found.godparents) ? found.godparents.map(g => g.name).join(', ').toUpperCase() : getSafeValue(found, 'godparents', 'padrinos').toUpperCase(),
                        ministro: (dbRecord.minister || getSafeValue(found, 'minister', 'ministro')).toUpperCase(),
                        daFe: (getSafeValue(found, 'ministerFaith', 'daFe', 'dafe')).toUpperCase(),
                        Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero, observaciones: '' 
                    });
                }
            } else setSearchMessage({ type: 'error', text: "No se encontró ninguna partida con esos datos." });
        } catch (error) { setSearchMessage({ type: 'error', text: "Error conectando con la base de datos." }); } 
        finally { setIsLoading(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!decreeData.numeroDeDecreto || !decreeData.fechaEmision || !decreeData.conceptoAnulacion || !foundRecord || !selectedSearchParish) {
            toast({ title: "Campos Incompletos", description: "Verifique que todos los datos estén completos.", variant: "destructive" }); return;
        }

        setIsSubmitting(true);

        try {
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'correccion').contains('payload', { decreeNumber: decreeData.numeroDeDecreto }).maybeSingle();
            if (existingDecree) {
                setIsSubmitting(false);
                toast({ title: "Número de Decreto Duplicado", description: `El decreto ${decreeData.numeroDeDecreto} ya existe.`, variant: "destructive" }); return;
            }

            const { data: notasData } = await supabase.from('parishes').select('notas_marginales').eq('id', selectedSearchParish).maybeSingle();
            const notasConfig = notasData?.notas_marginales || null;
            
            let notaSupletoriaFinal = notasConfig?.porCorreccion?.nuevaPartida || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [NOMBRE_SACERDOTE].";
            notaSupletoriaFinal = notaSupletoriaFinal.replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto).replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, '')).replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA').replace(/\[LIBRO_ANULADA\]/g, String(foundRecord.book || foundRecord.book_number || decreeData.Libro).padStart(4, '0')).replace(/\[FOLIO_ANULADA\]/g, String(foundRecord.page || foundRecord.page_number || decreeData.folio).padStart(4, '0')).replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(foundRecord.entry || foundRecord.entry_number || decreeData.numero).padStart(4, '0')).replace(/\[NOMBRE_SACERDOTE\]/g, newPartida.daFe);

            let noteAnulada = notasConfig?.porCorreccion?.anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO]";
            noteAnulada = noteAnulada.replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, '')).replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto).replace(/\[LIBRO_NUEVA\]/g, String(newPartida.Libro).padStart(4, '0')).replace(/\[FOLIO_NUEVA\]/g, String(newPartida.folio).padStart(4, '0')).replace(/\[NUMERO_PARTIDA_NUEVA\]/g, String(newPartida.numero).padStart(4, '0'));

            // Actualizar Partida Original
            const oldRawData = { ...foundRecord };
            oldRawData.notaMarginal = oldRawData.notaMarginal ? `${oldRawData.notaMarginal} | ${noteAnulada}` : noteAnulada;
            oldRawData.estado = "anulada"; oldRawData.status = "anulada"; oldRawData.isAnnulled = true; oldRawData.annulmentDate = decreeData.fechaEmision; oldRawData.annulmentDecree = decreeData.numeroDeDecreto; oldRawData.conceptoAnulacionId = decreeData.conceptoAnulacion; oldRawData.tipoNotaAlMargen = "porCorreccion.anulada";

            await supabase.from('baptisms').update({ status: 'anulada', nota_marginal: noteAnulada, raw_data: oldRawData }).eq('id', foundRecord.id);

            // Crear Partida Nueva
            const partidaToSave = {
                ...newPartida,
                Libro: String(newPartida.Libro).padStart(4, '0'), folio: String(newPartida.folio).padStart(4, '0'), numero: String(newPartida.numero).padStart(4, '0'),
                book_number: String(newPartida.Libro).padStart(4, '0'), page_number: String(newPartida.folio).padStart(4, '0'), entry_number: String(newPartida.numero).padStart(4, '0'),
                firstName: newPartida.nombres, lastName: newPartida.apellidos, fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento, lugarn: newPartida.lugarNacimiento, lugarNacimientoDetalle: newPartida.lugarNacimiento, lugarBautismoDetalle: newPartida.lugarBautismo, lugbau: newPartida.lugarBautismo, sex: newPartida.sexo, padre: newPartida.nombrePadre, fatherName: newPartida.nombrePadre, madre: newPartida.nombreMadre, motherName: newPartida.nombreMadre, abuepat: newPartida.abuelosPaternos, paternalGrandparents: newPartida.abuelosPaternos, abuemat: newPartida.abuelosMaternos, maternalGrandparents: newPartida.abuelosMaternos, godparents: newPartida.padrinos, tipohijo: newPartida.tipoUnionPadres, ministro: newPartida.ministro, dafe: newPartida.daFe, ministerFaith: newPartida.daFe, status: 'seated', estado: 'permanente', anulado: false, creadoPorDecreto: true, isSupplementary: true, hasDecree: true, correctionDecreeRef: decreeData.numeroDeDecreto, tipoIdentidad: 'id_creada_correccion', conceptoAnulacionId: decreeData.conceptoAnulacion, tipoNotaAlMargen: "porCorreccion.nuevaPartida", parishId: selectedSearchParish, notaMarginal: notaSupletoriaFinal 
            };

            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: selectedSearchParish, book_number: partidaToSave.book_number, folio: partidaToSave.page_number, number: partidaToSave.entry_number,
                celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos, sexo: newPartida.sexo,
                fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, lugar_bautismo: newPartida.lugarBautismo,
                nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, tipo_union_padres: newPartida.tipoUnionPadres,
                abuelos_paternos: newPartida.abuelosPaternos, abuelos_maternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, da_fe: newPartida.daFe, status: 'seated', nota_marginal: notaSupletoriaFinal, raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            // Guardar Decreto
            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto, decreeDate: decreeData.fechaEmision, conceptoAnulacionId: decreeData.conceptoAnulacion,
                targetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), observaciones: newPartida.observaciones,
                fechaSacramento: newPartida.fechaSacramento, sexo: newPartida.sexo, fechaNacimiento: newPartida.fechaNacimiento, lugarNacimiento: newPartida.lugarNacimiento, nombrePadre: newPartida.nombrePadre, nombreMadre: newPartida.nombreMadre, tipoUnionPadres: newPartida.tipoUnionPadres, abuelosPaternos: newPartida.abuelosPaternos, abuelosMaternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                originalPartidaId: foundRecord.id, newPartidaId: newBap.id,
                originalPartidaSummary: { book: decreeData.Libro, page: decreeData.folio, entry: decreeData.numero, nombres: foundRecord.first_name || foundRecord.nombres || '', apellidos: foundRecord.last_name || foundRecord.apellidos || '' },
                newPartidaSummary: { book: newPartida.Libro, page: newPartida.folio, entry: newPartida.numero, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
            };

            await supabase.from('decretos').insert([{ parish_id: selectedSearchParish, tipo: 'correccion', payload: payloadDecree }]);

            // Aumentar Parámetro
            const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();
            if (pData && pData.bautizos_params) {
                const updatedParams = { ...pData.bautizos_params, suplementarioNumero: Number(newPartida.numero) + 1 };
                await supabase.from('parish_parameters').update({ bautizos_params: updatedParams }).eq('parish_id', selectedSearchParish);
            }

            await createNotification({ decree_id: generateUUID(), decree_type: 'correction', parish_id: selectedSearchParish, created_by: user.id, message: `La Cancillería emitió el Decreto de Corrección #${decreeData.numeroDeDecreto} afectando la partida de ${newPartida.nombres} ${newPartida.apellidos}.`, status: 'unread' });
            
            toast({ title: "Decreto Ejecutado", description: "Partida y decreto guardados remotamente.", className: "bg-green-50 border-green-200 text-green-900" });
            navigate('/chancery/decree-correction/view'); 

        } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number, colorCls }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className={`w-8 h-8 rounded-2xl text-white flex items-center justify-center text-xs font-black shadow-lg ${colorCls}`}>{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-purple-500" />} {title}</h3>
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
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Decreto de Corrección</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Inyección Remota en Libros Parroquiales</p>
                        </div>
                    </div>
                    <div className="bg-purple-50 text-purple-700 px-5 py-3 rounded-2xl text-[10px] border border-purple-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" /> Acceso Magistral
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-2xl h-14 max-w-2xl mx-auto">
                        <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmacion" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonio" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Matrimonios</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautismo" className="focus:outline-none max-w-5xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-purple-300 to-purple-500"></div>

                            <div className="p-12 space-y-10">
                                {/* 01. DECRETO MAESTRO */}
                                <section>
                                    <SectionHeader number="01" title="Información del Decreto Oficial" icon={FileText} colorCls="bg-purple-600 shadow-purple-900/20" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="md:col-span-3"><label className={labelClass}>Entidad Emisora</label><input readOnly value={decreeData.parroquia} className={`${inputClass} bg-gray-100 text-gray-500 border-none shadow-none cursor-not-allowed`} /></div>
                                        <div><label className={labelClass}>Número de Decreto *</label><input required name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} className={`${inputClass} border-purple-200 bg-purple-50/30 text-purple-700 placeholder-purple-300`} placeholder="EJ: 005-2025" /></div>
                                        <div><label className={labelClass}>Fecha de Emisión *</label><input type="date" required name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Concepto de Anulación *</label>
                                            <select required name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className={inputClass}>
                                                <option value="">SELECCIONE CONCEPTO...</option>
                                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* BÚSQUEDA GLOBAL */}
                                <section>
                                    <div className="bg-purple-50/50 p-8 rounded-[2rem] border border-purple-100 shadow-sm mt-8">
                                        <h4 className="text-sm font-black text-purple-800 mb-6 uppercase tracking-widest flex items-center gap-2"><Search className="w-4 h-4" /> Búsqueda Directa en Parroquia</h4>
                                        <div className="mb-6">
                                            <label className={labelClass}>Parroquia Origen del Registro *</label>
                                            <select value={selectedSearchParish} onChange={(e) => { setSelectedSearchParish(e.target.value); setSuggestions([]); setFoundRecord(null); setSearchMessage(null); }} className={`${inputClass} border-purple-200 text-purple-900 bg-white`}>
                                                <option value="">-- SELECCIONE LA PARROQUIA --</option>
                                                {parishesList.map(p => <option key={p.id} value={p.id}>{p.name} - {p.city}</option>)}
                                            </select>
                                        </div>
                                        <div className={`grid grid-cols-1 md:grid-cols-5 gap-6 items-end transition-opacity duration-300 ${!selectedSearchParish ? 'opacity-40 pointer-events-none' : ''}`} ref={wrapperRef}>
                                            <div className="md:col-span-2 relative">
                                                <label className={labelClass}>Nombre Bautizado</label>
                                                <Input name="nombreBautizado" value={decreeData.nombreBautizado} onChange={handleDecreeChange} placeholder="Buscar en la parroquia..." autoComplete="off" className={inputClass} />
                                                {showSuggestions && suggestions.length > 0 && (
                                                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                                                        {suggestions.map((record, idx) => (<div key={idx} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm font-bold text-gray-700" onClick={() => handleSuggestionClick(record)}>{record.firstName || record.nombres} {record.lastName || record.apellidos}</div>))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="md:col-span-1"><label className={labelClass}>Libro *</label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                            <div className="md:col-span-1"><label className={labelClass}>Folio *</label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                            <div className="md:col-span-1 flex gap-2">
                                                <div className="flex-1"><label className={labelClass}>Número *</label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                            </div>
                                        </div>
                                        <div className="mt-6 flex justify-end">
                                            <Button type="button" onClick={handleSearch} disabled={isLoading || !selectedSearchParish} className="bg-purple-600 hover:bg-purple-700 text-white shadow-md font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-xl">
                                                {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2"/>} {isLoading ? 'Buscando...' : 'Buscar en Parroquia'}
                                            </Button>
                                        </div>
                                        {searchMessage && <div className={`mt-6 p-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>{searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}{searchMessage.text}</div>}
                                        {foundRecord && (
                                            <div className="mt-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase mb-4 border-b pb-2 tracking-widest">Registro Encontrado y Vinculado</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-gray-700 uppercase">
                                                    <div><span className="text-gray-400">Bautizado:</span> <br/>{newPartida.nombres} {newPartida.apellidos}</div>
                                                    <div><span className="text-purple-500">Jurisdicción:</span> <br/>{targetParishNameStr}</div>
                                                    <div><span className="text-gray-400">Padres:</span> <br/>{newPartida.nombrePadre && newPartida.nombreMadre ? `${newPartida.nombrePadre} & ${newPartida.nombreMadre}` : newPartida.nombrePadre || newPartida.nombreMadre || 'NO REGISTRADOS'}</div>
                                                    <div><span className="text-gray-400">Fecha Bautismo:</span> <br/>{newPartida.fechaSacramento || '---'}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* 02. DATOS CORREGIDOS */}
                                <div className={`transition-all duration-500 ${!foundRecord ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                    <section>
                                        <SectionHeader number="02" title="Datos Corregidos en Nueva Partida" icon={UserPlus} colorCls="bg-green-600 shadow-green-900/20" />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-green-50/50 p-8 rounded-[2rem] border border-green-100 shadow-inner mb-8">
                                            <div><label className={labelClass}>Libro (Supletorio)</label><input name="Libro" value={newPartida.Libro} onChange={handleNewPartidaChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-green-700 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Folio (Supletorio)</label><input name="folio" value={newPartida.folio} onChange={handleNewPartidaChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Número (Supletorio)</label><input name="numero" value={newPartida.numero} onChange={handleNewPartidaChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Apellidos Completos *</label><input name="apellidos" required value={newPartida.apellidos} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Nombres Completos *</label><input name="nombres" required value={newPartida.nombres} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                                            <div>
                                                <label className={labelClass}>Sexo</label>
                                                <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChange} className={inputClass}>
                                                    <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                                </select>
                                            </div>
                                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Lugar de Nacimiento</label>
                                                <CityAutocomplete name="placeOfBirth" value={newPartida.lugarNacimiento} onChange={handleCityChange} cities={auxiliares.ciudades} className={inputClass} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Lugar Bautismo</label><input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="03" title="Filiación e Identidad" icon={Fingerprint} colorCls="bg-[#4B7BA7]" />
                                        <div className="mb-8">
                                            <label className={labelClass}>Tipo de Unión de Padres</label>
                                            <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                                <input name="nombrePadre" placeholder="NOMBRE DEL PADRE" value={newPartida.nombrePadre} onChange={handleNewPartidaChange} className={inputClass} />
                                                <textarea name="abuelosPaternos" placeholder="ABUELOS PATERNOS" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                            <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                                <input name="nombreMadre" placeholder="NOMBRE DE LA MADRE" value={newPartida.nombreMadre} onChange={handleNewPartidaChange} className={inputClass} />
                                                <textarea name="abuelosMaternos" placeholder="ABUELOS MATERNOS" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="04" title="Ministro y Autoridad" icon={PenTool} colorCls="bg-slate-700" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" list="ministros-list" value={newPartida.ministro} onChange={handleNewPartidaChange} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} /></div>
                                            <div><label className={labelClass}>Firma (Da Fe) *</label><input name="daFe" required list="ministros-list" value={newPartida.daFe} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                        <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                        <div className="mt-8">
                                            <label className={labelClass}>Observaciones del Decreto (Opcional)</label>
                                            <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChange} rows={3} className={`${inputClass} h-auto py-4 resize-none bg-amber-50`} placeholder="NOTA INTERNA..." />
                                        </div>
                                    </section>

                                    <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Cancelar</Button>
                                        <Button type="submit" disabled={isSubmitting || !foundRecord} className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Emitir Decreto Permanente
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeCorrectionPage;