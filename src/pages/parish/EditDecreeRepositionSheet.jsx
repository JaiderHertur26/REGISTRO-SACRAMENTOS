import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, Loader2, Search, Trash2, ArrowLeft, History, BookOpen, Calendar, User, Fingerprint, PenTool, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete'; 
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService';

const EditDecreeRepositionSheet = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    
    // 🚀 AHORA SÍ: SOLO USAMOS EL CEREBRO GLOBAL
    const { getMisDatosList, getCiudadesList, getParrocos } = useAppData();

    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [originalPayload, setOriginalPayload] = useState(null);
    
    // 🚀 ESTADOS LIMPIOS PARA LAS LISTAS
    const [ciudades, setCiudades] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    const [decreeData, setDecreeData] = useState({
        decreeNumber: '', decreeDate: '', targetName: '', conceptoAnulacionId: '' 
    });

    const [newPartida, setNewPartida] = useState({
        sacramentDate: '', firstName: '', lastName: '', sex: 'MASCULINO',
        birthDate: '', placeOfBirth: '', fatherName: '', motherName: '',
        paternalGrandparents: '', maternalGrandparents: '', godparents: '',
        minister: '', ministerFaith: '', serialRegCivil: '', nuipNuit: '', 
        oficinaRegistro: '', fechaExpedicion: '', book_number: '', page_number: '', entry_number: '' 
    });

    const decreeId = searchParams.get('id');

    useEffect(() => {
        const loadDecreeData = async () => {
            if (!user?.parishId) return;
            setIsLoading(true);

            try {
                // 🚀 CARGA PURA DE CIUDADES COMO EN BAPTISM CELEBRATED PAGE
                const listaCruda = getCiudadesList(user.parishId) || [];
                setCiudades(listaCruda.map(c => (c.nombre || '').toUpperCase()));

                const parrocosList = getParrocos(user.parishId) || [];
                setListaSacerdotes(parrocosList);

                let targetDioceseId = user.dioceseId || user.diocese_id;
                if (!targetDioceseId) {
                    const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                    if (pData) targetDioceseId = pData.diocese_id;
                }

                if (targetDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', targetDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porReposicion' || (c.concepto && c.concepto.toLowerCase().includes('reposici'))));
                }

                const { data: decData } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion').eq('parish_id', user.parishId).order('created_at', { ascending: false });
                if (decData) {
                    const formattedData = decData.map(item => ({ id: item.id, ...item.payload }));
                    setDecrees(formattedData);
                }

                if (decreeId) {
                    const { data: decree, error } = await supabase.from('decretos').select('*').eq('id', decreeId).single();
                    if (error) throw error;

                    const payload = typeof decree.payload === 'string' ? JSON.parse(decree.payload) : decree.payload;
                    setOriginalPayload(payload);
                    setSelectedDecreeId(decreeId);

                    setDecreeData({
                        decreeNumber: payload.decreeNumber || payload.numeroDecreto || '',
                        decreeDate: payload.decreeDate || payload.fechaDecreto || '',
                        conceptoAnulacionId: payload.conceptoAnulacionId || ''
                    });

                    const bd = payload.datosNuevaPartida || payload.newPartidaSummary || {};
                    setNewPartida({
                        ...payload,
                        firstName: payload.firstName || bd.nombres || '',
                        lastName: payload.lastName || bd.apellidos || '',
                        sex: payload.sex || payload.sexo || 'MASCULINO',
                        sacramentDate: payload.sacramentDate || bd.fechaSacramento || bd.fecbau || '',
                        birthDate: payload.birthDate || bd.fechaNacimiento || bd.fecnac || '',
                        placeOfBirth: payload.placeOfBirth || bd.lugarNacimiento || bd.lugarNacimientoDetalle || bd.lugarn || '',
                        nombrePadre: payload.fatherName || payload.nombrePadre || bd.nombrePadre || bd.fatherName || '',
                        nombreMadre: payload.motherName || payload.nombreMadre || bd.nombreMadre || bd.motherName || '',
                        tipoUnionPadres: payload.tipoUnionPadres || bd.tipoUnionPadres || bd.tipohijo || '',
                        paternalGrandparents: payload.paternalGrandparents || bd.abuelosPaternos || bd.abuepat || '',
                        maternalGrandparents: payload.maternalGrandparents || bd.abuelosMaternos || bd.abuemat || '',
                        godparents: payload.godparents || bd.padrinos || '',
                        minister: payload.minister || bd.ministro || '',
                        ministerFaith: payload.daFe || payload.ministerFaith || bd.daFe || bd.ministerFaith || '',
                        book_number: bd.book || bd.book_number || '',
                        page_number: bd.page || bd.page_number || '',
                        entry_number: bd.entry || bd.entry_number || ''
                    });
                }
            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/parroquia/decretos/reposicion');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, decreeId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['firstName', 'lastName', 'fatherName', 'motherName', 'paternalGrandparents', 'maternalGrandparents', 'godparents', 'minister', 'ministerFaith', 'oficinaRegistro'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setNewPartida(prev => ({ ...prev, [name]: finalValue }));
    };

    // 🚀 MANEJADOR EXCLUSIVO PARA CITYAUTOCOMPLETE
    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, placeOfBirth: String(value).toUpperCase() }));
    };

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: name === 'decreeNumber' ? value.toUpperCase() : value }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);

        try {
            const pad = (num) => String(num).padStart(4, '0');
            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'REPOSICIÓN';
            const fechaTexto = convertDateToSpanishText(decreeData.decreeDate).replace(/^EL\s+/i, '').toUpperCase();
            
            const notaReposicion = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.decreeNumber.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${causaText}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

            const { data: supData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', user.parishId)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number)).maybeSingle();

            if (supData) {
                const updatedRaw = {
                    ...supData.raw_data, ...newPartida,
                    nombres: newPartida.firstName, apellidos: newPartida.lastName,
                    fecbau: newPartida.sacramentDate, fecnac: newPartida.birthDate,
                    lugarn: newPartida.placeOfBirth, sex: newPartida.sex,
                    padre: newPartida.fatherName, madre: newPartida.motherName, tipohijo: newPartida.tipoUnionPadres, 
                    godparents: newPartida.godparents, minister: newPartida.minister, dafe: newPartida.ministerFaith, 
                    notaMarginal: notaReposicion
                };
                
                await supabase.from('baptisms').update({ 
                    celebration_date: newPartida.sacramentDate || null, nombres: newPartida.firstName, apellidos: newPartida.lastName,
                    sexo: newPartida.sex, fecha_nacimiento: newPartida.birthDate || null, lugar_nacimiento: newPartida.placeOfBirth, 
                    nombre_padre: newPartida.fatherName, nombre_madre: newPartida.motherName, padrinos: newPartida.godparents, 
                    ministro: newPartida.minister, da_fe: newPartida.ministerFaith, tipo_union_padres: newPartida.tipoUnionPadres, 
                    nota_marginal: notaReposicion, raw_data: updatedRaw
                }).eq('id', supData.id);
            }

            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.decreeNumber, numeroDecreto: decreeData.decreeNumber,
                decreeDate: decreeData.decreeDate, fechaDecreto: decreeData.decreeDate,
                conceptoAnulacionId: decreeData.conceptoAnulacionId, causa: causaText,
                targetName: `${newPartida.lastName} ${newPartida.firstName}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number },
                newPartidaSummary: { book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number, nombres: newPartida.firstName, apellidos: newPartida.lastName }
            };

            await supabase.from('decretos').update({ payload: newPayload }).eq('id', selectedDecreeId);

            toast({ title: "Guardado Exitoso", description: "La reposición se actualizó en la Nube.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/decretos/reposicion');

        } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            await supabase.from('baptisms').delete().eq('parish_id', user.parishId)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number));
            await supabase.from('decretos').delete().eq('id', selectedDecreeId);

            // --- INICIO DE REVERSA MATEMÁTICA DE CONSECUTIVOS ---
            try {
                const parishIdTarget = user.parishId;

                // 1. Consultar los parámetros EXACTOS actuales en el momento de eliminar
                const { data: paramsData } = await supabase
                    .from('parish_parameters')
                    .select('bautizos_params')
                    .eq('parish_id', parishIdTarget)
                    .single();

                if (paramsData && paramsData.bautizos_params) {
                    const cloudParams = paramsData.bautizos_params;
                    
                    // 2. Calcular el consecutivo anterior con SALVAVIDAS
                    const previosSupletorios = calculatePreviousConsecutive(
                        cloudParams.suplementarioNumero,
                        cloudParams.suplementarioFolio,
                        cloudParams.suplementarioLibro,
                        cloudParams.suplementarioPartidas || 2,
                        cloudParams.suplementarioReiniciar || false
                    );

                    // 3. Empacar y actualizar
                    const newParams = { 
                        ...cloudParams, 
                        suplementarioNumero: previosSupletorios.numero,
                        suplementarioFolio: previosSupletorios.folio,
                        suplementarioLibro: previosSupletorios.libro
                    };

                    await supabase.from('parish_parameters').upsert({ 
                        parish_id: parishIdTarget, 
                        bautizos_params: newParams 
                    }, { onConflict: 'parish_id' });
                }
            } catch (err) {
                console.error("Error revirtiendo el consecutivo en la nube:", err);
            }
            // --- FIN DE REVERSA MATEMÁTICA ---

            toast({ title: "Eliminado", description: "El decreto y la partida supletoria han sido removidos.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/decretos/reposicion');
        } catch (e) { toast({ title: "Error", description: "Fallo al eliminar de la Nube.", variant: "destructive" }); } 
        finally { setIsSubmitting(false); setShowDeleteModal(false); }
    };

    const filteredDecrees = decrees.filter(d => (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    // --- ESTILOS VISUALES PREMIUM ---
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <datalist id="lista-parrocos">
                {listaSacerdotes.map((s, idx) => <option key={idx} value={`${s.nombre} ${s.apellido || ''}`.trim().toUpperCase()} />)}
            </datalist>

            <div className="max-w-[1400px] mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/decretos/reposicion')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Editor de Reposición</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Ajuste de Partidas Supletorias en la Nube</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-180px)] min-h-[600px]">
                    {/* LEFT SIDEBAR: LIST */}
                    <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#4B7BA7] transition-colors" />
                                <input placeholder="Buscar decreto..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#4B7BA7]/10 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredDecrees.length === 0 ? (<p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center py-8">No hay decretos.</p>) : (
                                filteredDecrees.map((decree) => (
                                    <button key={decree.id} onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${decree.id}`)} className={cn("w-full text-left p-4 rounded-2xl transition-all border group", selectedDecreeId === decree.id ? "bg-[#4B7BA7] border-[#4B7BA7] text-white shadow-lg shadow-blue-900/20" : "bg-white border-transparent hover:border-gray-200 text-gray-600")}>
                                        <div className="font-black text-gray-800 flex justify-between items-center"><span className={cn("font-mono text-sm tracking-tighter", selectedDecreeId === decree.id ? "text-white" : "")}>{decree.decreeNumber || decree.numeroDecreto}</span></div>
                                        <div className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === decree.id ? "text-blue-100" : "text-gray-400")}>{decree.targetName || decree.nombres}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: FORM */}
                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                            {!selectedDecreeId ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                                    <History className="w-16 h-16" />
                                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto de la lista</p>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdate} className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
                                    
                                    {/* 01. DECRETO MAESTRO */}
                                    <section>
                                        <SectionHeader number="01" title="Decreto Maestro" icon={FileText} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div><label className={labelClass}>Número de Decreto</label><input name="decreeNumber" value={decreeData.decreeNumber} onChange={handleDecreeChange} className={`${inputClass} border-blue-200 bg-blue-50/30 text-[#4B7BA7] placeholder-blue-300`} /></div>
                                            <div><label className={labelClass}>Fecha Emisión</label><input type="date" name="decreeDate" value={decreeData.decreeDate} onChange={handleDecreeChange} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Causa de Reposición</label>
                                                <select name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className={inputClass}>
                                                    <option value="">SELECCIONE CONCEPTO...</option>
                                                    {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 02. UBICACIÓN SUPLETORIA */}
                                    <section>
                                        <SectionHeader number="02" title="Protocolo de Archivo Supletorio" icon={BookOpen} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                            <div><label className={labelClass}>Libro (Nuevo)</label><input readOnly name="book_number" value={newPartida.book_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Folio (Nuevo)</label><input readOnly name="page_number" value={newPartida.page_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Número / Acta (Nuevo)</label><input readOnly name="entry_number" value={newPartida.entry_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        </div>
                                    </section>

                                    {/* 03. ASIGNACIÓN DEL SACRAMENTO */}
                                    <section>
                                        <SectionHeader number="03" title="Asiento del Sacramento" icon={Calendar} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="sacramentDate" value={newPartida.sacramentDate} onChange={handleChange} className={inputClass} /></div>
                                        </div>
                                    </section>

                                    {/* 04. IDENTIDAD DEL SUJETO */}
                                    <section>
                                        <SectionHeader number="04" title="Identidad del Bautizado" icon={User} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Apellidos Completos</label><input name="lastName" value={newPartida.lastName} onChange={handleChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Nombres Completos</label><input name="firstName" value={newPartida.firstName} onChange={handleChange} className={inputClass} /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div>
                                                <label className={labelClass}>Sexo</label>
                                                <select name="sex" value={newPartida.sex} onChange={handleChange} className={inputClass}>
                                                    <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                                </select>
                                            </div>
                                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="birthDate" value={newPartida.birthDate} onChange={handleChange} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Lugar de Nacimiento</label>
                                                {/* 🚀 AUTOCOMPLETADO DE CIUDADES ENCHUFADO */}
                                                <CityAutocomplete name="placeOfBirth" value={newPartida.placeOfBirth} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 05. FILIACIÓN */}
                                    <section>
                                        <SectionHeader number="05" title="Filiación y Rama Genealógica" icon={Fingerprint} />
                                        <div className="mb-8">
                                            <label className={labelClass}>Tipo de Unión de Padres</label>
                                            <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                                <input name="fatherName" placeholder="NOMBRE DEL PADRE" value={newPartida.fatherName} onChange={handleChange} className={inputClass} />
                                                <textarea name="paternalGrandparents" placeholder="ABUELOS PATERNOS" value={newPartida.paternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                            <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                                <input name="motherName" placeholder="NOMBRE DE LA MADRE" value={newPartida.motherName} onChange={handleChange} className={inputClass} />
                                                <textarea name="maternalGrandparents" placeholder="ABUELOS MATERNOS" value={newPartida.maternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 06. AUTORIDAD */}
                                    <section>
                                        <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Sacerdote Celebrante</label><input name="minister" list="lista-parrocos" value={newPartida.minister} onChange={handleChange} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} /></div>
                                            <div><label className={labelClass}>Firma (Da Fe) *</label><input name="ministerFaith" required list="lista-parrocos" value={newPartida.ministerFaith} onChange={handleChange} className={inputClass} /></div>
                                        </div>
                                        <div><label className={labelClass}>Padrinos</label><input name="godparents" value={newPartida.godparents} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                    </section>

                                    <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                        <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting} className="px-10 py-8 rounded-2xl text-red-400 hover:bg-red-50 hover:text-red-600 font-black uppercase text-[10px] transition-all"><Trash2 className="w-5 h-5 mr-3"/> Eliminar Decreto</Button>
                                        <Button type="submit" disabled={isSubmitting || isLoading} className="bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Sincronizar Cambios
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <ConfirmationDialog 
                    isOpen={showDeleteModal}
                    title="Restaurar Consecutivos y Eliminar"
                    message="Esta acción borrará el registro del decreto y eliminará la partida supletoria permanentemente de la Nube."
                    onConfirm={handleDelete}
                    onClose={() => setShowDeleteModal(false)}
                    variant="destructive"
                    confirmText="Sí, Eliminar Todo"
                />
            </div>
        </DashboardLayout>
    );
};

export default EditDecreeRepositionSheet;