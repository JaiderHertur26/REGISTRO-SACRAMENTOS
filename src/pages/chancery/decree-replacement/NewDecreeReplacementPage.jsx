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
import CityAutocomplete from '@/components/CityAutocomplete';
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
    const [ciudades, setCiudades] = useState([]);

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
        padrinos: '', ministro: '', daFe: '', observaciones: '', Libro: '', folio: '', numero: ''
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

                // Cargar Membrete de la Cancillería
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
        setDecreeData(prev => ({ ...prev, [name]: value.toUpperCase() }));

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
    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

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
            const formattedBook = String(Libro).padStart(4, '0');
            const formattedPage = String(folio).padStart(4, '0');
            const formattedEntry = String(numero).padStart(4, '0');

            const { data: dbRecord, error } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish)
                .eq('book_number', formattedBook).eq('page_number', formattedPage).eq('entry_number', formattedEntry).maybeSingle();

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
                    let supletorioLibro = '0001', supletorioFolio = '0001', supletorioNumero = '0001';
                    
                    if (paramsData && paramsData.bautizos_params) {
                        setCloudParams(paramsData.bautizos_params);
                        supletorioLibro = String(paramsData.bautizos_params.suplementarioLibro || '1').padStart(4, '0');
                        supletorioFolio = String(paramsData.bautizos_params.suplementarioFolio || '1').padStart(4, '0');
                        supletorioNumero = String(paramsData.bautizos_params.suplementarioNumero || '1').padStart(4, '0');
                    }

                    // 2. Obtener párroco activo de esa parroquia
                    let priestName = '';
                    const { data: pData } = await supabase.from('parrocos').select('payload').eq('parish_id', selectedSearchParish);
                    if (pData && pData.length > 0) {
                        const active = pData.find(r => String(r.payload.estado || r.payload.Estado) === '1');
                        if (active) {
                            let name = `${active.payload.nombre || ''} ${active.payload.apellido || ''}`.trim().toUpperCase();
                            if (!name.startsWith('PBRO')) name = `PBRO. ${name}`;
                            priestName = name;
                        }
                    }

                    // 3. Traer Ciudades Registradas de esa Parroquia
                    const { data: citiesData } = await supabase.from('ciudades').select('nombre').eq('context_id', selectedSearchParish);
                    if (citiesData) setCiudades(citiesData.map(c => (c.nombre || '').toUpperCase()));

                    // 4. Normalizar Sexo y Unión
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

                    // 5. Poblar Formulario
                    setNewPartida(prev => ({
                        ...prev,
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
        if (!decreeData.numeroDeDecreto || !decreeData.fechaEmision || !decreeData.conceptoAnulacion || !foundRecord || !targetParish) return false;
        const required = ['fechaSacramento', 'nombres', 'apellidos', 'Libro', 'folio', 'numero'];
        return required.every(field => newPartida[field] !== undefined && newPartida[field] !== null && String(newPartida[field]).trim() !== '');
    };

    // =========================================================================
    // 🚀 LÓGICA DE GUARDADO 100% DIRECTA A SUPABASE (CON MOTOR MATEMÁTICO)
    // =========================================================================
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

            const supletorioLibro = String(newPartida.Libro).padStart(4, '0');
            const supletorioFolio = String(newPartida.folio).padStart(4, '0');
            const supletorioNumero = String(newPartida.numero).padStart(4, '0');

            // 2. MOTOR DE NOTAS
            let templateAnulada = chanceryNotesConfig?.correccion_anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].";
            let noteAnulada = templateAnulada
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[LIBRO_NUEVA\]/g, supletorioLibro)
                .replace(/\[FOLIO_NUEVA\]/g, supletorioFolio)
                .replace(/\[NUMERO_PARTIDA_NUEVA\]/g, supletorioNumero);

            let templateNueva = chanceryNotesConfig?.correccion_nueva || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [MINISTRO].";
            let notaSupletoriaFinal = templateNueva
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                .replace(/\[LIBRO_ANULADA\]/g, String(foundRecord.book_number || decreeData.Libro).padStart(4, '0'))
                .replace(/\[FOLIO_ANULADA\]/g, String(foundRecord.page_number || decreeData.folio).padStart(4, '0'))
                .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(foundRecord.entry_number || decreeData.numero).padStart(4, '0'))
                .replace(/\[MINISTRO\]/g, newPartida.daFe);

            // 3. Marcar original como anulada en Supabase
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
                status: 'anulada', nota_marginal: noteAnulada, 
                raw_data: oldRawData 
            }).eq('id', foundRecord.id);

            // 4. Crear Nueva Partida Supletoria
            const partidaToSave = {
                ...newPartida,
                Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
                book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
                firstName: newPartida.nombres, lastName: newPartida.apellidos,
                fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento,
                lugarn: newPartida.lugarNacimiento, lugarNacimientoDetalle: newPartida.lugarNacimiento,
                lugarBautismoDetalle: newPartida.lugarBautismo, lugbau: newPartida.lugarBautismo,
                sex: newPartida.sexo, padre: newPartida.nombrePadre, fatherName: newPartida.nombrePadre,
                madre: newPartida.nombreMadre, motherName: newPartida.nombreMadre,
                abuepat: newPartida.abuelosPaternos, paternalGrandparents: newPartida.abuelosPaternos,
                abuemat: newPartida.abuelosMaternos, maternalGrandparents: newPartida.abuelosMaternos,
                godparents: newPartida.padrinos, tipohijo: newPartida.tipoUnionPadres, 
                ministro: newPartida.ministro, dafe: newPartida.daFe, ministerFaith: newPartida.daFe,
                status: 'seated', estado: 'permanente', anulado: false,
                creadoPorDecreto: true, isSupplementary: true, hasDecree: true,
                correctionDecreeRef: decreeData.numeroDeDecreto, tipoIdentidad: 'id_creada_correccion', 
                conceptoAnulacionId: decreeData.conceptoAnulacion, tipoNotaAlMargen: "porCorreccion.nuevaPartida",
                parishId: targetParish, notaMarginal: notaSupletoriaFinal 
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

            // 5. Crear Decreto Final en Supabase
            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto, decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacion, observaciones: newPartida.observaciones,
                targetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), 
                
                fechaSacramento: newPartida.fechaSacramento, sexo: newPartida.sexo,
                fechaNacimiento: newPartida.fechaNacimiento, lugarNacimiento: newPartida.lugarNacimiento,
                nombrePadre: newPartida.nombrePadre, nombreMadre: newPartida.nombreMadre,
                tipoUnionPadres: newPartida.tipoUnionPadres, abuelosPaternos: newPartida.abuelosPaternos,
                abuelosMaternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, daFe: newPartida.daFe,

                originalPartidaId: foundRecord.id, newPartidaId: newBap.id,
                originalPartidaSummary: { book: foundRecord.book_number, page: foundRecord.page_number, entry: foundRecord.entry_number },
                newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero }
            };

            await supabase.from('decretos').insert([{ parish_id: targetParish, tipo: 'correccion', payload: payloadDecree }]);

            // 6. INCREMENTAR CONSECUTIVOS USANDO EL MOTOR MATEMÁTICO CANÓNICO 🚀
            const p = cloudParams || {};
            const nextSup = calculateNextConsecutive(
                supletorioNumero,
                supletorioFolio,
                supletorioLibro,
                p.suplementarioPartidas || 2,
                p.suplementarioReiniciar || false
            );

            const updatedParams = { 
                ...p, 
                suplementarioNumero: nextSup.numero,
                suplementarioFolio: nextSup.folio,
                suplementarioLibro: nextSup.libro
            };

            await supabase.from('parish_parameters').upsert({ 
                parish_id: targetParish, 
                bautizos_params: updatedParams 
            }, { onConflict: 'parish_id' });

            // 7. Enviar Notificación
            try {
                await supabase.from('parish_notifications').insert([{
                    parish_id: targetParish,
                    title: 'Decreto de Corrección',
                    message: `La Cancillería emitió el Decreto #${decreeData.numeroDeDecreto} afectando la partida de ${newPartida.nombres} ${newPartida.apellidos}.`,
                    status: 'unread'
                }]);
            } catch (e) { console.error("No se pudo notificar a la parroquia", e); }

            setIsLoading(false);
            toast({ title: "Decreto Ejecutado", description: "Partida y decreto guardados remotamente en la Parroquia Destino.", className: "bg-green-50 border-green-200 text-green-900" });
            navigate('/chancery/decree-correction/view'); 

        } catch (error) {
            console.error("Error completo:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-blue-500" />} {title}</h3>
        </div>
    );

    const formatParishOption = (parish) => {
        return `${parish.name.toUpperCase()} - ${(parish.city || 'Ciudad').toUpperCase()}`;
    };

    const selectedConcept = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacion));

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="flex items-center gap-4 mb-6 pt-6 max-w-6xl mx-auto">
                <Button variant="ghost" onClick={() => navigate('/chancery/decree-correction/view')} className="p-0 hover:bg-transparent">
                    <ArrowLeft className="w-6 h-6 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-3xl font-black text-gray-900 font-serif">Decreto de Corrección Magistral</h1>
                    <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold border border-purple-200">ACCESO CANCILLERÍA</span>
                        Búsqueda e inyección remota en libros parroquiales.
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto pb-24">
                <Tabs defaultValue="bautizos" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 mb-8 max-w-sm mx-auto bg-gray-100 p-1">
                        <TabsTrigger value="bautizos" className="font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Bautismos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautizos">
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* SECCIÓN 1: DATOS DEL DECRETO OFICIAL */}
                            <div className="bg-white rounded-[2rem] shadow-sm border-l-4 border-purple-600 p-8">
                                <SectionHeader number="01" title="Datos del Decreto Oficial" icon={FileText} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    <div className="md:col-span-3">
                                        <label className={labelClass}>Entidad Emisora</label>
                                        <Input value={decreeData.parroquia} readOnly className={`${inputClass} bg-purple-50 border-purple-200 text-purple-800`} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Número de Decreto <span className="text-red-500">*</span></label>
                                        <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej: 001-2025" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Fecha de Decreto <span className="text-red-500">*</span></label>
                                        <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Concepto de Anulación <span className="text-red-500">*</span></label>
                                        <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className={inputClass}>
                                            <option value="">SELECCIONAR CONCEPTO</option>
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* BÚSQUEDA GLOBAL EN SUPABASE */}
                                <div className="bg-blue-50/50 p-8 rounded-2xl border border-blue-100 mt-6 shadow-inner">
                                    <h4 className="text-[10px] font-black text-blue-800 mb-6 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Búsqueda Directa de Partida a Anular
                                    </h4>
                                    
                                    <div className="mb-6">
                                        <label className={labelClass}>Parroquia Origen del Registro <span className="text-red-500">*</span></label>
                                        <select 
                                            value={selectedSearchParish} 
                                            onChange={(e) => {
                                                setSelectedSearchParish(e.target.value);
                                                setSuggestions([]); setFoundRecord(null); setSearchMessage(null);
                                            }} 
                                            className={`${inputClass} bg-white text-blue-900 border-blue-200 focus:ring-blue-500`}
                                        >
                                            <option value="">-- SELECCIONE LA PARROQUIA --</option>
                                            {parishesList.map(p => <option key={p.id} value={p.id}>{formatParishOption(p)}</option>)}
                                        </select>
                                    </div>

                                    <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-opacity duration-300 ${!selectedSearchParish ? 'opacity-40 pointer-events-none' : ''}`} ref={wrapperRef}>
                                        <div className="md:col-span-2 relative">
                                            <label className={labelClass}>Nombre Bautizado</label>
                                            <Input name="nombreBautizado" value={decreeData.nombreBautizado} onChange={handleDecreeChange} placeholder="Buscar en la parroquia..." autoComplete="off" className={inputClass} />
                                            {showSuggestions && suggestions.length > 0 && (
                                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                                                    {suggestions.map((record, idx) => (
                                                        <div key={idx} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-xs font-bold text-gray-700 border-b last:border-b-0" onClick={() => handleSuggestionClick(record)}>
                                                            {record.firstName || record.nombres} {record.lastName || record.apellidos}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="md:col-span-1"><label className={labelClass}>Libro <span className="text-red-500">*</span></label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                        <div className="md:col-span-1"><label className={labelClass}>Folio <span className="text-red-500">*</span></label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                        <div className="md:col-span-1 flex gap-2">
                                            <div className="flex-1"><label className={labelClass}>Número <span className="text-red-500">*</span></label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className={`${inputClass} text-center font-mono`} placeholder="No." /></div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <Button onClick={handleSearch} disabled={isLoading || !selectedSearchParish} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto shadow-md font-black uppercase tracking-widest text-[10px] px-8 h-[45px] rounded-xl transition-all active:scale-95">
                                            {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2"/>} 
                                            {isLoading ? 'Buscando...' : 'Buscar en Parroquia'}
                                        </Button>
                                    </div>
                                    {searchMessage && (
                                        <div className={`mt-6 p-4 rounded-xl text-xs font-bold flex gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                            {searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                                            {searchMessage.text}
                                        </div>
                                    )}
                                    {foundRecord && (
                                        <div className="mt-6 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
                                            <h5 className="text-[10px] font-black text-gray-500 uppercase mb-4 border-b pb-2">Registro Encontrado y Vinculado</h5>
                                            <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-4 font-medium">
                                                <div><span className="font-black text-gray-800">Bautizado:</span> {newPartida.nombres} {newPartida.apellidos}</div>
                                                <div><span className="font-black text-blue-700">Jurisdicción:</span> {targetParishNameStr}</div>
                                                <div>
                                                    <span className="font-black text-gray-800">Padres:</span>{' '}
                                                    {newPartida.nombrePadre && newPartida.nombreMadre ? `${newPartida.nombrePadre} & ${newPartida.nombreMadre}` : newPartida.nombrePadre || newPartida.nombreMadre || 'NO REGISTRADOS'}
                                                </div>
                                                <div><span className="font-black text-gray-800">Fecha Bautismo:</span> {newPartida.fechaSacramento || '---'}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA */}
                            <div className={`bg-white rounded-[2rem] shadow-sm border-l-4 border-green-600 p-8 transition-all duration-300 ${!foundRecord ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                                <SectionHeader number="02" title="Asiento Supletorio Remoto" icon={UserPlus} />
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                                    <h4 className="md:col-span-3 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 text-center">Ubicación del Registro Supletorio (Nube)</h4>
                                    <div><label className={labelClass}>Libro (Supletorio) *</label><Input name="Libro" value={newPartida.Libro} onChange={handleNewPartidaChangeRaw} className="bg-white font-mono text-xl text-center font-black text-blue-700" readOnly /></div>
                                    <div><label className={labelClass}>Folio (Supletorio) *</label><Input name="folio" value={newPartida.folio} onChange={handleNewPartidaChangeRaw} className="bg-white font-mono text-xl text-center font-black text-gray-800" readOnly /></div>
                                    <div><label className={labelClass}>Número (Supletorio) *</label><Input name="numero" value={newPartida.numero} onChange={handleNewPartidaChangeRaw} className="bg-white font-mono text-xl text-center font-black text-gray-800" readOnly /></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div><label className={labelClass}>Apellidos *</label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
                                    <div><label className={labelClass}>Nombres *</label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                                    <div><label className={labelClass}>Lugar Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                    <div><label className={labelClass}>F. Bautismo *</label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} className={inputClass} /></div>
                                    <div>
                                        <label className={labelClass}>Sexo *</label>
                                        <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeUpper} className={inputClass}>
                                            <option value="">SELECCIONE...</option><option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                    <div><label className={labelClass}>F. Nacimiento *</label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} className={inputClass} /></div>
                                    <div>
                                        <label className={labelClass}>Lugar Nacimiento *</label>
                                        <CityAutocomplete name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                                    </div>
                                </div>

                                {/* Filiación */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10 mt-8">
                                    <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4 shadow-sm">
                                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
                                        <Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
                                    </div>
                                    <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4 shadow-sm">
                                        <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
                                        <Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
                                    </div>
                                </div>

                                {/* Abuelos y Union */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                                    <div><label className={labelClass}>Abuelos Paternos</label><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                    <div><label className={labelClass}>Abuelos Maternos</label><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChangeUpper} className={inputClass} /></div>
                                    <div>
                                        <label className={labelClass}>Tipo de Unión</label>
                                        <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChangeUpper} className={inputClass}>
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
                                <div className="mt-8"><label className={labelClass}>Padrinos</label><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} className={`${inputClass} py-6 font-bold`} /></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10 mt-8">
                                    <div><label className={labelClass}>Sacerdote Celebrante *</label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} className={`${inputClass} py-6 font-black text-blue-900 border-l-8 border-l-blue-500`} /></div>
                                    <div><label className={labelClass}>Da Fe (Firma Local Parroquia) *</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} className={`${inputClass} py-6 font-bold text-gray-600 bg-gray-100`} /></div>
                                </div>
                                
                                {/* 🚀 NOTA MARGINAL MANUAL */}
                                <div className="border-t pt-10 mt-8">
                                    <label className={labelClass}>Observaciones del Decreto (Opcional)</label>
                                    <textarea 
                                        name="observaciones" 
                                        value={newPartida.observaciones} 
                                        onChange={handleNewPartidaChangeUpper} 
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase font-bold text-gray-700 bg-amber-50"
                                        placeholder="ESCRIBA AQUÍ LAS OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BOTÓN DE GUARDADO FLOTANTE */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-end gap-4 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] lg:pl-64 z-20">
                            <Button variant="outline" onClick={() => navigate('/chancery/decree-correction/view')} className="px-8 font-black uppercase tracking-widest text-[10px] rounded-2xl">Cancelar</Button>
                            <Button onClick={handleSave} disabled={!foundRecord || isLoading} className="bg-gradient-to-r from-blue-600 to-blue-800 hover:scale-[1.02] text-white shadow-xl shadow-blue-900/20 font-black px-10 uppercase tracking-widest text-[10px] transition-all transform active:scale-95 rounded-2xl h-[45px]">
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