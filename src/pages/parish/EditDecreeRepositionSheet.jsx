import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
    Save, X, Loader2, Search, Trash2, 
    FileText, UserPlus, ArrowLeft, ShieldCheck,
    BookOpen, History, Info, Users
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

const EditDecreeRepositionSheet = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { 
        getDecreeReplacementsBySacrament, 
        updateDecreeReplacement, 
        deleteDecreeReplacement, 
        getBaptisms,
        getMisDatosList, 
        getParrocoActual,
        getConceptosAnulacion,
        purificarRegistroBautismo,
        guardarEnPermanentes
    } = useAppData();

    // --- ESTADOS DE CONTROL ---
    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conceptos, setConceptos] = useState([]);

    // SECCIÓN 1: DATOS DEL DECRETO
    const [decreeData, setDecreeData] = useState({
        decreeNumber: '',
        decreeDate: '',
        targetName: '',
        conceptoAnulacionId: '' 
    });

    // SECCIÓN 2: DATOS DE LA PARTIDA SUPLETORIA (EDITABLE)
    const [newPartida, setNewPartida] = useState({
        sacramentDate: '', firstName: '', lastName: '', sex: 'MASCULINO',
        birthDate: '', placeOfBirth: '', fatherName: '', motherName: '',
        paternalGrandparents: '', maternalGrandparents: '', godparents: '',
        minister: '', ministerFaith: '',
        serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: '',
        book_number: '', page_number: '', entry_number: '' 
    });

    // --- 1. CARGA INICIAL ---
    useEffect(() => {
        const contextId = user?.parishId || user?.dioceseId;
        if (contextId) {
            const allDecrees = getDecreeReplacementsBySacrament(activeTab, contextId);
            setDecrees(allDecrees);
            setConceptos(getConceptosAnulacion(contextId));

            const idParam = searchParams.get('id');
            if (idParam) setSelectedDecreeId(idParam);
        }
    }, [user, activeTab, searchParams]);

    // --- 2. CARGA DEL DECRETO SELECCIONADO (CON FIX DE ABUELOS) ---
    useEffect(() => {
        if (selectedDecreeId && decrees.length > 0) {
            const decree = decrees.find(d => d.id === selectedDecreeId);
            if (!decree) return;

            setDecreeData({
                decreeNumber: decree.decreeNumber || decree.numeroDecreto || '',
                decreeDate: decree.decreeDate || decree.fechaDecreto || '',
                targetName: decree.targetName || '',
                conceptoAnulacionId: decree.conceptoAnulacionId || ''
            });

            // Extraemos la información de la partida guardada en el decreto
            const bd = decree.datosNuevaPartida || decree.newPartidaSummary || {};
            
            setNewPartida({
                ...bd,
                firstName: bd.firstName || bd.nombres || '',
                lastName: bd.lastName || bd.apellidos || '',
                sex: bd.sex || bd.sexo || 'MASCULINO',
                sacramentDate: bd.sacramentDate || bd.fechaSacramento || '',
                birthDate: bd.birthDate || bd.fechaNacimiento || '',
                placeOfBirth: bd.placeOfBirth || bd.lugarNacimientoDetalle || '',
                // 👵 MAPEADO DE ABUELOS Y PADRINOS PARA EL EDITOR
                paternalGrandparents: bd.paternalGrandparents || bd.abuelosPaternos || bd.abuepat || '',
                maternalGrandparents: bd.maternalGrandparents || bd.abuelosMaternos || bd.abuemat || '',
                godparents: bd.godparents || bd.padrinos || '',
                book_number: bd.book_number || bd.book || '',
                page_number: bd.page_number || bd.page || '',
                entry_number: bd.entry_number || bd.entry || ''
            });
        }
    }, [selectedDecreeId, decrees]);

    // =========================================================================
    // 💾 ACTUALIZACIÓN HACIA LA NUBE
    // =========================================================================
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;

        setIsLoading(true);
        const parishId = user?.parishId;

        try {
            // 1. REGENERAR NOTA MARGINAL TÉCNICA
            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'REPOSICIÓN';
            const fechaTexto = convertDateToSpanishText(decreeData.decreeDate).replace(/^EL\s+/i, '').toUpperCase();
            const notaReposicion = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.decreeNumber.toUpperCase()} DE FECHA ${fechaTexto}, DEBIDO A LA ${causaText} DEL ORIGINAL.`;

            // 2. 🧠 PURIFICAR CAMBIOS (Cerebro Global)
            const partidaCorregida = purificarRegistroBautismo({
                ...newPartida,
                parishId: parishId,
                status: 'seated',
                isSupplementary: true,
                marginNote: notaReposicion 
            });

            const updatedPayload = {
                ...decreeData,
                newPartidaSummary: { 
                    book: partidaCorregida.book_number, 
                    page: partidaCorregida.page_number, 
                    entry: partidaCorregida.entry_number 
                },
                datosNuevaPartida: partidaCorregida,
                targetName: `${partidaCorregida.lastName}, ${partidaCorregida.firstName}`
            };

            // 3. ACTUALIZAR DECRETO Y PARTIDA VIVA
            const result = await updateDecreeReplacement(selectedDecreeId, updatedPayload, parishId);

            if (result.success) {
                const resSave = await guardarEnPermanentes(partidaCorregida);
                
                if (resSave.success) {
                    toast({ title: "Sincronizado", description: "Los cambios han sido aplicados en la Nube.", className: "bg-green-50 text-green-900" });
                    const contextId = user?.parishId || user?.dioceseId;
                    setDecrees(getDecreeReplacementsBySacrament(activeTab, contextId));
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const result = await deleteDecreeReplacement(selectedDecreeId, user?.parishId);
            if (result.success) {
                toast({ title: "Eliminado", description: "El decreto y su partida han sido removidos." });
                navigate('/parroquia/decretos/reposicion');
            }
        } catch (e) {
            toast({ title: "Error", description: "Fallo al eliminar.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredDecrees = decrees.filter(d => 
        (d.decreeNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (d.targetName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/parroquia/decretos/reposicion')} className="rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></Button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Editor de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Ajuste de Partidas Supletorias Archivadas</p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="border-red-200 text-red-600 hover:bg-red-50 rounded-2xl px-6 font-bold uppercase text-[10px] tracking-widest h-12 transition-all">
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar Decreto
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-220px)]">
                
                {/* LISTADO LATERAL */}
                <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#4B7BA7] transition-colors" />
                            <input 
                                placeholder="Buscar decreto..." 
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {filteredDecrees.map(d => (
                            <button 
                                key={d.id}
                                onClick={() => setSelectedDecreeId(d.id)}
                                className={cn(
                                    "w-full text-left p-4 rounded-2xl transition-all border",
                                    selectedDecreeId === d.id 
                                        ? "bg-[#4B7BA7] border-[#4B7BA7] text-white shadow-lg shadow-blue-900/20" 
                                        : "bg-white border-transparent hover:border-gray-200 text-gray-600"
                                )}
                            >
                                <p className={cn("font-black font-mono text-sm tracking-tighter", selectedDecreeId === d.id ? "text-white" : "text-gray-900")}>
                                    {d.decreeNumber || d.numeroDecreto}
                                </p>
                                <p className={cn("text-[10px] font-bold uppercase mt-1 truncate", selectedDecreeId === d.id ? "text-blue-100" : "text-gray-400")}>
                                    {d.targetName}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* FORMULARIO DE EDICIÓN */}
                <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-y-auto custom-scrollbar">
                    {!selectedDecreeId ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-40">
                            <History className="w-16 h-16" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un decreto del listado</p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="p-10 space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                            
                            {/* SECCIÓN DECRETO */}
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
                                        <Input value={decreeData.decreeNumber} onChange={e => setDecreeData({...decreeData, decreeNumber: e.target.value})} className="py-6 font-black text-[#4B7BA7] border-blue-50 bg-blue-50/20" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Emisión</label>
                                        <Input type="date" value={decreeData.decreeDate} onChange={e => setDecreeData({...decreeData, decreeDate: e.target.value})} className="py-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Concepto o Causa</label>
                                        <select 
                                            value={decreeData.conceptoAnulacionId} 
                                            onChange={e => setDecreeData({...decreeData, conceptoAnulacionId: e.target.value})}
                                            className="w-full h-[50px] px-4 border border-gray-200 rounded-xl outline-none font-bold text-xs bg-gray-50 uppercase tracking-tighter transition-all focus:bg-white"
                                        >
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* SECCIÓN NUEVA PARTIDA */}
                            <section>
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                                    <div className="bg-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-900/10"><UserPlus className="w-5 h-5"/></div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">02. Información de la Partida Supletoria</h3>
                                </div>

                                <div className="space-y-8">
                                    {/* Ubicación supletoria */}
                                    <div className="grid grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Libro</label><Input value={newPartida.book_number} onChange={e => setNewPartida({...newPartida, book_number: e.target.value})} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Folio</label><Input value={newPartida.page_number} onChange={e => setNewPartida({...newPartida, page_number: e.target.value})} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 text-center block">Acta</label><Input value={newPartida.entry_number} onChange={e => setNewPartida({...newPartida, entry_number: e.target.value})} className="bg-white text-center font-black font-mono text-lg py-6 shadow-sm border-none" /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Apellidos Completos</label><Input value={newPartida.lastName} onChange={e => setNewPartida({...newPartida, lastName: e.target.value})} className="py-6 font-black uppercase text-gray-800" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombres Completos</label><Input value={newPartida.firstName} onChange={e => setNewPartida({...newPartida, firstName: e.target.value})} className="py-6 font-black uppercase text-gray-800" /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo</label><Input type="date" value={newPartida.sacramentDate} onChange={e => setNewPartida({...newPartida, sacramentDate: e.target.value})} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</label><Input type="date" value={newPartida.birthDate} onChange={e => setNewPartida({...newPartida, birthDate: e.target.value})} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nac.</label><Input value={newPartida.placeOfBirth} onChange={e => setNewPartida({...newPartida, placeOfBirth: e.target.value})} className="py-6 uppercase text-xs font-bold" /></div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Sexo</label>
                                            <select value={newPartida.sex} onChange={e => setNewPartida({...newPartida, sex: e.target.value})} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase text-xs">
                                                <option value="MASCULINO">MASCULINO</option>
                                                <option value="FEMENINO">FEMENINO</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Filiación y Abuelos (INTEGRADOS AQUÍ) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-100">
                                        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100/50 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest ml-1">Línea Paterna</p>
                                            <Input placeholder="Nombre del Padre" value={newPartida.fatherName} onChange={e => setNewPartida({...newPartida, fatherName: e.target.value})} className="bg-white font-bold uppercase text-xs" />
                                            <Input placeholder="Abuelos Paternos" value={newPartida.paternalGrandparents} onChange={e => setNewPartida({...newPartida, paternalGrandparents: e.target.value})} className="bg-white text-[10px] uppercase font-medium" />
                                        </div>
                                        <div className="bg-pink-50/50 p-6 rounded-[2.5rem] border border-pink-100/50 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest ml-1">Línea Materna</p>
                                            <Input placeholder="Nombre de la Madre" value={newPartida.motherName} onChange={e => setNewPartida({...newPartida, motherName: e.target.value})} className="bg-white font-bold uppercase text-xs" />
                                            <Input placeholder="Abuelos Maternos" value={newPartida.maternalGrandparents} onChange={e => setNewPartida({...newPartida, maternalGrandparents: e.target.value})} className="bg-white text-[10px] uppercase font-medium" />
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2"><Users className="w-3 h-3"/> Padrinos</label>
                                        <Input value={newPartida.godparents} onChange={e => setNewPartida({...newPartida, godparents: e.target.value})} className="py-6 uppercase font-bold text-gray-600 shadow-sm" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sacerdote Celebrante</label><Input value={newPartida.minister} onChange={e => setNewPartida({...newPartida, minister: e.target.value})} className="py-6 font-black uppercase text-blue-900 shadow-sm" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Firma (Da Fe)</label><Input value={newPartida.ministerFaith} onChange={e => setNewPartida({...newPartida, ministerFaith: e.target.value})} className="py-6 font-bold uppercase text-gray-500 bg-gray-50" /></div>
                                    </div>
                                </div>
                            </section>

                            {/* PANEL DE ACCIÓN */}
                            <div className="flex justify-end gap-4 border-t border-gray-100 pt-10 sticky bottom-0 bg-white">
                                <Button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl hover:shadow-green-500/20 text-white px-12 py-8 rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all transform active:scale-95 shadow-xl shadow-green-900/10"
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