import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, Loader2, ShieldCheck, BookOpen, Calendar, User, Fingerprint, PenTool, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete'; 
import { calculateNextConsecutive } from '@/services/sacramentParametersService';

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS
const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const NewDecreeReplacementPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    // 🚀 CEREBRO GLOBAL
    const { getMisDatosList } = useAppData();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- ESTADOS EXCLUSIVOS CANCILLERÍA (100% NUBE) ---
    const [parishesList, setParishesList] = useState([]);
    const [conceptos, setConceptos] = useState([]);
    const [chanceryNotesConfig, setChanceryNotesConfig] = useState(null);
    const [cloudParams, setCloudParams] = useState({});
    
    // --- ESTADOS PARA LAS LISTAS DEPENDIENTES DE LA PARROQUIA ---
    const [ciudades, setCiudades] = useState([]);
    
    // Contadores en vivo desde Supabase
    const [nextParams, setNextParams] = useState({ libro: '', folio: '', numero: '' });

    // 🚀 ESTADOS PARA MÁQUINA DEL TIEMPO EN CANCILLERÍA
    const [targetPriests, setTargetPriests] = useState([]);
    const [sacerdoteDestinoPorDefecto, setSacerdoteDestinoPorDefecto] = useState('');

    // --- ESTADOS DE FORMULARIO ---
    const [bautismoDecree, setBautismoDecree] = useState({ 
        parroquia: '', targetParishId: '', numeroDecreto: '', 
        fechaDecreto: new Date().toISOString().split('T')[0], conceptoAnulacionId: '' 
    });
    
    const [bautismoNewPartida, setBautismoNewPartida] = useState({
        sacramentDate: '', firstName: '', lastName: '', birthDate: '', 
        lugarNacimientoDetalle: '', lugarBautismo: '', fatherName: '', ceduPadre: '', 
        motherName: '', ceduMadre: '', tipoUnionPadres: 'MATRIMONIO CATÓLICO', sex: 'MASCULINO', 
        paternalGrandparents: '', maternalGrandparents: '', godparents: '', 
        minister: '', ministerFaith: '', serialRegCivil: '', nuipNuit: '', 
        oficinaRegistro: '', fechaExpedicion: ''
    });

    // 1. CARGA INICIAL: Obtener Parroquias y Conceptos Directamente de Supabase
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

                // Cargar Membrete de Cancillería
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

                setBautismoDecree(prev => ({ ...prev, parroquia: entityLabel }));

                // Cargar Plantillas de Notas de Cancillería
                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', entityId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    setChanceryNotesConfig(chanceryParams.bautizos_params.plantillas_notas);
                }

                if (currentDioceseId) {
                    // Cargar Conceptos
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', currentDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porReposicion' || (c.concepto && c.concepto.toLowerCase().includes('reposici'))));

                    // Cargar Parroquias de la Diócesis
                    const { data: pData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (pData) setParishesList(pData);
                }

            } catch (error) {
                console.error("Error inicializando datos:", error);
            }
        };

        initializeData();
    }, [user, getMisDatosList]);

    // 2. EFECTO REACTIVO: Cuando la Cancillería elige la Parroquia Destino, traemos sus parámetros EN VIVO
    useEffect(() => {
        const fetchParishLiveParams = async () => {
            const pid = bautismoDecree.targetParishId;
            if (!pid) {
                setCloudParams({});
                setNextParams({ libro: '', folio: '', numero: '' });
                setBautismoNewPartida(prev => ({ ...prev, ministerFaith: '', minister: '' }));
                setCiudades([]);
                setTargetPriests([]);
                setSacerdoteDestinoPorDefecto('');
                return;
            }

            try {
                // A. Traer Consecutivos Supletorios
                const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', pid).maybeSingle();
                if (pData && pData.bautizos_params) {
                    setCloudParams(pData.bautizos_params);
                    setNextParams({
                        libro: String(pData.bautizos_params.suplementarioLibro || '1').padStart(4, '0'),
                        folio: String(pData.bautizos_params.suplementarioFolio || '1').padStart(4, '0'),
                        numero: String(pData.bautizos_params.suplementarioNumero || '1').padStart(4, '0')
                    });
                } else {
                    setNextParams({ libro: '0001', folio: '0001', numero: '0001' });
                }

                // B. Traer Párroco Activo de la Parroquia Seleccionada
                let priestList = [];
                let activePriestName = 'PÁRROCO ENCARGADO';
                const { data: priestData } = await supabase.from('parrocos').select('payload').eq('parish_id', pid);
                
                if (priestData && priestData.length > 0) {
                    priestList = priestData.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload);
                    setTargetPriests(priestList);
                    
                    const active = priestList.find(r => String(r.estado || r.Estado) === '1');
                    if (active) {
                        activePriestName = `${active.nombre || ''} ${active.apellido || ''}`.trim().toUpperCase();
                    }
                } else {
                    setTargetPriests([]);
                }
                
                setSacerdoteDestinoPorDefecto(activePriestName);
                
                // Setear inicialmente por defecto (se sobreescribirá por la máquina del tiempo si hay fechas)
                setBautismoNewPartida(prev => ({ ...prev, ministerFaith: activePriestName, minister: activePriestName }));

                // C. Traer Ciudades Registradas de esa Parroquia
                const { data: citiesData } = await supabase.from('ciudades').select('nombre').eq('context_id', pid);
                if (citiesData) {
                    setCiudades(citiesData.map(c => (c.nombre || '').toUpperCase()));
                } else {
                    setCiudades([]);
                }

            } catch (error) {
                console.error("Error conectando con la parroquia destino:", error);
            }
        };

        fetchParishLiveParams();
    }, [bautismoDecree.targetParishId]);

    // 🚀 MÁQUINA DEL TIEMPO 1: EL "DA FE" VIAJA CON LA FECHA DEL DECRETO
    useEffect(() => {
        if (!bautismoDecree.fechaDecreto || targetPriests.length === 0) return;

        const dStr = bautismoDecree.fechaDecreto.includes('T') ? bautismoDecree.fechaDecreto : `${bautismoDecree.fechaDecreto}T12:00:00`;
        const fechaDec = new Date(dStr);
        
        if (!isNaN(fechaDec.getTime())) {
            const sacerdoteEpoca = targetPriests.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                const inicio = new Date(iStr);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaDec >= inicio && fechaDec <= fin;
            });

            if (sacerdoteEpoca) {
                const histPriest = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
                setBautismoNewPartida(prev => ({ 
                    ...prev, 
                    ministerFaith: histPriest 
                }));
            } else {
                setBautismoNewPartida(prev => ({ 
                    ...prev, 
                    ministerFaith: sacerdoteDestinoPorDefecto 
                }));
            }
        }
    }, [bautismoDecree.fechaDecreto, targetPriests, sacerdoteDestinoPorDefecto]);

    // 🚀 MÁQUINA DEL TIEMPO 2: EL "MINISTRO" VIAJA CON LA FECHA DEL SACRAMENTO
    useEffect(() => {
        if (!bautismoNewPartida.sacramentDate || targetPriests.length === 0) return;

        const dStr = bautismoNewPartida.sacramentDate.includes('T') ? bautismoNewPartida.sacramentDate : `${bautismoNewPartida.sacramentDate}T12:00:00`;
        const fechaSac = new Date(dStr);
        
        if (!isNaN(fechaSac.getTime())) {
            const sacerdoteEpoca = targetPriests.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                const inicio = new Date(iStr);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaSac >= inicio && fechaSac <= fin;
            });

            if (sacerdoteEpoca) {
                const histPriest = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
                setBautismoNewPartida(prev => ({ 
                    ...prev, 
                    minister: histPriest 
                }));
            }
        }
    }, [bautismoNewPartida.sacramentDate, targetPriests]);

    // --- MANEJADORES DE ESTADO ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['firstName', 'lastName', 'fatherName', 'motherName', 'paternalGrandparents', 'maternalGrandparents', 'godparents', 'minister', 'ministerFaith', 'oficinaRegistro', 'lugarBautismo'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setBautismoNewPartida(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setBautismoNewPartida(prev => ({ ...prev, lugarNacimientoDetalle: String(value).toUpperCase() }));
    };

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setBautismoDecree(prev => ({ ...prev, [name]: name === 'numeroDecreto' ? value.toUpperCase() : value }));
    };

    // --- SUBMIT 100% SUPABASE ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!bautismoDecree.targetParishId) {
            return toast({ title: "Faltan Datos", description: "Debe seleccionar la Parroquia Destino.", variant: "destructive" });
        }

        if (!bautismoDecree.numeroDecreto || !bautismoNewPartida.firstName || !bautismoNewPartida.lastName || !bautismoDecree.conceptoAnulacionId) {
            toast({ title: "Faltan Datos", description: "Complete los campos obligatorios (*).", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Validar Duplicidad de Decreto en esa Parroquia
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'reposicion')
                .eq('parish_id', bautismoDecree.targetParishId).contains('payload', { decreeNumber: bautismoDecree.numeroDecreto }).maybeSingle();

            if (existingDecree) {
                setIsSubmitting(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${bautismoDecree.numeroDecreto} ya existe en esa Parroquia.`, variant: "destructive" }); 
                return;
            }

            // 2. Motor de Notas (Usando plantillas de Cancillería o Defaults)
            const conceptoMatch = conceptos.find(c => String(c.id) === String(bautismoDecree.conceptoAnulacionId));
            const conceptoText = conceptoMatch?.concepto || 'REPOSICIÓN POR DETERIORO O PÉRDIDA';
            const fechaTexto = convertDateToSpanishText(bautismoDecree.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
            
            // 🚀 LIMPIEZA DE FIRMAS Y EMPAQUE SEGURO
            let finalMin = cleanTitle(bautismoNewPartida.minister);
            finalMin = finalMin !== 'EL PÁRROCO' && finalMin ? `PBRO. ${finalMin}` : finalMin;
            
            let finalDaFe = cleanTitle(bautismoNewPartida.ministerFaith);
            finalDaFe = finalDaFe !== 'EL PÁRROCO' && finalDaFe ? `PBRO. ${finalDaFe}` : finalDaFe;

            // Obtener Parámetros en vivo (por si alguien guardó mientras rellenábamos)
            const { data: latestParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', bautismoDecree.targetParishId).single();
            const currentParams = latestParams?.bautizos_params || cloudParams;
            
            const supletorioLibro = String(currentParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(currentParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(currentParams.suplementarioNumero || '1').padStart(4, '0');

            let templateNueva = chanceryNotesConfig?.reposicion_nueva || "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], MOTIVO: [CAUSA_REPOSICION]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.";
            
            const notaMarginalTecnica = templateNueva
                .replace(/\[NUMERO_DECRETO\]/g, bautismoDecree.numeroDecreto.toUpperCase())
                .replace(/\[FECHA_DECRETO\]/g, fechaTexto)
                .replace(/\[CAUSA_REPOSICION\]/g, conceptoText.toUpperCase())
                .replace(/\[MINISTRO\]/g, finalDaFe);

            // 3. Preparar Partida Supletoria
            const partidaToSave = {
                ...bautismoNewPartida,
                Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
                book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
                nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName,
                fecbau: bautismoNewPartida.sacramentDate, fecnac: bautismoNewPartida.birthDate,
                lugarn: bautismoNewPartida.lugarNacimientoDetalle, sex: bautismoNewPartida.sex,
                padre: bautismoNewPartida.fatherName, madre: bautismoNewPartida.motherName, tipohijo: bautismoNewPartida.tipoUnionPadres,
                abuepat: bautismoNewPartida.paternalGrandparents, abuemat: bautismoNewPartida.maternalGrandparents,
                padrinos: bautismoNewPartida.godparents, 
                ministro: finalMin, dafe: finalDaFe, daFe: finalDaFe, // Multillave purificada
                anulado: false, status: 'seated', notaMarginal: notaMarginalTecnica
            };

            const payloadDecree = {
                decreeNumber: bautismoDecree.numeroDecreto, numeroDecreto: bautismoDecree.numeroDecreto,
                decreeDate: bautismoDecree.fechaDecreto, conceptoAnulacionId: bautismoDecree.conceptoAnulacionId,
                causa: conceptoText, targetName: `${bautismoNewPartida.lastName} ${bautismoNewPartida.firstName}`.trim(),
                ...bautismoNewPartida,
                ministro: finalMin, daFe: finalDaFe, dafe: finalDaFe, ministerFaith: finalDaFe, // 🚀 MULTILLAVE AL PDF
                datosNuevaPartida: { ...bautismoNewPartida, book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero, daFe: finalDaFe },
                newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName, daFe: finalDaFe }
            };

            // 4. Inserción Directa de Partida a Supabase
            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: bautismoDecree.targetParishId, book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
                celebration_date: bautismoNewPartida.sacramentDate || null, nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName, sexo: bautismoNewPartida.sex,
                fecha_nacimiento: bautismoNewPartida.birthDate || null, lugar_nacimiento: bautismoNewPartida.lugarNacimientoDetalle,
                nombre_padre: bautismoNewPartida.fatherName, nombre_madre: bautismoNewPartida.motherName, tipo_union_padres: bautismoNewPartida.tipoUnionPadres,
                abuelos_paternos: bautismoNewPartida.paternalGrandparents, abuelos_maternos: bautismoNewPartida.maternalGrandparents, padrinos: bautismoNewPartida.godparents,
                ministro: finalMin, da_fe: finalDaFe, status: 'seated', nota_marginal: notaMarginalTecnica,
                raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            // 5. Inserción del Decreto a Supabase
            payloadDecree.newPartidaId = newBap.id;
            await supabase.from('decretos').insert([{ parish_id: bautismoDecree.targetParishId, tipo: 'reposicion', payload: payloadDecree }]);

            // 6. Calcular e incrementar consecutivos correctamente con el motor
            const siguientesSupletorios = calculateNextConsecutive(
                currentParams.suplementarioNumero,
                currentParams.suplementarioFolio,
                currentParams.suplementarioLibro,
                currentParams.suplementarioPartidas || 2, 
                currentParams.suplementarioReiniciar || false
            );

            const newParams = { 
                ...currentParams, 
                suplementarioNumero: siguientesSupletorios.numero,
                suplementarioFolio: siguientesSupletorios.folio,
                suplementarioLibro: siguientesSupletorios.libro
            };

            await supabase.from('parish_parameters').upsert({ 
                parish_id: bautismoDecree.targetParishId, 
                bautizos_params: newParams 
            }, { onConflict: 'parish_id' });

            toast({ title: "Reposición Exitosa", description: "Partida y Decreto sincronizados remotamente.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-replacement/view');

        } catch (error) { 
            toast({ title: "Error en Proceso", description: error.message, variant: "destructive" }); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    // --- ESTILOS VISUALES ---
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-amber-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-amber-500" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>

            <div className="max-w-5xl mx-auto pb-20 pt-6">
                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement/view')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Decreto de Reposición</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold border border-amber-200">ACCESO CANCILLERÍA</span>
                                Inyección Remota en Libros Parroquiales
                            </p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-2xl h-14">
                        <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmacion" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonio" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Matrimonios</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautismo" className="focus:outline-none">
                        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-[#D4AF37] to-amber-500"></div>

                            <div className="p-12 space-y-10">
                                {/* 01. DECRETO MAESTRO */}
                                <section>
                                    <SectionHeader number="01" title="Información del Decreto" icon={FileText} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="md:col-span-3">
                                            <label className={labelClass}>Parroquia Destino (Dónde se asentará) *</label>
                                            <select required name="targetParishId" value={bautismoDecree.targetParishId} onChange={(e) => setBautismoDecree({...bautismoDecree, targetParishId: e.target.value})} className={`${inputClass} border-amber-200 bg-amber-50/30 text-amber-700`}>
                                                <option value="">-- SELECCIONE LA PARROQUIA DE LA DIÓCESIS --</option>
                                                {parishesList.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()} - {(p.city || '').toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div><label className={labelClass}>Número de Decreto *</label><input required name="numeroDecreto" value={bautismoDecree.numeroDecreto} onChange={handleDecreeChange} className={inputClass} placeholder="EJ: 005-2025" /></div>
                                        <div><label className={labelClass}>Fecha de Emisión *</label><input type="date" required name="fechaDecreto" value={bautismoDecree.fechaDecreto} onChange={handleDecreeChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Causa de la Reposición *</label>
                                            <select required name="conceptoAnulacionId" value={bautismoDecree.conceptoAnulacionId} onChange={handleDecreeChange} className={inputClass}>
                                                <option value="">SELECCIONE CONCEPTO...</option>
                                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* 02. UBICACIÓN SUPLETORIA */}
                                <section className={`transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                    <SectionHeader number="02" title="Protocolo de Archivo Supletorio Remoto" icon={BookOpen} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                        <div><label className={labelClass}>Libro (Nuevo)</label><input readOnly value={nextParams.libro} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-amber-600 shadow-sm outline-none text-center" /></div>
                                        <div><label className={labelClass}>Folio (Nuevo)</label><input readOnly value={nextParams.folio} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        <div><label className={labelClass}>Número / Acta (Nuevo)</label><input readOnly value={nextParams.numero} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                    </div>
                                </section>

                                {/* 03. ASIGNACIÓN DEL SACRAMENTO */}
                                <section className={`transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                    <SectionHeader number="03" title="Asiento del Sacramento" icon={Calendar} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="sacramentDate" value={bautismoNewPartida.sacramentDate} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                </section>

                                {/* 04. IDENTIDAD DEL SUJETO */}
                                <section className={`transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                    <SectionHeader number="04" title="Identidad del Bautizado" icon={User} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                        <div><label className={labelClass}>Apellidos Completos *</label><input name="lastName" required value={bautismoNewPartida.lastName} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Nombres Completos *</label><input name="firstName" required value={bautismoNewPartida.firstName} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div>
                                            <label className={labelClass}>Sexo</label>
                                            <select name="sex" value={bautismoNewPartida.sex} onChange={handleChange} className={inputClass}>
                                                <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                            </select>
                                        </div>
                                        <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="birthDate" value={bautismoNewPartida.birthDate} onChange={handleChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Lugar de Nacimiento</label>
                                            <CityAutocomplete 
                                                name="placeOfBirth" 
                                                value={bautismoNewPartida.lugarNacimientoDetalle} 
                                                onChange={handleCityChange} 
                                                cities={ciudades} 
                                                className={inputClass} 
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* 05. FILIACIÓN */}
                                <section className={`transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                    <SectionHeader number="05" title="Filiación y Rama Genealógica" icon={Fingerprint} />
                                    <div className="mb-8">
                                        <label className={labelClass}>Tipo de Unión de Padres</label>
                                        <select name="tipoUnionPadres" value={bautismoNewPartida.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                            <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                        <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                            <input name="fatherName" placeholder="NOMBRE DEL PADRE" value={bautismoNewPartida.fatherName} onChange={handleChange} className={inputClass} />
                                            <textarea name="paternalGrandparents" placeholder="ABUELOS PATERNOS" value={bautismoNewPartida.paternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                        </div>
                                        <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                            <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                            <input name="motherName" placeholder="NOMBRE DE LA MADRE" value={bautismoNewPartida.motherName} onChange={handleChange} className={inputClass} />
                                            <textarea name="maternalGrandparents" placeholder="ABUELOS MATERNOS" value={bautismoNewPartida.maternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                        </div>
                                    </div>
                                </section>

                                {/* 06. AUTORIDAD */}
                                <section className={`transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                    <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                        <div><label className={labelClass}>Sacerdote Celebrante</label><input name="minister" value={bautismoNewPartida.minister} onChange={handleChange} className={`${inputClass} border-l-8 border-l-amber-500`} /></div>
                                        <div><label className={labelClass}>Firma (Da Fe) *</label><input name="ministerFaith" required value={bautismoNewPartida.ministerFaith} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div><label className={labelClass}>Padrinos</label><input name="godparents" value={bautismoNewPartida.godparents} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                </section>

                                <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                    <Button type="button" variant="ghost" onClick={() => navigate('/chancery/decree-replacement/view')} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                                    <Button type="submit" disabled={isSubmitting || !bautismoDecree.targetParishId} className="bg-gradient-to-r from-amber-600 to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Emitir Decreto Remoto
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeReplacementPage;