import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Modal } from '@/components/ui/Modal';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService';

const EditDecreeCorrectionSheet = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { getMisDatosList, obtenerNotasAlMargen } = useAppData();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    
    const [conceptos, setConceptos] = useState([]);
    const [originalPayload, setOriginalPayload] = useState(null);
    const [foundRecord, setFoundRecord] = useState(null);

    const [decreeData, setDecreeData] = useState({
        parroquia: '', numeroDeDecreto: '', fechaEmision: '', conceptoAnulacion: '', nombreBautizado: '', Libro: '', folio: '', numero: ''
    });

    const [newPartida, setNewPartida] = useState({
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: '', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: '', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: ''
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
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porCorreccion' || (c.concepto && c.concepto.toLowerCase().includes('correcc'))));
                }

                const { data: decree, error } = await supabase.from('decretos').select('*').eq('id', decreeId).single();
                if (error) throw error;

                const payload = typeof decree.payload === 'string' ? JSON.parse(decree.payload) : decree.payload;
                setOriginalPayload(payload);

                const pad = (num) => String(num).padStart(4, '0');
                let origDataRaw = {};
                
                if (payload.originalPartidaSummary?.book || payload.originalPartidaSummary?.Libro) {
                    const b = payload.originalPartidaSummary.book || payload.originalPartidaSummary.Libro;
                    const p = payload.originalPartidaSummary.page || payload.originalPartidaSummary.folio;
                    const e = payload.originalPartidaSummary.entry || payload.originalPartidaSummary.numero;
                    
                    const { data: origData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', user.parishId).eq('book_number', pad(b)).eq('folio', pad(p)).eq('number', pad(e)).maybeSingle();
                        
                    if (origData) {
                        origDataRaw = origData.raw_data || {};
                        setFoundRecord({ ...origData.raw_data, id: origData.id });
                    }
                }

                setDecreeData({
                    parroquia: parishLabel,
                    numeroDeDecreto: payload.decreeNumber || '',
                    fechaEmision: payload.decreeDate || '',
                    conceptoAnulacion: payload.conceptoAnulacionId || '',
                    nombreBautizado: payload.targetName || '',
                    Libro: payload.originalPartidaSummary?.book || payload.originalPartidaSummary?.Libro || '',
                    folio: payload.originalPartidaSummary?.page || payload.originalPartidaSummary?.folio || '',
                    numero: payload.originalPartidaSummary?.entry || payload.originalPartidaSummary?.numero || ''
                });

                const bd = payload.datosNuevaPartida || payload.newPartidaSummary || {};

                setNewPartida({
                    lugarBautismo: payload.lugarBautismo || bd.lugarBautismo || origDataRaw.lugarBautismo || '',
                    fechaSacramento: payload.fechaSacramento || bd.fechaSacramento || origDataRaw.fechaSacramento || '',
                    apellidos: payload.apellidos || bd.apellidos || origDataRaw.apellidos || '',
                    nombres: payload.nombres || bd.nombres || origDataRaw.nombres || '',
                    fechaNacimiento: payload.fechaNacimiento || bd.fechaNacimiento || origDataRaw.fechaNacimiento || '',
                    lugarNacimiento: payload.lugarNacimiento || bd.lugarNacimiento || origDataRaw.lugarNacimiento || '',
                    sexo: payload.sexo || bd.sexo || bd.sex || origDataRaw.sexo || 'MASCULINO',
                    nombrePadre: payload.nombrePadre || bd.nombrePadre || origDataRaw.nombrePadre || '',
                    nombreMadre: payload.nombreMadre || bd.nombreMadre || origDataRaw.nombreMadre || '',
                    tipoUnionPadres: payload.tipoUnionPadres || bd.tipoUnionPadres || origDataRaw.tipoUnionPadres || 'MATRIMONIO CATÓLICO',
                    abuelosPaternos: payload.abuelosPaternos || bd.abuelosPaternos || origDataRaw.abuelosPaternos || '',
                    abuelosMaternos: payload.abuelosMaternos || bd.abuelosMaternos || origDataRaw.abuelosMaternos || '',
                    padrinos: payload.padrinos || bd.padrinos || origDataRaw.padrinos || '',
                    ministro: payload.ministro || bd.ministro || origDataRaw.ministro || '',
                    daFe: payload.daFe || bd.daFe || bd.ministerFaith || origDataRaw.daFe || '',
                    observaciones: payload.observaciones || ''
                });

            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/parroquia/decretos/ver-correcciones');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, decreeId]);

    const handleDecreeChange = (e) => setDecreeData(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSave = async () => {
        setIsSubmitting(true);

        try {
            const pad = (num) => String(num).padStart(4, '0');
            const supSum = originalPayload.newPartidaSummary;
            const notasConfig = typeof obtenerNotasAlMargen === 'function' ? obtenerNotasAlMargen(user.parishId) : null;

            let noteAnulada = notasConfig?.porCorreccion?.anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO]";
            noteAnulada = noteAnulada
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[LIBRO_NUEVA\]/g, pad(supSum.book || supSum.Libro))
                .replace(/\[FOLIO_NUEVA\]/g, pad(supSum.page || supSum.folio))
                .replace(/\[NUMERO_PARTIDA_NUEVA\]/g, pad(supSum.entry || supSum.numero));

            let notaSupletoriaFinal = notasConfig?.porCorreccion?.nuevaPartida || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] Y ANULA LA ORIGINAL.";
            notaSupletoriaFinal = notaSupletoriaFinal
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                .replace(/\[LIBRO_ANULADA\]/g, pad(decreeData.Libro))
                .replace(/\[FOLIO_ANULADA\]/g, pad(decreeData.folio))
                .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, pad(decreeData.numero))
                .replace(/\[NOMBRE_SACERDOTE\]/g, newPartida.daFe);

            if (foundRecord) {
                const oldRawData = { ...foundRecord };
                oldRawData.notaMarginal = noteAnulada;
                oldRawData.estado = "anulada";
                oldRawData.status = "anulada";
                oldRawData.isAnnulled = true;
                oldRawData.annulmentDate = decreeData.fechaEmision;
                oldRawData.annulmentDecree = decreeData.numeroDeDecreto;
                oldRawData.conceptoAnulacionId = decreeData.conceptoAnulacion;
                oldRawData.tipoNotaAlMargen = "porCorreccion.anulada";

                await supabase.from('baptisms').update({ status: 'anulada', nota_marginal: noteAnulada, raw_data: oldRawData }).eq('id', foundRecord.id);
            }

            const { data: supData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', user.parishId)
                .eq('book_number', pad(supSum.book || supSum.Libro)).eq('folio', pad(supSum.page || supSum.folio)).eq('number', pad(supSum.entry || supSum.numero)).maybeSingle();

            if (supData) {
                const updatedRaw = {
                    ...supData.raw_data, ...newPartida,
                    nombres: newPartida.nombres, apellidos: newPartida.apellidos, fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento, lugarn: newPartida.lugarNacimiento, sex: newPartida.sexo, padre: newPartida.nombrePadre, madre: newPartida.nombreMadre, tipohijo: newPartida.tipoUnionPadres, godparents: newPartida.padrinos, ministro: newPartida.ministro, dafe: newPartida.daFe, notaMarginal: notaSupletoriaFinal
                };
                
                await supabase.from('baptisms').update({ 
                    celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos, sexo: newPartida.sexo, fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento, lugar_bautismo: newPartida.lugarBautismo, nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, padrinos: newPartida.padrinos, ministro: newPartida.ministro, da_fe: newPartida.daFe, tipo_union_padres: newPartida.tipoUnionPadres, nota_marginal: notaSupletoriaFinal, raw_data: updatedRaw
                }).eq('id', supData.id);
            }

            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.numeroDeDecreto, decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacion, observaciones: newPartida.observaciones,
                targetName: `${newPartida.apellidos} ${newPartida.nombres}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: supSum.book || supSum.Libro, page: supSum.page || supSum.folio, entry: supSum.entry || supSum.numero },
                newPartidaSummary: { book: supSum.book || supSum.Libro, page: supSum.page || supSum.folio, entry: supSum.entry || supSum.numero, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
            };

            await supabase.from('decretos').update({ payload: newPayload }).eq('id', decreeId);

            toast({ title: "Guardado Exitoso", description: "El decreto y las notas han sido regenerados.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/decretos/ver-correcciones');

        } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const pad = (num) => String(num).padStart(4, '0');
            const supSum = originalPayload.newPartidaSummary;

            if (foundRecord) {
                const cleanedRaw = { ...foundRecord };
                delete cleanedRaw.notaMarginal; delete cleanedRaw.anulado; delete cleanedRaw.isAnnulled;
                cleanedRaw.status = 'seated'; cleanedRaw.estado = 'permanente';
                await supabase.from('baptisms').update({ status: 'seated', nota_marginal: null, raw_data: cleanedRaw }).eq('id', foundRecord.id);
            }

            if (supSum) {
                await supabase.from('baptisms').delete().eq('parish_id', user.parishId).eq('book_number', pad(supSum.book || supSum.Libro)).eq('folio', pad(supSum.page || supSum.folio)).eq('number', pad(supSum.entry || supSum.numero));
            }

            await supabase.from('decretos').delete().eq('id', decreeId);

            // --- INICIO DE REVERSA MATEMÁTICA DE CONSECUTIVOS ---
try {
    // IMPORTANTE: Usa user.parishId en la versión Parroquia, 
    // y newPartida.parishId (o targetParishId) en la versión Cancillería
    const parishIdTarget = user.parishId; // Cambia esto en Cancillería por: newPartida.parishId

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

            toast({ title: "Eliminado", description: "Decreto eliminado y partida original restaurada.", className: "bg-green-50 text-green-900" });
            navigate('/parroquia/decretos/ver-correcciones');
        } catch (error) { toast({ title: "Error", description: "No se pudo eliminar de la Nube.", variant: "destructive" }); } 
        finally { setIsSubmitting(false); setShowDeleteModal(false); }
    };

    if (isLoading) return <DashboardLayout entityName={user?.parishName || "Parroquia"}><div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-12 h-12 text-[#4B7BA7] animate-spin" /></div></DashboardLayout>;

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-6xl mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/decretos/ver-correcciones')} className="rounded-full"><ArrowLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif">Editar Decreto de Corrección</h1>
                            <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">{decreeData.parroquia}</p>
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
                            <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4" /> 01. Información del Decreto</h3>
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase tracking-widest">Modo Edición</span>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Número de Decreto</label>
                                    <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} className="py-6 font-bold text-blue-600 bg-blue-50/50" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Fecha de Emisión</label>
                                    <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleNewPartidaChangeRaw} className="py-6" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Concepto</label>
                                    <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleNewPartidaChangeRaw} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
                                        <option value="">SELECCIONE...</option>
                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="mx-8 mb-8 p-6 bg-red-50/50 rounded-2xl border border-red-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Partida Original Anulada (Vinculada)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Nombre</label><Input value={decreeData.nombreBautizado} readOnly className="bg-white/50 border-red-100 text-gray-500 font-bold" /></div>
                                    <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Libro</label><Input value={decreeData.Libro} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                    <div className="space-y-1 flex gap-2">
                                        <div className="flex-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Folio</label><Input value={decreeData.folio} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                        <div className="flex-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Número</label><Input value={decreeData.numero} readOnly className="bg-white/50 border-red-100 text-center font-mono text-gray-500" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-500">
                            <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-green-600" /><h3 className="text-xs font-black text-green-600 uppercase tracking-widest">02. Datos Corregidos</h3></div>
                                <div className="flex gap-2">
                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">L:{originalPayload?.newPartidaSummary?.book || originalPayload?.newPartidaSummary?.Libro}</span>
                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">F:{originalPayload?.newPartidaSummary?.page || originalPayload?.newPartidaSummary?.folio}</span>
                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">N:{originalPayload?.newPartidaSummary?.entry || originalPayload?.newPartidaSummary?.numero}</span>
                                </div>
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
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Da Fe (Firma)</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold text-gray-500 bg-gray-50" /></div>
                                </div>

                                <div className="space-y-2 border-t pt-10">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Observaciones del Decreto (Opcional)</label>
                                    <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChangeUpper} rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase font-bold text-gray-700 bg-amber-50" />
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-8 right-8 z-50 flex gap-4">
                            <Button type="button" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95">
                                <Trash2 className="w-5 h-5" />
                            </Button>
                            <Button onClick={handleSave} disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-[#4B7BA7] hover:shadow-2xl text-white px-10 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">
                                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-3" /> : <Save className="w-5 h-5 mr-3" />} Guardar Cambios
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Decreto y Restaurar Partida">
                <div className="space-y-4 p-2">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800 font-medium leading-relaxed">
                            Al confirmar, el decreto <strong>{decreeData.numeroDeDecreto}</strong> será eliminado permanentemente. La partida supletoria será destruida y la partida original recuperará su validez legal.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={isSubmitting} className="font-bold text-xs uppercase text-gray-500">Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting} className="font-bold text-xs uppercase px-8 rounded-xl shadow-lg">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Restaurar Original
                        </Button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
};

export default EditDecreeCorrectionSheet;