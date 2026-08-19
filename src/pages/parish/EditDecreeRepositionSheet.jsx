import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, Search, Trash2, FileText, UserPlus, ArrowLeft, History, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';

const EditDecreeRepositionSheet = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { getMisDatosList } = useAppData();

    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    
    // 🚀 AQUÍ FALTABA DECLARAR ISSUBMITTING
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [originalPayload, setOriginalPayload] = useState(null);

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
            if (!user?.parishId || !decreeId) return;
            setIsLoading(true);

            try {
                const misDatos = getMisDatosList(user.parishId);
                let parishLabel = misDatos?.length > 0 ? `${misDatos[0].nombre} - ${misDatos[0].ciudad}` : `${user.parishName} - ${user.city}`;

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

                const { data: decree, error } = await supabase.from('decretos').select('*').eq('id', decreeId).single();
                if (error) throw error;

                const payload = typeof decree.payload === 'string' ? JSON.parse(decree.payload) : decree.payload;
                setOriginalPayload(payload);
                setSelectedDecreeId(decreeId);

                setDecreeData({
                    parroquia: parishLabel,
                    numeroDeDecreto: payload.decreeNumber || payload.numeroDecreto || '',
                    fechaEmision: payload.decreeDate || payload.fechaDecreto || '',
                    conceptoAnulacionId: payload.conceptoAnulacionId || ''
                });

                const bd = payload.datosNuevaPartida || payload.newPartidaSummary || {};
                
                setNewPartida({
                    lugarBautismo: payload.lugarBautismo || bd.lugarBautismo || bd.lugbau || '',
                    fechaSacramento: payload.fechaSacramento || bd.fechaSacramento || bd.fecbau || '',
                    apellidos: payload.apellidos || bd.apellidos || bd.lastName || '',
                    nombres: payload.nombres || bd.nombres || bd.firstName || '',
                    fechaNacimiento: payload.fechaNacimiento || bd.fechaNacimiento || bd.fecnac || '',
                    lugarNacimiento: payload.lugarNacimiento || bd.lugarNacimiento || bd.lugarNacimientoDetalle || bd.lugarn || '',
                    sexo: payload.sexo || bd.sexo || bd.sex || 'MASCULINO',
                    nombrePadre: payload.nombrePadre || bd.nombrePadre || bd.fatherName || '',
                    nombreMadre: payload.nombreMadre || bd.nombreMadre || bd.motherName || '',
                    tipoUnionPadres: payload.tipoUnionPadres || bd.tipoUnionPadres || bd.tipohijo || '',
                    abuelosPaternos: payload.abuelosPaternos || bd.abuelosPaternos || bd.paternalGrandparents || bd.abuepat || '',
                    abuelosMaternos: payload.abuelosMaternos || bd.abuelosMaternos || bd.maternalGrandparents || bd.abuemat || '',
                    padrinos: payload.padrinos || bd.padrinos || bd.godparents || '',
                    ministro: payload.ministro || bd.ministro || bd.minister || '',
                    daFe: payload.daFe || bd.daFe || bd.ministerFaith || '',
                    observaciones: payload.observaciones || bd.observaciones || '',
                    book_number: bd.book || bd.book_number || bd.Libro || '',
                    page_number: bd.page || bd.page_number || bd.folio || '',
                    entry_number: bd.entry || bd.entry_number || bd.numero || ''
                });

            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/parroquia/decretos/reposicion');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, decreeId]);

    const handleDecreeChange = (e) => setDecreeData(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChange = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);

        try {
            const pad = (num) => String(num).padStart(4, '0');
            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'REPOSICIÓN';
            const fechaTexto = convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, '').toUpperCase();
            
            const notaReposicion = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.numeroDeDecreto.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${causaText}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

            // Buscar y actualizar la partida supletoria viva en la Nube
            const { data: supData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', user.parishId)
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

            // Empaquetado estricto para el PDF
            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.numeroDeDecreto, numeroDecreto: decreeData.numeroDecreto,
                decreeDate: decreeData.fechaEmision, fechaDecreto: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacionId, causa: causaText,
                targetName: `${newPartida.apellidos} ${newPartida.nombres}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number },
                newPartidaSummary: { book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
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
            
            // Eliminar partida supletoria
            await supabase.from('baptisms').delete().eq('parish_id', user.parishId)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number));

            // Eliminar decreto
            await supabase.from('decretos').delete().eq('id', selectedDecreeId);

            toast({ title: "Eliminado", description: "El decreto y la partida supletoria han sido removidos.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/decretos/reposicion');
        } catch (e) { toast({ title: "Error", description: "Fallo al eliminar de la Nube.", variant: "destructive" }); } 
        finally { setIsSubmitting(false); setShowDeleteModal(false); }
    };

    const filteredDecrees = decrees.filter(d => (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-[1400px] mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/decretos/reposicion')} className="rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Editar Decreto de Reposición</h1>
                            <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">{decreeData.parroquia}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-180px)] min-h-[600px] p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-2xl h-14 shrink-0">
                            <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmaciones" disabled className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30">Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonios" disabled className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30">Matrimonios</TabsTrigger>
                        </TabsList>

                        <TabsContent value="bautismo" className="flex-1 m-0 border-none outline-none overflow-hidden flex flex-col">
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden h-full min-h-0">
                                {/* LEFT SIDEBAR: LIST */}
                                <div className="lg:col-span-1 border-r border-gray-200 pr-4 flex flex-col h-full overflow-hidden">
                                    <div className="relative mb-4 shrink-0">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                                        <input placeholder="Buscar decreto..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500/10 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {filteredDecrees.length === 0 ? (<p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center py-8">No hay decretos.</p>) : (
                                            filteredDecrees.map((decree) => (
                                                <button key={decree.id} onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${decree.id}`)} className={cn("w-full text-left p-4 rounded-2xl transition-all border group", selectedDecreeId === decree.id ? "bg-amber-50 border-amber-200 ring-1 ring-amber-300" : "bg-white border-transparent hover:border-gray-200 text-gray-600")}>
                                                    <div className="font-black text-gray-800 flex justify-between items-center"><span className={cn("font-mono text-sm tracking-tighter", selectedDecreeId === decree.id ? "text-amber-700" : "")}>{decree.decreeNumber || decree.numeroDecreto}</span><span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{decree.decreeDate || decree.fechaDecreto}</span></div>
                                                    <div className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === decree.id ? "text-amber-900" : "text-gray-400")}>{decree.targetName || decree.nombres}</div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT SIDE: FORM */}
                                <div className="lg:col-span-3 h-full overflow-y-auto custom-scrollbar px-2">
                                    {!selectedDecreeId ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                                            <History className="w-16 h-16" />
                                            <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto de la lista</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdate} className="p-10 space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
                                            
                                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="bg-amber-50/50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
                                                    <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4" /> 01. Información del Decreto</h3>
                                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase tracking-widest">Modo Edición</span>
                                                </div>
                                                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase">Número de Decreto</label>
                                                        <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} className="py-6 font-bold text-amber-700 bg-amber-50/50 border-amber-100" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase">Fecha de Emisión</label>
                                                        <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className="py-6" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase">Causa de Reposición</label>
                                                        <select name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500/20 bg-white text-gray-700">
                                                            <option value="">SELECCIONE...</option>
                                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-500">
                                                <div className="bg-green-50/50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-green-600" /><h3 className="text-xs font-black text-green-700 uppercase tracking-widest">02. Partida Supletoria</h3></div>
                                                </div>
                                                <div className="p-10 space-y-10">
                                                    
                                                    <div className="grid grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase text-center block">Libro Supletorio</label><Input name="book_number" value={newPartida.book_number} onChange={handleNewPartidaChangeRaw} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase text-center block">Folio</label><Input name="page_number" value={newPartida.page_number} onChange={handleNewPartidaChangeRaw} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase text-center block">Acta</label><Input name="entry_number" value={newPartida.entry_number} onChange={handleNewPartidaChangeRaw} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Apellidos</label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChange} className="py-6 font-bold" /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Nombres</label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChange} className="py-6 font-bold" /></div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChange} /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo</label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} className="py-6" /></div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Sexo</label>
                                                            <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase text-xs">
                                                                <option value="">SELECCIONE...</option><option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nacimiento</label><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChange} /></div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                                                        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                                                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
                                                            <Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChange} className="bg-white font-bold" />
                                                        </div>
                                                        <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4">
                                                            <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
                                                            <Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChange} className="bg-white font-bold" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Paternos</label><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChange} /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Maternos</label><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChange} /></div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Unión</label>
                                                            <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChangeRaw} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase">
                                                                <option value="">SELECCIONE...</option><option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2"><Users className="w-3 h-3"/> Padrinos</label><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className="py-6 font-bold shadow-sm" /></div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Sacerdote Celebrante</label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChange} className="py-6 font-black text-blue-900 shadow-sm" /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Firma (Da Fe)</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChange} className="py-6 font-bold text-gray-500 bg-gray-50" /></div>
                                                    </div>

                                                    <div className="space-y-2 border-t pt-10">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase">Observaciones del Decreto (Opcional)</label>
                                                        <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChange} rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase font-bold text-gray-700 bg-amber-50" placeholder="OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..." />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="fixed bottom-8 right-8 z-50 flex gap-4">
                                                <Button type="button" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95">
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                                <Button type="submit" disabled={isLoading || isSubmitting} className="bg-gradient-to-r from-amber-500 to-amber-700 text-white px-10 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">
                                                    {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-3" /> : <Save className="w-5 h-5 mr-3" />} Guardar Cambios
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
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