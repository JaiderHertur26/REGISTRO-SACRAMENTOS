import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, Search, Trash2, FileText, UserPlus, ArrowLeft, ShieldCheck, BookOpen, History, Info, Users } from 'lucide-react';
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

    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
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

    useEffect(() => {
        const loadDecreeData = async () => {
            const idParam = searchParams.get('id');
            if (!user?.parishId || !idParam) return;
            setIsLoading(true);

            try {
                let targetDioceseId = user.dioceseId || user.diocese_id;
                if (!targetDioceseId) {
                    const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                    if (pData) targetDioceseId = pData.diocese_id;
                }

                if (targetDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('*').eq('diocese_id', targetDioceseId);
                    if (cData) setConceptos(cData);
                }

                const { data: decData } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion').eq('parish_id', user.parishId).order('created_at', { ascending: false });
                if (decData) {
                    const formattedData = decData.map(item => ({ id: item.id, ...item.payload }));
                    setDecrees(formattedData);
                }

                const { data: decree, error } = await supabase.from('decretos').select('*').eq('id', idParam).single();
                if (error) throw error;

                const payload = typeof decree.payload === 'string' ? JSON.parse(decree.payload) : decree.payload;
                setOriginalPayload(payload);
                setSelectedDecreeId(idParam);

                setDecreeData({
                    decreeNumber: payload.decreeNumber || payload.numeroDecreto || '',
                    decreeDate: payload.decreeDate || payload.fechaDecreto || '',
                    targetName: payload.targetName || '',
                    conceptoAnulacionId: payload.conceptoAnulacionId || ''
                });

                const bd = payload.datosNuevaPartida || payload.newPartidaSummary || {};
                setNewPartida({
                    ...payload,
                    firstName: payload.firstName || bd.nombres || '',
                    lastName: payload.lastName || bd.apellidos || '',
                    sex: payload.sex || payload.sexo || 'MASCULINO',
                    sacramentDate: payload.sacramentDate || payload.fecbau || '',
                    birthDate: payload.birthDate || payload.fecnac || '',
                    placeOfBirth: payload.placeOfBirth || payload.lugarn || '',
                    paternalGrandparents: payload.paternalGrandparents || bd.paternalGrandparents || bd.abuepat || '',
                    maternalGrandparents: payload.maternalGrandparents || bd.maternalGrandparents || bd.abuemat || '',
                    godparents: payload.godparents || bd.godparents || bd.padrinos || '',
                    book_number: bd.book || bd.book_number || '',
                    page_number: bd.page || bd.page_number || '',
                    entry_number: bd.entry || bd.entry_number || ''
                });

            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el decreto.", variant: "destructive" });
                navigate('/parroquia/decretos/reposicion');
            } finally { setIsLoading(false); }
        };

        loadDecreeData();
    }, [user, searchParams]);

    const handleDecreeChange = (e) => setDecreeData(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
    const handleNewPartidaChange = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsLoading(true);

        try {
            const pad = (num) => String(num).padStart(4, '0');
            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'REPOSICIÓN';
            const fechaTexto = convertDateToSpanishText(decreeData.decreeDate).replace(/^EL\s+/i, '').toUpperCase();
            
            // 🚀 GRAMÁTICA CORREGIDA AQUÍ TAMBIÉN
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

            // 🚀 EMPAQUETADO EXACTO QUE BUSCA EL PDF PARA LA EDICIÓN
            const newPayload = {
                ...originalPayload,
                decreeNumber: decreeData.decreeNumber, decreeDate: decreeData.decreeDate,
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
        finally { setIsLoading(false); }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            
            await supabase.from('baptisms').delete().eq('parish_id', user.parishId)
                .eq('book_number', pad(newPartida.book_number)).eq('folio', pad(newPartida.page_number)).eq('number', pad(newPartida.entry_number));

            await supabase.from('decretos').delete().eq('id', selectedDecreeId);

            toast({ title: "Eliminado", description: "El decreto y su partida han sido removidos." });
            navigate('/parroquia/decretos/reposicion');
        } catch (e) { toast({ title: "Error", description: "Fallo al eliminar.", variant: "destructive" }); } 
        finally { setIsLoading(false); setShowDeleteModal(false); }
    };

    const filteredDecrees = decrees.filter(d => (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/parroquia/decretos/reposicion')} className="rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></Button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Editor de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Ajuste de Partidas Supletorias en la Nube</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-220px)]">
                <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#4B7BA7] transition-colors" />
                            <input placeholder="Buscar decreto..." className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {filteredDecrees.map(d => (
                            <button key={d.id} onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${d.id}`)} className={cn("w-full text-left p-4 rounded-2xl transition-all border", selectedDecreeId === d.id ? "bg-[#4B7BA7] border-[#4B7BA7] text-white shadow-lg shadow-blue-900/20" : "bg-white border-transparent hover:border-gray-200 text-gray-600")}>
                                <p className={cn("font-black font-mono text-sm tracking-tighter", selectedDecreeId === d.id ? "text-white" : "text-gray-900")}>{d.decreeNumber || d.numeroDecreto}</p>
                                <p className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === d.id ? "text-blue-100" : "text-gray-400")}>{d.targetName}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-y-auto custom-scrollbar">
                    {!selectedDecreeId ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                            <History className="w-16 h-16" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto del listado</p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="p-10 space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                            <section>
                                <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-900/10"><FileText className="w-5 h-5"/></div>
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em]">01. Datos del Decreto Maestro</h3>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Número de Decreto</label>
                                        <Input name="decreeNumber" value={decreeData.decreeNumber} onChange={handleDecreeChange} className="py-6 font-black text-[#4B7BA7] border-blue-50 bg-blue-50/20" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Emisión</label>
                                        <Input type="date" name="decreeDate" value={decreeData.decreeDate} onChange={handleDecreeChange} className="py-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Concepto o Causa</label>
                                        <select 
                                            name="conceptoAnulacionId"
                                            value={decreeData.conceptoAnulacionId} 
                                            onChange={handleDecreeChange}
                                            className="w-full h-[50px] px-4 border border-gray-200 rounded-xl outline-none font-bold text-xs bg-gray-50 uppercase tracking-tighter transition-all focus:bg-white"
                                        >
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                                    <div className="bg-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-900/10"><UserPlus className="w-5 h-5"/></div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">02. Información de la Partida Supletoria</h3>
                                </div>

                                <div className="space-y-8">
                                    <div className="grid grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Libro</label><Input name="book_number" value={newPartida.book_number} onChange={handleNewPartidaChange} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Folio</label><Input name="page_number" value={newPartida.page_number} onChange={handleNewPartidaChange} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Acta</label><Input name="entry_number" value={newPartida.entry_number} onChange={handleNewPartidaChange} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Apellidos Completos</label><Input name="lastName" value={newPartida.lastName} onChange={handleNewPartidaChange} className="py-6 font-black uppercase text-gray-800" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombres Completos</label><Input name="firstName" value={newPartida.firstName} onChange={handleNewPartidaChange} className="py-6 font-black uppercase text-gray-800" /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo</label><Input type="date" name="sacramentDate" value={newPartida.sacramentDate} onChange={handleNewPartidaChange} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</label><Input type="date" name="birthDate" value={newPartida.birthDate} onChange={handleNewPartidaChange} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nac.</label><Input name="placeOfBirth" value={newPartida.placeOfBirth} onChange={handleNewPartidaChange} className="py-6 uppercase text-xs font-bold" /></div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Sexo</label>
                                            <select name="sex" value={newPartida.sex} onChange={handleNewPartidaChange} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase text-xs">
                                                <option value="MASCULINO">MASCULINO</option>
                                                <option value="FEMENINO">FEMENINO</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-100">
                                        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100/50 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest ml-1">Línea Paterna</p>
                                            <Input name="fatherName" placeholder="Nombre del Padre" value={newPartida.fatherName} onChange={handleNewPartidaChange} className="bg-white font-bold uppercase text-xs" />
                                            <Input name="paternalGrandparents" placeholder="Abuelos Paternos" value={newPartida.paternalGrandparents} onChange={handleNewPartidaChange} className="bg-white text-[10px] uppercase font-medium" />
                                        </div>
                                        <div className="bg-pink-50/50 p-6 rounded-[2.5rem] border border-pink-100/50 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest ml-1">Línea Materna</p>
                                            <Input name="motherName" placeholder="Nombre de la Madre" value={newPartida.motherName} onChange={handleNewPartidaChange} className="bg-white font-bold uppercase text-xs" />
                                            <Input name="maternalGrandparents" placeholder="Abuelos Maternos" value={newPartida.maternalGrandparents} onChange={handleNewPartidaChange} className="bg-white text-[10px] uppercase font-medium" />
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2"><Users className="w-3 h-3"/> Padrinos</label>
                                        <Input name="godparents" value={newPartida.godparents} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-600 shadow-sm" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sacerdote Celebrante</label><Input name="minister" value={newPartida.minister} onChange={handleNewPartidaChange} className="py-6 uppercase font-black text-blue-900 shadow-sm" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Firma (Da Fe)</label><Input name="ministerFaith" value={newPartida.ministerFaith} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-500 bg-gray-50" /></div>
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-end gap-4 border-t border-gray-100 pt-10 sticky bottom-0 bg-white">
                                <Button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl hover:shadow-green-500/20 text-white px-12 py-8 rounded-2xl transition-all transform active:scale-95 font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-green-900/10"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5 mr-3"/> Sincronizar Cambios</>}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <ConfirmationDialog 
                isOpen={showDeleteModal}
                title="¿Eliminar Decreto?"
                message="Esta acción borrará el registro del decreto y eliminará la partida supletoria de la base de datos permanente. No se puede deshacer."
                onConfirm={handleDelete}
                onClose={() => setShowDeleteModal(false)}
                variant="destructive"
                confirmText="Sí, Eliminar Todo"
            />
        </DashboardLayout>
    );
};

export default EditDecreeRepositionSheet;