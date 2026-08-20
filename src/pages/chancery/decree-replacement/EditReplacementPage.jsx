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

const ChanceryDecreeReplacementEditPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
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
    const [auxiliares, setAuxiliares] = useState({ ciudades: [], ministros: [] });

    const [decreeData, setDecreeData] = useState({
        parroquia: '', decreeNumber: '', decreeDate: '', targetName: '', conceptoAnulacionId: '' 
    });

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

                if (targetDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', targetDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porReposicion' || (c.concepto && c.concepto.toLowerCase().includes('reposici'))));
                }

                const { data: parishesData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', targetDioceseId);
                const pIds = parishesData ? parishesData.map(p => p.id) : [];

                if (pIds.length > 0) {
                    const { data: decData } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion').in('parish_id', pIds).order('created_at', { ascending: false });
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

                    const parishObj = parishesData?.find(p => p.id === parishId);
                    setDecreeData({
                        parroquia: parishObj ? `${parishObj.name} - ${parishObj.city}` : 'Parroquia',
                        decreeNumber: payload.decreeNumber || payload.numeroDecreto || '',
                        decreeDate: payload.decreeDate || payload.fechaDecreto || '',
                        conceptoAnulacionId: payload.conceptoAnulacionId || ''
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
                        nombres: payload.firstName || bd.nombres || bd.firstName || '',
                        apellidos: payload.lastName || bd.apellidos || bd.lastName || '',
                        sexo: payload.sex || bd.sexo || bd.sex || 'MASCULINO',
                        fechaSacramento: payload.sacramentDate || bd.fechaSacramento || bd.fecbau || '',
                        fechaNacimiento: payload.birthDate || bd.fechaNacimiento || bd.fecnac || '',
                        lugarNacimiento: payload.placeOfBirth || bd.lugarNacimiento || bd.lugarNacimientoDetalle || bd.lugarn || '',
                        lugarBautismo: payload.lugarBautismo || bd.lugarBautismo || bd.lugbau || '',
                        nombrePadre: payload.fatherName || bd.nombrePadre || bd.fatherName || '',
                        nombreMadre: payload.motherName || bd.nombreMadre || bd.motherName || '',
                        tipoUnionPadres: payload.tipoUnionPadres || bd.tipoUnionPadres || bd.tipohijo || '',
                        abuelosPaternos: payload.paternalGrandparents || bd.abuelosPaternos || bd.abuepat || '',
                        abuelosMaternos: payload.maternalGrandparents || bd.abuelosMaternos || bd.abuemat || '',
                        padrinos: payload.godparents || bd.padrinos || '',
                        ministro: payload.minister || bd.ministro || '',
                        daFe: payload.daFe || payload.ministerFaith || bd.daFe || bd.ministerFaith || '',
                        book_number: bd.book || bd.book_number || '',
                        page_number: bd.page || bd.page_number || '',
                        entry_number: bd.entry || bd.entry_number || ''
                    });
                }
            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/chancery/decree-replacement');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, decreeId, getCiudadesList, getParrocos]);

    const handleDecreeChange = (e) => setDecreeData(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChange = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);

        try {
            const pad = (num) => String(num).padStart(4, '0');
            const targetParish = newPartida.parishId;

            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'REPOSICIÓN';
            const fechaTexto = convertDateToSpanishText(decreeData.decreeDate).replace(/^EL\s+/i, '').toUpperCase();
            
            const notaReposicion = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.decreeNumber.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${causaText}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

            const { data: supData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', targetParish)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number)).maybeSingle();

            if (supData) {
                const updatedRaw = {
                    ...supData.raw_data, ...newPartida,
                    nombres: newPartida.nombres, apellidos: newPartida.apellidos,
                    fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento,
                    lugarn: newPartida.lugarNacimiento, sex: newPartida.sexo,
                    padre: newPartida.nombrePadre, madre: newPartida.nombreMadre, tipohijo: newPartida.tipoUnionPadres, 
                    godparents: newPartida.padrinos, minister: newPartida.ministro, dafe: newPartida.daFe, 
                    notaMarginal: notaReposicion
                };
                
                await supabase.from('baptisms').update({ 
                    celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos,
                    sexo: newPartida.sexo, fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, 
                    lugar_bautismo: newPartida.lugarBautismo, nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, 
                    padrinos: newPartida.padrinos, ministro: newPartida.ministro, da_fe: newPartida.daFe, tipo_union_padres: newPartida.tipoUnionPadres, 
                    nota_marginal: notaReposicion, raw_data: updatedRaw
                }).eq('id', supData.id);
            }

            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.decreeNumber, numeroDecreto: decreeData.decreeNumber,
                decreeDate: decreeData.decreeDate, fechaDecreto: decreeData.decreeDate,
                conceptoAnulacionId: decreeData.conceptoAnulacionId, causa: causaText,
                targetName: `${newPartida.apellidos} ${newPartida.nombres}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number },
                newPartidaSummary: { book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
            };

            await supabase.from('decretos').update({ payload: newPayload }).eq('id', selectedDecreeId);

            toast({ title: "Guardado Exitoso", description: "La reposición se actualizó en la Parroquia.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-replacement');

        } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const targetParish = newPartida.parishId;

            await supabase.from('baptisms').delete().eq('parish_id', targetParish)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number));

            await supabase.from('decretos').delete().eq('id', selectedDecreeId);

            // --- INICIO DE REVERSA MATEMÁTICA DE CONSECUTIVOS ---
try {
    const parishIdTarget = newPartida.parishId; // ← Así apuntará a la parroquia a la que se le anula el decreto

    // 1. Consultar los parámetros EXACTOS actuales en el momento de eliminar
    const { data: paramsData } = await supabase
        .from('parish_parameters')
        .select('bautizos_params')
        .eq('parish_id', parishIdTarget)
        .single();

    if (paramsData && paramsData.bautizos_params) {
        const cloudParams = paramsData.bautizos_params;
        
        // 2. Calcular el consecutivo anterior (Retroceso)
        const previosSupletorios = calculatePreviousConsecutive(
            cloudParams.suplementarioNumero,
            cloudParams.suplementarioFolio,
            cloudParams.suplementarioLibro,
            cloudParams.suplementarioPartidas,
            cloudParams.suplementarioReiniciar
        );

        // 3. Empacar y actualizar la base de datos con los números retrocedidos
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
            navigate('/chancery/decree-replacement');
        } catch (e) { toast({ title: "Error", description: "Fallo al eliminar de la Nube.", variant: "destructive" }); } 
        finally { setIsSubmitting(false); setShowDeleteModal(false); }
    };

    const filteredDecrees = decrees.filter(d => (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-amber-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-amber-500" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <datalist id="ciudades-list">{auxiliares.ciudades?.map((c, i) => <option key={i} value={c} />)}</datalist>
            <datalist id="ministros-list">{auxiliares.ministros?.map((m, i) => <option key={i} value={m} />)}</datalist>

            <div className="max-w-[1400px] mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Editor de Reposición</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Ajuste de Partidas Supletorias y Sincronización</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-180px)] min-h-[600px]">
                    <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                                <input placeholder="Buscar decreto..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500/10 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredDecrees.length === 0 ? (<p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center py-8">No hay decretos.</p>) : (
                                filteredDecrees.map((decree) => (
                                    <button key={decree.id} onClick={() => navigate(`/chancery/decree-replacement/edit?id=${decree.id}`)} className={cn("w-full text-left p-4 rounded-2xl transition-all border group", selectedDecreeId === decree.id ? "bg-amber-50 border-amber-200 ring-1 ring-amber-300 shadow-sm" : "bg-white border-transparent hover:border-gray-200 text-gray-600")}>
                                        <div className="font-black text-gray-800 flex justify-between items-center"><span className={cn("font-mono text-sm tracking-tighter", selectedDecreeId === decree.id ? "text-amber-700" : "")}>{decree.decreeNumber || decree.numeroDecreto}</span></div>
                                        <div className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === decree.id ? "text-amber-900" : "text-gray-400")}>{decree.targetName || decree.nombres}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500"></div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                            {!selectedDecreeId ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                                    <History className="w-16 h-16" />
                                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto de la lista</p>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdate} className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
                                    <section>
                                        <SectionHeader number="01" title="Decreto Maestro (Reposición)" icon={FileText} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="col-span-3"><label className={labelClass}>Parroquia Destino</label><input readOnly value={decreeData.parroquia} className={`${inputClass} bg-amber-50 border-amber-200 text-amber-700`} /></div>
                                            <div><label className={labelClass}>Número de Decreto</label><input name="decreeNumber" value={decreeData.decreeNumber} onChange={handleDecreeChange} className={inputClass} /></div>
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

                                    <section>
                                        <SectionHeader number="02" title="Ubicación Nueva Partida" icon={BookOpen} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                            <div><label className={labelClass}>Libro (Supletorio)</label><input readOnly name="book_number" value={newPartida.book_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-amber-700 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Folio (Supletorio)</label><input readOnly name="page_number" value={newPartida.page_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Acta (Supletorio)</label><input readOnly name="entry_number" value={newPartida.entry_number} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="03" title="Identidad Repuesta" icon={User} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Apellidos</label><input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Nombres</label><input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChange} className={inputClass} /></div>
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
                                        <SectionHeader number="05" title="Ministro y Autoridad" icon={PenTool} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" list="ministros-list" value={newPartida.ministro} onChange={handleNewPartidaChange} className={`${inputClass} border-l-8 border-l-amber-500`} /></div>
                                            <div><label className={labelClass}>Firma (Da Fe)</label><input name="daFe" required list="ministros-list" value={newPartida.daFe} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                        <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className={`${inputClass} py-5`} /></div>
                                    </section>

                                    <div className="flex justify-between gap-4 border-t border-gray-100 pt-12">
                                        <Button type="button" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting} className="px-10 py-8 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 font-black uppercase text-[10px] transition-all"><Trash2 className="w-5 h-5 mr-3"/> Eliminar Decreto</Button>
                                        <div className="flex gap-3">
                                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Cancelar</Button>
                                            <Button type="submit" disabled={isSubmitting || isLoading} className="bg-gradient-to-r from-amber-600 to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
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
                    title="Restaurar Partida y Eliminar Decreto"
                    message="El decreto de reposición será borrado de la nube y la partida supletoria será destruida permanentemente."
                    onConfirm={handleDelete}
                    onClose={() => setShowDeleteModal(false)}
                    variant="destructive"
                    confirmText="Sí, Ejecutar Eliminación"
                />
            </div>
        </DashboardLayout>
    );
};

export default ChanceryDecreeReplacementEditPage;