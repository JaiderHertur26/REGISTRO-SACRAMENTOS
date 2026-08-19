import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, Search, Trash2, FileText, UserPlus, AlertCircle, CheckCircle2, ChevronLeft, Calendar, FileSignature, BookOpen, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';

const ChanceryDecreeReplacementEditPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { 
        getConceptosAnulacion, 
        getBaptisms 
    } = useAppData();

    // --- STATE MANAGEMENT ---
    const [activeTab, setActiveTab] = useState("bautizos");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [decreeData, setDecreeData] = useState({ parroquia: '', decreeNumber: '', decreeDate: '', targetName: '', book: '', page: '', entry: '', conceptoAnulacionId: '' });
    const [foundRecord, setFoundRecord] = useState(null);
    const [searchMessage, setSearchMessage] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);
    const [newPartida, setNewPartida] = useState({ sacramentDate: '', firstName: '', lastName: '', birthDate: '', lugarNacimientoDetalle: '', fatherName: '', motherName: '', tipoUnionPadres: '1', sex: '1', paternalGrandparents: '', maternalGrandparents: '', godparents: '', minister: '', ministerFaith: '', serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', book: '', page: '', entry: '' });

    // Initialization (Igual al modelo, adaptado a Reposición)
    useEffect(() => {
        if (user) {
            const entityId = user.dioceseId || user.id;
            const allDecrees = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if ((key.includes('decreeReplacement') || key.includes('decrees_replacement')) && key.includes(String(entityId))) {
                    allDecrees.push(...JSON.parse(localStorage.getItem(key) || '[]'));
                }
            }
            setDecrees(allDecrees);
            const allConcepts = getConceptosAnulacion(entityId);
            setConceptos(allConcepts.filter(c => c.tipo === 'porReposicion'));
            const idParam = searchParams.get('id');
            if (idParam && allDecrees.some(d => d.id === idParam)) {
                setSelectedDecreeId(idParam);
            }
            const parishLabel = `${user.dioceseName || 'Cancillería'} - ${user.city || 'Sede Central'}`;
            setDecreeData(prev => ({ ...prev, parroquia: parishLabel }));
        }
    }, [user, searchParams, getConceptosAnulacion]);

    // Load Decree (Igual al modelo)
    useEffect(() => {
        if (selectedDecreeId) {
            const decree = decrees.find(d => d.id === selectedDecreeId);
            if (decree) {
                setDecreeData({
                    parroquia: decree.targetParishName || decree.parroquia || '',
                    decreeNumber: decree.decreeNumber || decree.numeroDecreto || '',
                    decreeDate: decree.decreeDate || decree.fechaDecreto || '',
                    targetName: decree.targetName || '',
                    book: decree.book || '',
                    page: decree.page || '',
                    entry: decree.entry || '',
                    conceptoAnulacionId: decree.conceptoAnulacionId || ''
                });

                const bd = decree.datosNuevaPartida || {};
                const sum = decree.newPartidaSummary || {};
                setNewPartida({
                    ...bd,
                    book: sum.book || bd.libro || '',
                    page: sum.page || bd.folio || '',
                    entry: sum.entry || bd.numero || ''
                });
            }
        }
    }, [selectedDecreeId, decrees]);

    // Handlers (Exactamente igual al modelo)
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, [wrapperRef]);

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: value }));
        if (name === 'targetName' && value.length > 2) {
            const allBaptisms = getBaptisms(user.dioceseId || user.id);
            const filtered = allBaptisms.filter(b => (`${b.firstName || ''} ${b.lastName || ''}`.toLowerCase()).includes(value.toLowerCase())).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(true);
        }
    };

    const handleSuggestionClick = (record) => { 
        setDecreeData(prev => ({ ...prev, targetName: `${record.firstName} ${record.lastName}` })); 
        setShowSuggestions(false); 
    };

    const handleNewPartidaChange = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSearch = () => {
        if (!decreeData.book || !decreeData.page || !decreeData.entry) {
            setSearchMessage({ type: 'error', text: "Ingrese Libro, Folio y Número." });
            return;
        }
        setIsSearching(true);
        setSearchMessage(null);
        setTimeout(() => {
            const allBaptisms = getBaptisms(user.dioceseId || user.id);
            const found = allBaptisms.find(b => String(b.book_number) === String(decreeData.book) && String(b.page_number) === String(decreeData.page) && String(b.entry_number) === String(decreeData.entry));
            if (found) { setFoundRecord(found); setSearchMessage({ type: 'success', text: "Partida original localizada." }); } 
            else { setSearchMessage({ type: 'error', text: "No encontrada en el archivo." }); }
            setIsSearching(false);
        }, 500);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);
        try {
            const originalDecree = decrees.find(d => d.id === selectedDecreeId);
            const updatedDecree = {
                ...decreeData,
                newPartidaSummary: { book: newPartida.book, page: newPartida.page, entry: newPartida.entry },
                datosNuevaPartida: { ...newPartida, nombres: newPartida.firstName, apellidos: newPartida.lastName },
                updatedAt: new Date().toISOString()
            };

            const chanceryId = user.dioceseId || user.id;
            const keys = [`decreeReplacementBaptism_${chanceryId}`, `decreeReplacementBaptism_${originalDecree?.targetParishId}`];
            
            keys.forEach(key => {
                if (key.includes('undefined')) return;
                let records = JSON.parse(localStorage.getItem(key) || '[]');
                const idx = records.findIndex(r => r.id === selectedDecreeId);
                if (idx !== -1) {
                    records[idx] = { ...records[idx], ...updatedDecree };
                    localStorage.setItem(key, JSON.stringify(records));
                }
            });

            toast({ title: "Guardado", description: "Decreto de reposición actualizado correctamente.", className: "bg-green-50 border-green-200 text-green-900" });
            navigate('/chancery/decree-replacement');
        } catch (error) {
            toast({ title: "Error", description: "Fallo al sincronizar los cambios.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = () => {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('decreeReplacement')) {
                let records = JSON.parse(localStorage.getItem(key) || '[]');
                records = records.filter(r => r.id !== selectedDecreeId);
                localStorage.setItem(key, JSON.stringify(records));
            }
        }
        toast({ title: "Eliminado", description: "Decreto erradicado del sistema." });
        navigate('/chancery/decree-replacement');
    };

    const filteredDecrees = decrees.filter(d => {
        const search = searchTerm.toLowerCase();
        return `${d.targetName} ${d.decreeNumber}`.toLowerCase().includes(search);
    });

    const selectedConceptDetails = conceptos.find(c => c.id === decreeData.conceptoAnulacionId);

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement')} className="p-0 hover:bg-transparent">
                    <ChevronLeft className="w-6 h-6 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Decreto Reposición (Cancillería)</h1>
                    <p className="text-gray-500 text-sm">Modifique los datos del decreto maestro y la partida supletoria.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-[1400px] mx-auto p-6 h-[calc(100vh-180px)] min-h-[600px]">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg shrink-0">
                        <TabsTrigger value="bautizos" className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmaciones" disabled className="py-2 font-bold text-gray-400">Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonios" disabled className="py-2 font-bold text-gray-400">Matrimonios</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden min-h-0">
                        {/* LEFT SIDEBAR: LIST */}
                        <div className="lg:col-span-1 border-r border-gray-200 pr-4 flex flex-col h-full overflow-hidden">
                             <div className="relative mb-4 shrink-0">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                <input placeholder="Buscar por nombre o decreto..." className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredDecrees.length === 0 ? (<p className="text-sm text-gray-500 text-center py-4">No hay decretos.</p>) : (
                                    filteredDecrees.map((decree) => (
                                        <button key={decree.id} onClick={() => setSelectedDecreeId(decree.id)} className={cn("w-full text-left p-3 rounded-lg text-sm transition-all border group", selectedDecreeId === decree.id ? "bg-amber-50 border-amber-200 ring-1 ring-amber-300" : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300")}>
                                            <div className="font-bold text-gray-800 flex justify-between"><span>{decree.decreeNumber}</span><span className="text-[10px] font-normal text-gray-400">{decree.decreeDate}</span></div>
                                            <div className="text-gray-600 truncate text-xs mt-1 font-medium">{decree.targetName}</div>
                                            <div className="text-[10px] text-gray-400 mt-1 uppercase truncate">{decree.targetParishName || 'Sede Central'}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* RIGHT SIDE: FORM */}
                        <div className="lg:col-span-3 h-full overflow-y-auto custom-scrollbar px-2">
                            <TabsContent value="bautizos" className="mt-0 pb-10">{renderReposicionForm()}</TabsContent>
                        </div>
                    </div>
                </Tabs>
            </div>

            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Decreto">
                <div className="space-y-4">
                    <p className="text-gray-600">¿Está seguro que desea eliminar este decreto? Esta acción erradicará el documento de la Cancillería y de la Parroquia.</p>
                    <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete}>Confirmar Eliminación</Button></div>
                </div>
            </Modal>
        </DashboardLayout>
    );

    function renderReposicionForm() {
        if (!selectedDecreeId) return (<div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 p-10 min-h-[400px]"><Search className="w-12 h-12 mb-2 opacity-20" /><p>Seleccione un decreto del listado para editar</p></div>);

        return (
            <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
                <div className="bg-white rounded-lg shadow-sm border-l-4 border-amber-600 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2"><FileText className="w-5 h-5 text-amber-600" /> SECCIÓN 1: DATOS DEL DECRETO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Entidad Destino</label><Input value={decreeData.parroquia} readOnly className="bg-gray-100 text-purple-700 font-bold" /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número de Decreto</label><Input name="decreeNumber" value={decreeData.decreeNumber} onChange={handleDecreeChange} className="font-mono font-bold text-amber-600" /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Decreto</label><Input type="date" name="decreeDate" value={decreeData.decreeDate} onChange={handleDecreeChange}/></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Causa Reposición</label>
                            <select name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
                                <option value="">Seleccionar Causa...</option>
                                {conceptos.map(c => (<option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100 mt-6">
                        <h4 className="text-sm font-bold text-blue-800 mb-4 uppercase">Datos de Partida Original Perdida</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1 relative" ref={wrapperRef}>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Titular</label>
                                <Input name="targetName" value={decreeData.targetName} onChange={handleDecreeChange} autoComplete="off"/>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                                        {suggestions.map((record, idx) => (<div key={idx} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 font-bold" onClick={() => handleSuggestionClick(record)}>{record.firstName} {record.lastName}</div>))}
                                    </div>
                                )}
                            </div>
                            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Libro Ant.</label><Input name="book" value={decreeData.book} onChange={handleDecreeChange}/></div>
                            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Folio Ant.</label><Input name="page" value={decreeData.page} onChange={handleDecreeChange}/></div>
                            <div className="md:col-span-1 flex gap-2">
                                <div className="flex-1"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número Ant.</label><Input name="entry" value={decreeData.entry} onChange={handleDecreeChange}/></div>
                                <Button type="button" onClick={() => handleSearch()} disabled={isSearching} className="mb-[2px] bg-[#4B7BA7] hover:bg-[#3A6286] text-white">{isSearching ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}</Button>
                            </div>
                        </div>
                        {searchMessage && <div className={cn("mt-4 p-3 rounded-md text-sm font-medium flex items-center gap-2", searchMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>{searchMessage.text}</div>}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border-l-4 border-blue-600 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2"><UserPlus className="w-5 h-5 text-blue-600" /> SECCIÓN 2: DATOS DE NUEVA PARTIDA</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2 grid grid-cols-3 gap-6 bg-blue-50/30 p-4 rounded-xl border border-dashed border-blue-200 mb-2">
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 text-center">Libro Nuevo</label><Input name="book" value={newPartida.book} onChange={handleNewPartidaChange} className="font-mono font-bold text-center text-blue-700" /></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 text-center">Folio Nuevo</label><Input name="page" value={newPartida.page} onChange={handleNewPartidaChange} className="font-mono font-bold text-center text-blue-700" /></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 text-center">Acta Nueva</label><Input name="entry" value={newPartida.entry} onChange={handleNewPartidaChange} className="font-mono font-bold text-center text-blue-700" /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Bautismo</label><Input type="date" name="sacramentDate" value={newPartida.sacramentDate} onChange={handleNewPartidaChange} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lugar de Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChange} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombres</label><Input name="firstName" value={newPartida.firstName} onChange={handleNewPartidaChange} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Apellidos</label><Input name="lastName" value={newPartida.lastName} onChange={handleNewPartidaChange} /></div>
                        <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border">
                             <h4 className="col-span-2 text-[10px] font-bold text-blue-700 uppercase border-b pb-1 mb-2">Padres y Abuelos</h4>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Padre</label><Input name="fatherName" value={newPartida.fatherName} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Cédula Padre</label><Input name="ceduPadre" value={newPartida.ceduPadre} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Madre</label><Input name="motherName" value={newPartida.motherName} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Cédula Madre</label><Input name="ceduMadre" value={newPartida.ceduMadre} onChange={handleNewPartidaChange} /></div>
                        </div>
                        <div className="col-span-2 grid grid-cols-4 gap-4 p-4 bg-gray-100/50 rounded-xl border">
                            <h4 className="col-span-4 text-[10px] font-bold text-gray-500 uppercase border-b pb-1 mb-2">Registro Civil y Otros</h4>
                            <div><label className="text-[9px] font-bold">Serial</label><Input name="serialRegCivil" value={newPartida.serialRegCivil} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[9px] font-bold">NUIP</label><Input name="nuipNuit" value={newPartida.nuipNuit} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[9px] font-bold">Notaría</label><Input name="oficinaRegistro" value={newPartida.oficinaRegistro} onChange={handleNewPartidaChange} /></div>
                            <div><label className="text-[9px] font-bold">Ministro</label><Input name="minister" value={newPartida.minister} onChange={handleNewPartidaChange} /></div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between gap-4 pt-4 border-t border-gray-200 sticky bottom-0 bg-white p-4 shadow-lg rounded-t-lg z-10">
                     <Button type="button" variant="destructive" onClick={() => setShowDeleteModal(true)} disabled={isSubmitting}><Trash2 className="w-4 h-4 mr-2" /> Eliminar Decreto</Button>
                    <div className="flex gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate('/chancery/decree-replacement')} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6">{isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Actualizar Reposición</Button>
                    </div>
                </div>
            </form>
        );
    }
};

export default ChanceryDecreeReplacementEditPage;