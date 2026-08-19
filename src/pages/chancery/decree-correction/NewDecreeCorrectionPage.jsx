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
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';

const NewDecreeCorrectionPage = () => {
    const { user } = useAuth();
    const { 
        getMisDatosList,
        createNotification,
        obtenerNotasAlMargen
    } = useAppData();
    
    const { toast } = useToast();
    const navigate = useNavigate();

    // --- STATE MANAGEMENT ---
    const [isLoading, setIsLoading] = useState(false);
    const [targetDioceseId, setTargetDioceseId] = useState(null);
    const [conceptos, setConceptos] = useState([]);
    
    // --- ESTADOS PARA PARROQUIAS ---
    const [parishesList, setParishesList] = useState([]);
    const [selectedSearchParish, setSelectedSearchParish] = useState('');

    const [decreeData, setDecreeData] = useState({ 
        parroquia: '', 
        numeroDeDecreto: '', 
        fechaEmision: new Date().toISOString().split('T')[0], 
        conceptoAnulacion: '', 
        nombreBautizado: '', 
        Libro: '', 
        folio: '', 
        numero: '' 
    });
    
    const [foundRecord, setFoundRecord] = useState(null);
    const [targetParish, setTargetParish] = useState(null); 
    const [targetParishNameStr, setTargetParishNameStr] = useState('');
    const [searchMessage, setSearchMessage] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    const [newPartida, setNewPartida] = useState({ 
        lugarBautismo: '',
        fechaSacramento: '',
        apellidos: '',
        nombres: '',
        fechaNacimiento: '',
        lugarNacimiento: '',
        sexo: '', 
        nombrePadre: '',
        nombreMadre: '',
        tipoUnionPadres: '', 
        abuelosPaternos: '',
        abuelosMaternos: '',
        padrinos: '',
        ministro: '',
        daFe: '',
        observaciones: '', 
        Libro: '', 
        folio: '', 
        numero: '' 
    });
    
    // --- CONFIRMATION Y MARRIAGE STATES (Para el futuro) ---
    const [confDecreeData, setConfDecreeData] = useState({ parroquia: '', decreeNumber: '', decreeDate: new Date().toISOString().split('T')[0], conceptoAnulacionId: '', targetName: '', book: '', page: '', entry: '' });
    const [confFoundRecord, setConfFoundRecord] = useState(null);
    const [confSearchMessage, setConfSearchMessage] = useState(null);
    const [confSuggestions, setConfSuggestions] = useState([]);
    const [showConfSuggestions, setShowConfSuggestions] = useState(false);
    const confWrapperRef = useRef(null);
    const [newConfPartida, setNewConfPartida] = useState({ sacramentDate: '', firstName: '', lastName: '', birthDate: '', lugarNacimientoDetalle: '', lugarConfirmacion: '', fatherName: '', motherName: '', padrino: '', madrina: '', minister: '', ministerFaith: '' });

    const [marDecreeData, setMarDecreeData] = useState({ parroquia: '', decreeNumber: '', decreeDate: new Date().toISOString().split('T')[0], conceptoAnulacionId: '', targetName: '', book: '', page: '', entry: '' });
    const [marFoundRecord, setMarFoundRecord] = useState(null);
    const [marSearchMessage, setMarSearchMessage] = useState(null);
    const [marSuggestions, setMarSuggestions] = useState([]);
    const [showMarSuggestions, setShowMarSuggestions] = useState(false);
    const marWrapperRef = useRef(null);
    const [newMarPartida, setNewMarPartida] = useState({ sacramentDate: '', lugarMatrimonio: '', husbandName: '', husbandSurname: '', husbandBirthDate: '', husbandPlaceOfBirth: '', husbandFather: '', husbandMother: '', wifeName: '', wifeSurname: '', wifeBirthDate: '', wifePlaceOfBirth: '', wifeFather: '', wifeMother: '', witnesses: '', minister: '', ministerFaith: '' });


    // --- INITIALIZATION ---
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

                // Membrete de Cancillería
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
                setConfDecreeData(prev => ({ ...prev, parroquia: entityLabel }));
                setMarDecreeData(prev => ({ ...prev, parroquia: entityLabel }));

                if (currentDioceseId) {
                    const { data: conceptosData } = await supabase
                        .from('conceptos_anulacion')
                        .select(`id, codigo, concepto, tipo, chancelleries!inner ( diocese_id )`)
                        .eq('chancelleries.diocese_id', currentDioceseId)
                        .ilike('tipo', 'porCorreccion')
                        .order('codigo', { ascending: true });

                    if (conceptosData) setConceptos(conceptosData);

                    const { data: parroquiasData } = await supabase
                        .from('parishes')
                        .select('id, name, city')
                        .eq('diocese_id', currentDioceseId)
                        .order('name', { ascending: true });
                    
                    if (parroquiasData) setParishesList(parroquiasData);
                }

            } catch (error) {
                console.error("Error inicializando Cancillería:", error);
            }
        };

        initializeData();
    }, [user, getMisDatosList]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
            if (confWrapperRef.current && !confWrapperRef.current.contains(event.target)) setShowConfSuggestions(false);
            if (marWrapperRef.current && !marWrapperRef.current.contains(event.target)) setShowMarSuggestions(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, confWrapperRef, marWrapperRef]);

    const getSafeValue = (obj, ...keys) => {
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        return '';
    };

    const handleDecreeChange = async (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: value }));
        
        if (['Libro', 'folio', 'numero'].includes(name)) {
            setFoundRecord(null);
            setTargetParish(null);
            setTargetParishNameStr('');
            setSearchMessage(null);
        }

        if (name === 'nombreBautizado') {
            if (!selectedSearchParish) return; 
            
            if (value.length > 2) {
                try {
                    const { data, error } = await supabase
                        .from('baptisms')
                        .select('id, raw_data, first_name, last_name')
                        .eq('parish_id', selectedSearchParish)
                        .ilike('first_name', `%${value}%`)
                        .limit(5);

                    if (!error && data) {
                        setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.first_name, lastName: d.last_name })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }
    };

    const handleSuggestionClick = (record) => {
        const fullName = `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`;
        setDecreeData(prev => ({ ...prev, nombreBautizado: fullName }));
        setShowSuggestions(false);
    };

    const handleNewPartidaChange = (e) => {
        const { name, value } = e.target;
        setNewPartida(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSearch = async () => {
        if (!selectedSearchParish) {
            setSearchMessage({ type: 'error', text: "Debe seleccionar una parroquia en la lista superior." });
            return;
        }

        const { Libro, folio, numero } = decreeData;
        
        if (!Libro || !folio || !numero) {
            setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." });
            return;
        }

        setIsLoading(true);
        setSearchMessage(null);
        setFoundRecord(null);
        setTargetParish(null);

        try {
            const formattedBook = String(Libro).padStart(4, '0');
            const formattedPage = String(folio).padStart(4, '0');
            const formattedEntry = String(numero).padStart(4, '0');

            const { data: dbRecord, error } = await supabase
                .from('baptisms')
                .select('*')
                .eq('parish_id', selectedSearchParish) 
                .eq('book_number', formattedBook)
                .eq('page_number', formattedPage)
                .eq('entry_number', formattedEntry)
                .maybeSingle();

            if (error) throw error;

            if (dbRecord) {
                if (dbRecord.status === 'anulada') {
                    setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA en su parroquia." });
                } else {
                    const found = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };
                    
                    const parishObj = parishesList.find(p => p.id === selectedSearchParish);
                    const parishLabel = parishObj ? `${parishObj.name} - ${parishObj.city}`.toUpperCase() : 'PARROQUIA';

                    setFoundRecord(found);
                    setTargetParish(selectedSearchParish);
                    setTargetParishNameStr(parishLabel);
                    setSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });
                    
                    const foundName = `${dbRecord.first_name || found.nombres || ''} ${dbRecord.last_name || found.apellidos || ''}`.trim();
                    setDecreeData(prev => ({ ...prev, targetName: foundName, nombreBautizado: foundName }));
                    
                    let supletorioLibro = '0001', supletorioFolio = '0001', supletorioNumero = '0001';
                    const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();

                    if (paramsData && paramsData.bautizos_params) {
                        supletorioLibro = String(paramsData.bautizos_params.suplementarioLibro || '1').padStart(4, '0');
                        supletorioFolio = String(paramsData.bautizos_params.suplementarioFolio || '1').padStart(4, '0');
                        supletorioNumero = String(paramsData.bautizos_params.suplementarioNumero || '1').padStart(4, '0');
                    }

                    let priestName = '';
                    const { data: pData } = await supabase.from('parrocos').select('payload').eq('parish_id', selectedSearchParish);
                    if (pData && pData.length > 0) {
                        const active = pData.find(r => {
                            let p = r.payload;
                            if (typeof p === 'string') p = JSON.parse(p);
                            return String(p.estado) === '1' || String(p.Estado) === '1';
                        });
                        if (active) {
                            let p = active.payload;
                            if (typeof p === 'string') p = JSON.parse(p);
                            priestName = `${p.nombre || p.nombres || ''} ${p.apellido || p.apellidos || ''}`.trim();
                        }
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
                        padrinos: (Array.isArray(found.godparents) ? found.godparents.map(g => g.name).join(', ') : getSafeValue(found, 'godparents', 'padrinos')).toUpperCase(),
                        ministro: (dbRecord.minister || getSafeValue(found, 'minister', 'ministro')).toUpperCase(),
                        daFe: (priestName || getSafeValue(found, 'ministerFaith', 'daFe', 'dafe')).toUpperCase(),
                        Libro: supletorioLibro, 
                        folio: supletorioFolio, 
                        numero: supletorioNumero,
                        observaciones: '' 
                    });
                }
            } else {
                setSearchMessage({ type: 'error', text: "No se encontró ninguna partida con esos datos en la parroquia seleccionada." });
            }
        } catch (error) {
            console.error("Error en búsqueda:", error);
            setSearchMessage({ type: 'error', text: "Ocurrió un error conectando con la base de datos." });
        } finally {
            setIsLoading(false);
        }
    };

    const validateForm = () => {
        if (!decreeData.numeroDeDecreto || !decreeData.fechaEmision || !decreeData.conceptoAnulacion || !decreeData.targetName) return false;
        if (!foundRecord || !targetParish) return false;

        const required = ['fechaSacramento', 'nombres', 'apellidos', 'fechaNacimiento', 'lugarNacimiento', 'sexo', 'ministro', 'daFe', 'Libro', 'folio', 'numero'];
        
        return required.every(field => {
            const val = newPartida[field];
            return val !== undefined && val !== null && String(val).trim() !== '';
        });
    };

    // =========================================================================
    // 🚀 LÓGICA DE GUARDADO 100% DIRECTA A SUPABASE 
    // =========================================================================
    const handleSave = async () => {
        if (!validateForm()) {
            toast({ 
                title: "Campos Incompletos", 
                description: "Verifique que todos los campos requeridos (*) no estén vacíos.", 
                variant: "destructive" 
            });
            return;
        }

        setIsLoading(true);

        try {
            // 1. VALIDACIÓN DE DUPLICIDAD DE NÚMERO DE DECRETO
            const { data: existingDecree, error: checkError } = await supabase
                .from('decretos')
                .select('id')
                .eq('tipo', 'correccion')
                .eq('parish_id', targetParish)
                .contains('payload', { decreeNumber: decreeData.numeroDeDecreto })
                .maybeSingle();

            if (checkError) throw new Error("Error validando el número de decreto.");

            if (existingDecree) {
                setIsLoading(false);
                toast({ 
                    title: "Número de Decreto Duplicado", 
                    description: `El decreto número ${decreeData.numeroDeDecreto} ya se encuentra registrado en el sistema para esta parroquia.`, 
                    variant: "destructive" 
                });
                return;
            }

            // 2. PARÁMETROS SUPLETORIOS DE LA PARROQUIA DESTINO
            let supletorioLibro = '0001', supletorioFolio = '0001', supletorioNumero = '0001';
            const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', targetParish).maybeSingle();
            
            if (paramsData && paramsData.bautizos_params) {
                supletorioLibro = String(paramsData.bautizos_params.suplementarioLibro || '1').padStart(4, '0');
                supletorioFolio = String(paramsData.bautizos_params.suplementarioFolio || '1').padStart(4, '0');
                supletorioNumero = String(paramsData.bautizos_params.suplementarioNumero || '1').padStart(4, '0');
            }

            // 3. GENERAR NOTAS MARGINALES (Tratando de extraer plantillas desde Supabase)
            let notasConfig = null;
            const chanceryId = user?.chanceryId || user?.chancery_id || user?.dioceseId;
            if (chanceryId) {
                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', chanceryId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    notasConfig = chanceryParams.bautizos_params.plantillas_notas;
                }
            }
            
            let notaSupletoriaFinal = notasConfig?.correccion_nueva || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [MINISTRO].";
            
            notaSupletoriaFinal = notaSupletoriaFinal
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                .replace(/\[LIBRO_ANULADA\]/g, String(foundRecord.book || foundRecord.book_number || decreeData.Libro).padStart(4, '0'))
                .replace(/\[FOLIO_ANULADA\]/g, String(foundRecord.page || foundRecord.page_number || decreeData.folio).padStart(4, '0'))
                .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(foundRecord.entry || foundRecord.entry_number || decreeData.numero).padStart(4, '0'))
                .replace(/\[MINISTRO\]/g, newPartida.daFe);

            let noteAnulada = notasConfig?.correccion_anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].";
            
            noteAnulada = noteAnulada
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[LIBRO_NUEVA\]/g, String(supletorioLibro).padStart(4, '0'))
                .replace(/\[FOLIO_NUEVA\]/g, String(supletorioFolio).padStart(4, '0'))
                .replace(/\[NUMERO_PARTIDA_NUEVA\]/g, String(supletorioNumero).padStart(4, '0'));

            // 4. ANULAR PARTIDA ORIGINAL
            const oldRawData = { ...foundRecord };
            oldRawData.notaMarginal = oldRawData.notaMarginal ? `${oldRawData.notaMarginal} | ${noteAnulada}` : noteAnulada;
            
            oldRawData.estado = "anulada";
            oldRawData.status = "anulada";
            oldRawData.isAnnulled = true;
            oldRawData.annulmentDate = decreeData.fechaEmision;
            oldRawData.annulmentDecree = decreeData.numeroDeDecreto;
            oldRawData.conceptoAnulacionId = decreeData.conceptoAnulacion;
            oldRawData.tipoNotaAlMargen = "porCorreccion.anulada";

            await supabase.from('baptisms').update({ 
                status: 'anulada', nota_marginal: oldRawData.notaMarginal, 
                raw_data: oldRawData 
            }).eq('id', foundRecord.id);

            // 5. CREAR PARTIDA SUPLETORIA
            const partidaToSave = {
                ...newPartida,
                Libro: String(supletorioLibro).padStart(4, '0'),
                folio: String(supletorioFolio).padStart(4, '0'),
                numero: String(supletorioNumero).padStart(4, '0'),
                book_number: String(supletorioLibro).padStart(4, '0'),
                page_number: String(supletorioFolio).padStart(4, '0'),
                entry_number: String(supletorioNumero).padStart(4, '0'),

                firstName: newPartida.nombres, lastName: newPartida.apellidos,
                fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento,
                lugarn: newPartida.lugarNacimiento, lugarNacimientoDetalle: newPartida.lugarNacimiento,
                lugarBautismoDetalle: newPartida.lugarBautismo, lugbau: newPartida.lugarBautismo,
                sex: newPartida.sexo, 
                padre: newPartida.nombrePadre, fatherName: newPartida.nombrePadre,
                madre: newPartida.nombreMadre, motherName: newPartida.nombreMadre,
                abuepat: newPartida.abuelosPaternos, paternalGrandparents: newPartida.abuelosPaternos,
                abuemat: newPartida.abuelosMaternos, maternalGrandparents: newPartida.abuelosMaternos,
                godparents: newPartida.padrinos, tipohijo: newPartida.tipoUnionPadres, 
                ministro: newPartida.ministro, dafe: newPartida.daFe, ministerFaith: newPartida.daFe,
                status: 'seated', estado: 'permanente', anulado: false,
                
                creadoPorDecreto: true,
                isSupplementary: true,
                hasDecree: true,
                correctionDecreeRef: decreeData.numeroDeDecreto, 
                tipoIdentidad: 'id_creada_correccion', 
                conceptoAnulacionId: decreeData.conceptoAnulacion,
                tipoNotaAlMargen: "porCorreccion.nuevaPartida",
                parishId: targetParish,
                notaMarginal: notaSupletoriaFinal 
            };

            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: targetParish, book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
                celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos,
                sexo: newPartida.sexo, fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, 
                nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, tipo_union_padres: newPartida.tipoUnionPadres, 
                padrinos: newPartida.padrinos, ministro: newPartida.ministro, da_fe: newPartida.daFe, status: 'seated', 
                nota_marginal: notaSupletoriaFinal, raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            // 6. CREAR DECRETO EN SUPABASE
            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto,
                decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacion,
                targetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), 
                observaciones: newPartida.observaciones,
                
                fechaSacramento: newPartida.fechaSacramento,
                sexo: newPartida.sexo,
                fechaNacimiento: newPartida.fechaNacimiento,
                lugarNacimiento: newPartida.lugarNacimiento,
                nombrePadre: newPartida.nombrePadre,
                nombreMadre: newPartida.nombreMadre,
                tipoUnionPadres: newPartida.tipoUnionPadres,
                abuelosPaternos: newPartida.abuelosPaternos,
                abuelosMaternos: newPartida.abuelosMaternos,
                padrinos: newPartida.padrinos,

                originalPartidaId: foundRecord.id,
                newPartidaId: newBap.id,
                originalPartidaSummary: { book: foundRecord.book_number, page: foundRecord.page_number, entry: foundRecord.entry_number },
                newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero }
            };

            const { error: decError } = await supabase.from('decretos').insert([{ 
                parish_id: targetParish, 
                tipo: 'correccion', 
                payload: payloadDecree 
            }]);

            if (decError) throw decError;

            // 7. AUMENTAR CONSECUTIVO PARROQUIA
            const p = paramsData?.bautizos_params || {};
            await supabase.from('parish_parameters').upsert({ 
                parish_id: targetParish, 
                bautizos_params: { ...p, suplementarioNumero: Number(supletorioNumero) + 1 } 
            }, { onConflict: 'parish_id' });

            // 8. NOTIFICACIÓN
            await createNotification({
                decree_id: generateUUID(),
                decree_type: 'correction',
                parish_id: targetParish,
                created_by: user.id,
                message: `La Cancillería emitió el Decreto de Corrección #${decreeData.numeroDeDecreto} afectando la partida de ${newPartida.nombres} ${newPartida.apellidos}.`,
                status: 'unread'
            });

            toast({ 
                title: "Decreto Ejecutado", 
                description: "Partida y decreto guardados directamente en la Nube (Parroquia Destino).",
                className: "bg-green-50 border-green-200 text-green-900"
            });
            navigate('/chancery/decree-correction/view'); 

        } catch (error) {
            console.error("Error completo:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // --- MANEJADORES DE CONFIRMACIONES Y MATRIMONIOS (MOCK) ---
    const handleConfDecreeChange = (e) => {
        const { name, value } = e.target;
        setConfDecreeData(prev => ({ ...prev, [name]: value }));
        if (['book', 'page', 'entry'].includes(name)) { setConfFoundRecord(null); setConfSearchMessage(null); }
        if (name === 'targetName') {
            if (value.length > 2) {
                const allConfirmations = getConfirmations(targetParish || user?.parishId);
                const filtered = allConfirmations.filter(c => {
                    const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
                    return fullName.includes(value.toLowerCase());
                }).slice(0, 5);
                setConfSuggestions(filtered);
                setShowConfSuggestions(true);
            } else {
                setConfSuggestions([]);
                setShowConfSuggestions(false);
            }
        }
    };

    const handleConfSuggestionClick = (record) => {
        const fullName = `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`;
        setConfDecreeData(prev => ({ ...prev, targetName: fullName }));
        setShowConfSuggestions(false);
    };

    const handleNewConfPartidaChange = (e) => {
        const { name, value } = e.target;
        setNewConfPartida(prev => ({ ...prev, [name]: value }));
    };

    const handleConfSearch = () => {
        setConfSearchMessage({ type: 'error', text: "Buscador de confirmaciones en construcción" });
    };

    const handleMarDecreeChange = (e) => {
        const { name, value } = e.target;
        setMarDecreeData(prev => ({ ...prev, [name]: value }));
        if (['book', 'page', 'entry'].includes(name)) { setMarFoundRecord(null); setMarSearchMessage(null); }
        if (name === 'targetName') {
            if (value.length > 2) {
                const allMatrimonios = getMatrimonios(targetParish || user?.parishId);
                const filtered = allMatrimonios.filter(m => {
                    const husbandFull = `${m.husbandName || ''} ${m.husbandSurname || ''}`.toLowerCase();
                    const wifeFull = `${m.wifeName || ''} ${m.wifeSurname || ''}`.toLowerCase();
                    return husbandFull.includes(value.toLowerCase()) || wifeFull.includes(value.toLowerCase());
                }).slice(0, 5);
                setMarSuggestions(filtered);
                setShowMarSuggestions(true);
            } else {
                setMarSuggestions([]);
                setShowMarSuggestions(false);
            }
        }
    };

    const handleMarSuggestionClick = (record) => {
        const label = `${record.husbandName} ${record.husbandSurname} & ${record.wifeName} ${record.wifeSurname}`;
        setMarDecreeData(prev => ({ ...prev, targetName: label }));
        setShowMarSuggestions(false);
    };

    const handleNewMarPartidaChange = (e) => {
        const { name, value } = e.target;
        setNewMarPartida(prev => ({ ...prev, [name]: value }));
    };

    const handleMarSearch = () => {
        setMarSearchMessage({ type: 'error', text: "Buscador de matrimonios en construcción" });
    };

    const selectedConcept = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacion));

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate('/chancery/decree-correction/view')} className="p-0 hover:bg-transparent">
                    <ArrowLeft className="w-6 h-6 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-serif">Decreto de Corrección Magistral</h1>
                    <p className="text-gray-500 text-sm flex items-center gap-2">
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold border border-purple-200">ACCESO CANCILLERÍA</span>
                        Búsqueda e inyección remota en libros parroquiales.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="bautizos" className="w-full">
                <TabsList className="grid w-full grid-cols-1 mb-8 max-w-sm mx-auto bg-gray-100 p-1">
                    <TabsTrigger value="bautizos" className="font-bold py-2">Bautismos</TabsTrigger>
                </TabsList>

                <TabsContent value="bautizos">
                    <div className="space-y-8 max-w-6xl mx-auto pb-24">
                        
                        {/* SECCIÓN 1: DATOS DEL DECRETO OFICIAL */}
                        <div className="bg-white rounded-lg shadow-sm border-l-4 border-purple-600 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <FileText className="w-5 h-5 text-purple-600" /> SECCIÓN 1: DATOS DEL DECRETO OFICIAL
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Entidad Emisora</label>
                                    <Input value={decreeData.parroquia} readOnly className="bg-gray-100 text-gray-700 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número de Decreto <span className="text-red-500">*</span></label>
                                    <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej: 001-2025" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Decreto <span className="text-red-500">*</span></label>
                                    <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Concepto de Anulación <span className="text-red-500">*</span></label>
                                    <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                        <option value="">Seleccionar Concepto</option>
                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                    </select>
                                    {selectedConcept && <div className="mt-1 text-xs text-purple-600">{selectedConcept.codigo} - {selectedConcept.concepto}</div>}
                                </div>
                            </div>

                            {/* BÚSQUEDA GLOBAL EN SUPABASE */}
                            <div className="bg-purple-50/50 p-6 rounded-lg border border-purple-100 mt-6">
                                <h4 className="text-sm font-bold text-purple-800 mb-4 uppercase">Búsqueda Directa de Partida a Anular</h4>
                                
                                <div className="mb-6">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Parroquia Origen del Registro <span className="text-red-500">*</span>
                                    </label>
                                    <select 
                                        value={selectedSearchParish} 
                                        onChange={(e) => {
                                            setSelectedSearchParish(e.target.value);
                                            setSuggestions([]);
                                            setFoundRecord(null);
                                            setSearchMessage(null);
                                        }} 
                                        className="w-full h-[45px] px-4 border border-purple-200 rounded-xl text-sm font-bold bg-white uppercase outline-none focus:ring-2 focus:ring-purple-500/50 text-purple-900 shadow-sm"
                                    >
                                        <option value="">-- SELECCIONE LA PARROQUIA --</option>
                                        {parishesList.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - {p.city}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-opacity duration-300 ${!selectedSearchParish ? 'opacity-40 pointer-events-none' : ''}`} ref={wrapperRef}>
                                    <div className="md:col-span-2 relative">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nombre Bautizado</label>
                                        <Input name="nombreBautizado" value={decreeData.nombreBautizado} onChange={handleDecreeChange} placeholder="Buscar en la parroquia..." autoComplete="off" />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                                                {suggestions.map((record, idx) => (
                                                    <div key={idx} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700" onClick={() => handleSuggestionClick(record)}>
                                                        {record.firstName || record.nombres} {record.lastName || record.apellidos}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="md:col-span-1"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Libro <span className="text-red-500">*</span></label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className="text-center font-mono" placeholder="No." /></div>
                                    <div className="md:col-span-1"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Folio <span className="text-red-500">*</span></label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className="text-center font-mono" placeholder="No." /></div>
                                    <div className="md:col-span-1 flex gap-2">
                                        <div className="flex-1"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Número <span className="text-red-500">*</span></label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className="text-center font-mono" placeholder="No." /></div>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button onClick={handleSearch} disabled={isLoading || !selectedSearchParish} className="bg-purple-600 hover:bg-purple-700 text-white w-full md:w-auto shadow-md font-bold uppercase tracking-widest text-[10px] px-8 h-[45px]">
                                        {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2"/>} 
                                        {isLoading ? 'Buscando...' : 'Buscar en Parroquia'}
                                    </Button>
                                </div>
                                {searchMessage && (
                                    <div className={`mt-4 p-3 rounded-md text-sm font-medium flex items-center gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                        {searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                                        {searchMessage.text}
                                    </div>
                                )}
                                {foundRecord && (
                                    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
                                        <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">Registro Encontrado y Vinculado</h5>
                                        <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><span className="font-semibold">Bautizado:</span> {newPartida.nombres} {newPartida.apellidos}</div>
                                            <div><span className="font-semibold text-purple-700">Jurisdicción:</span> {targetParishNameStr}</div>
                                            <div>
                                                <span className="font-semibold">Padres:</span>{' '}
                                                {newPartida.nombrePadre && newPartida.nombreMadre 
                                                    ? `${newPartida.nombrePadre} & ${newPartida.nombreMadre}`
                                                    : newPartida.nombrePadre || newPartida.nombreMadre || 'NO REGISTRADOS'}
                                            </div>
                                            <div><span className="font-semibold">Fecha Bautismo:</span> {newPartida.fechaSacramento || '---'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA */}
                        <div className={`bg-white rounded-lg shadow-sm border-l-4 border-green-600 p-6 transition-all duration-300 ${!foundRecord ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2"><UserPlus className="w-5 h-5 text-green-600" /> SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA EN PARROQUIA</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <h4 className="md:col-span-3 text-xs font-bold text-amber-800 uppercase mb-1">Ubicación del Registro Supletorio (Extraído de la Nube)</h4>
                                <div><label className="block text-xs font-bold text-amber-900 uppercase mb-1">Libro <span className="text-red-500">*</span></label><Input name="Libro" value={newPartida.Libro} onChange={handleNewPartidaChange} className="bg-white font-bold" /></div>
                                <div><label className="block text-xs font-bold text-amber-900 uppercase mb-1">Folio <span className="text-red-500">*</span></label><Input name="folio" value={newPartida.folio} onChange={handleNewPartidaChange} className="bg-white font-bold" /></div>
                                <div><label className="block text-xs font-bold text-amber-900 uppercase mb-1">Número <span className="text-red-500">*</span></label><Input name="numero" value={newPartida.numero} onChange={handleNewPartidaChange} className="bg-white font-bold" /></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Apellidos <span className="text-red-500">*</span></label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-800" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Nombres <span className="text-red-500">*</span></label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-800" /></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChange} className="uppercase" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo <span className="text-red-500">*</span></label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChange} className="py-6" /></div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Sexo <span className="text-red-500">*</span></label>
                                    <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChange} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 uppercase">
                                        <option value="">SELECCIONE...</option>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento <span className="text-red-500">*</span></label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChange} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nacimiento <span className="text-red-500">*</span></label><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChange} className="uppercase" /></div>
                            </div>

                            {/* Filiación */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10 mt-6">
                                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
                                    <Input name="nombrePadre" placeholder="Nombre completo" value={newPartida.nombrePadre} onChange={handleNewPartidaChange} className="bg-white uppercase font-bold" />
                                </div>
                                <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4">
                                    <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
                                    <Input name="nombreMadre" placeholder="Nombre completo" value={newPartida.nombreMadre} onChange={handleNewPartidaChange} className="bg-white uppercase font-bold" />
                                </div>
                            </div>

                            {/* Abuelos y Union */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Paternos</label><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChange} className="uppercase" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Maternos</label><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChange} className="uppercase" /></div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Unión</label>
                                    <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChange} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 uppercase">
                                        <option value="">SELECCIONE...</option>
                                        <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                        <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                        <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                        <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                        <option value="OTRO CASO">OTRO CASO</option>
                                    </select>
                                </div>
                            </div>

                            {/* Padrinos y Ministro */}
                            <div className="space-y-2 mt-6"><label className="text-[10px] font-black text-gray-400 uppercase">Padrinos</label><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className="py-6 font-bold uppercase" /></div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10 mt-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Sacerdote Celebrante <span className="text-red-500">*</span></label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChange} className="py-6 uppercase font-black text-blue-900" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Da Fe (Firma Local) <span className="text-red-500">*</span></label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-500 bg-gray-50" /></div>
                            </div>
                            
                            {/* 🚀 NOTA MARGINAL MANUAL */}
                            <div className="space-y-2 border-t pt-10 mt-6">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Observaciones del Decreto (Opcional)</label>
                                <textarea 
                                    name="observaciones" 
                                    value={newPartida.observaciones} 
                                    onChange={handleNewPartidaChange} 
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500/20 uppercase font-bold text-gray-700 bg-amber-50"
                                    placeholder="ESCRIBA AQUÍ LAS OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..."
                                />
                            </div>
                        </div>

                        {/* BOTÓN DE GUARDADO FLOTANTE */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:pl-64 z-20">
                            <Button variant="outline" onClick={() => navigate('/chancery/decree-correction/view')} className="border-gray-300 text-gray-700 hover:bg-gray-50 font-black uppercase tracking-widest text-[10px]">Cancelar</Button>
                            <Button onClick={handleSave} disabled={!foundRecord || isLoading} className="bg-gradient-to-r from-purple-600 to-purple-800 hover:scale-[1.02] text-white shadow-xl shadow-purple-900/20 font-black px-8 uppercase tracking-widest text-[10px] transition-all transform active:scale-95">
                                {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
                                {isLoading ? 'Procesando en Nube...' : 'Emitir y Sincronizar'}
                            </Button>
                        </div>
                    </form>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
};

export default NewDecreeCorrectionPage;