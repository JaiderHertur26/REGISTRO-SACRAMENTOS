import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { Edit, Trash2, PlusCircle, Search, FileX2, Eye, Network, LayoutGrid, Church, FileSignature, ChevronDown, ChevronUp, Loader2, ShieldAlert, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService'; // AÑADIDO: Importación para el reverso matemático

const ChanceryDecreeReplacementViewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { getConceptosAnulacion } = useAppData();

    const [activeTab, setActiveTab] = useState("bautismo");
    const [records, setRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingDecrees, setIsLoadingDecrees] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const [vicaries, setVicaries] = useState([]);
    const [deaneries, setDeaneries] = useState([]);
    const [parishes, setParishes] = useState([]);
    const [isLoadingStructure, setIsLoadingStructure] = useState(true);

    const [openVicaries, setOpenVicaries] = useState([]);
    const [openDeaneries, setOpenDeaneries] = useState([]);
    const [openParishes, setOpenParishes] = useState([]);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    useEffect(() => {
        const fetchStructure = async () => {
            let targetDioceseId = user?.dioceseId || user?.diocese_id;

            if (!targetDioceseId && user?.chancery_id) {
                const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', user.chancery_id).single();
                if (chanData) targetDioceseId = chanData.diocese_id;
            }

            if (!targetDioceseId) return;

            setIsLoadingStructure(true);
            try {
                const [vicRes, decRes, parRes] = await Promise.all([
                    supabase.from('vicarias').select('*').eq('diocese_id', targetDioceseId),
                    supabase.from('decanatos').select('*'),
                    supabase.from('parishes').select('*').eq('diocese_id', targetDioceseId)
                ]);

                if (vicRes.data) setVicaries(vicRes.data);
                if (decRes.data) setDeaneries(decRes.data);
                if (parRes.data) setParishes(parRes.data);
            } catch (error) {
                console.error("Error cargando estructura:", error);
            } finally {
                setIsLoadingStructure(false);
            }
        };
        fetchStructure();
    }, [user]);

    const fetchAllDecrees = async () => {
        if (isLoadingStructure) return; 

        const parishIds = parishes.map(p => p.id);

        if (parishIds.length === 0) {
            setRecords([]);
            setIsLoadingDecrees(false);
            return;
        }

        setIsLoadingDecrees(true);
        try {
            const { data, error } = await supabase
                .from('decretos')
                .select('id, tipo, payload, parish_id')
                .eq('tipo', 'reposicion')
                .in('parish_id', parishIds)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedDecrees = data.map(d => {
                    const targetParish = parishes.find(p => p.id === d.parish_id);
                    return {
                        ...d.payload,
                        id: d.id, 
                        targetParishId: d.parish_id,
                        targetParishName: targetParish ? `${targetParish.name} - ${targetParish.city}` : 'Sede Central'
                    };
                });
                
                setRecords(mappedDecrees);
            }

        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar los decretos.", variant: "destructive" });
        } finally {
            setIsLoadingDecrees(false);
        }
    };

    useEffect(() => {
        fetchAllDecrees();
    }, [isLoadingStructure, parishes]);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = records.filter(r => {
            const recordSacrament = (r.sacrament || 'bautismo').toLowerCase();
            const matchesSacrament = recordSacrament === activeTab.toLowerCase();
            if (!matchesSacrament) return false;
            if (!term) return true;

            return (
                (r.targetName || r.nombres || '').toLowerCase().includes(term) ||
                (r.decreeNumber || r.numeroDecreto || '').toLowerCase().includes(term) ||
                (r.targetParishName || '').toLowerCase().includes(term)
            );
        });
        setFilteredRecords(filtered);
    }, [searchTerm, records, activeTab]);

    // 🚀 LÓGICA DE RESTAURACIÓN COMPLETA (ROLLBACK TOTAL PARA REPOSICIONES) - HOMOLOGADA CON PARROQUIA
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const decreeToUndo = records.find(c => c.id === deleteConfig.id);
            if (!decreeToUndo) throw new Error("Decreto no encontrado");

            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const newSum = decreeToUndo.newPartidaSummary || decreeToUndo.datosNuevaPartida;
            const targetParishId = decreeToUndo.targetParishId;

            // 1. Eliminar la Partida Supletoria y Revertir el Parámetro
            if (newSum) {
                const newBook = pad(newSum.book || newSum.book_number || newSum.Libro);
                const newPage = pad(newSum.page || newSum.page_number || newSum.folio);
                const newEntry = pad(newSum.entry || newSum.entry_number || newSum.numero);

                await supabase.from('baptisms').delete()
                    .eq('parish_id', targetParishId)
                    .eq('book_number', newBook)
                    .eq('folio', newPage)
                    .eq('number', newEntry);

                // MAGIA DEL REVERSO DEL LIBRO SUPLETORIO CON EL MOTOR MATEMÁTICO Y SALVAVIDAS
                const { data: pData } = await supabase
                    .from('parish_parameters')
                    .select('bautizos_params')
                    .eq('parish_id', targetParishId)
                    .maybeSingle();

                if (pData && pData.bautizos_params) {
                    const currentParams = pData.bautizos_params;
                    
                    // Usamos el motor para saber exactamente cómo retroceder el folio y número
                    const previosSupletorios = calculatePreviousConsecutive(
                        currentParams.suplementarioNumero,
                        currentParams.suplementarioFolio,
                        currentParams.suplementarioLibro,
                        currentParams.suplementarioPartidas || 2, // SALVAVIDAS
                        currentParams.suplementarioReiniciar || false // SALVAVIDAS
                    );

                    // Comparamos como enteros. Si es seguro, inyectamos los folios exactos con ceros.
                    if (parseInt(newEntry, 10) === parseInt(previosSupletorios.numero, 10)) {
                        const newParamsObj = { 
                            ...currentParams, 
                            suplementarioNumero: pad(previosSupletorios.numero),
                            suplementarioFolio: pad(previosSupletorios.folio),
                            suplementarioLibro: pad(previosSupletorios.libro)
                        };
                        
                        await supabase
                            .from('parish_parameters')
                            .update({ bautizos_params: newParamsObj })
                            .eq('parish_id', targetParishId);
                    }
                }
            }

            // 2. Eliminar Decreto
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);

            toast({ title: "Restauración Completada", description: "Decreto borrado remotamente y partida supletoria destruida.", className: "bg-green-50 text-green-900 border-green-200" });
            fetchAllDecrees();
        } catch (error) { 
            console.error("Error al restaurar:", error);
            toast({ title: "Error", description: "No se pudo restaurar la partida.", variant: "destructive" }); 
        } finally { 
            setIsDeleting(false); setDeleteConfig({ isOpen: false, id: null, name: '' }); 
        }
    };

    const toggleVicary = (id) => setOpenVicaries(prev => prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]);
    const toggleDeanery = (id) => setOpenDeaneries(prev => prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]);
    const toggleParish = (id) => setOpenParishes(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);

    const getParishDecrees = (parishId) => filteredRecords.filter(r => String(r.targetParishId) === String(parishId));
    const getDeaneryParishesWithDecrees = (deaneryId) => parishes.filter(p => String(p.decanate_id) === String(deaneryId) || String(p.decanateId) === String(deaneryId)).filter(p => getParishDecrees(p.id).length > 0);
    const getVicaryDeaneriesWithDecrees = (vicaryId) => deaneries.filter(d => String(d.vicaria_id) === String(vicaryId) || String(d.vicaryId) === String(vicaryId)).filter(d => getDeaneryParishesWithDecrees(d.id).length > 0);
    const getDirectParishesWithDecrees = (vicaryId) => parishes.filter(p => (String(p.vicary_id) === String(vicaryId) || String(p.vicaryId) === String(vicaryId)) && (!p.decanate_id && !p.decanateId)).filter(p => getParishDecrees(p.id).length > 0);
    const getUnassignedDecrees = () => { const parishIds = parishes.map(p => String(p.id)); return filteredRecords.filter(r => !r.targetParishId || !parishIds.includes(String(r.targetParishId))); };

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        if (row.causa) return row.causa.toUpperCase();
        const conceptos = getConceptosAnulacion(user?.dioceseId || user?.id) || [];
        const c = conceptos.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'REPOSICIÓN DE PARTIDA';
    };

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    const DecreeTable = ({ decrees }) => {
        if (decrees.length === 0) return null;

        const columns = [
            { header: 'No. Decreto', render: (row) => <span className="font-mono font-black text-amber-600 text-xs">#{row.decreeNumber || row.numeroDecreto}</span> },
            { header: 'Fecha', render: (row) => <span className="text-[11px] font-bold text-gray-500 uppercase">{row.decreeDate || row.fechaDecreto}</span> },
            { header: 'Titular de Reposición', render: (row) => <span className="font-black uppercase text-xs text-green-600">{row.targetName || row.nombres}</span> },
            {
                header: 'Ubicación Supletoria', render: (row) => {
                    const sum = row.newPartidaSummary || row.datosNuevaPartida || {};
                    return <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">L:{pad(sum.book || sum.book_number || sum.Libro)} F:{pad(sum.page || sum.page_number || sum.folio)} N:{pad(sum.entry || sum.entry_number || sum.numero)}</span>;
                }
            },
            { header: 'Causa', render: (row) => <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight block max-w-[150px] truncate">{getConceptName(row)}</span> }
        ];

        return (
            <div className="overflow-x-auto rounded-xl border border-gray-200 mt-3 shadow-sm">
                <Table
                    columns={columns}
                    data={decrees}
                    actions={[
                        { label: <Eye className="w-4 h-4" />, type: 'view', onClick: (row) => { setSelectedDecree(row); setViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-yellow-50 p-2 rounded-xl transition-all" },
                        { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: (row) => navigate(`/chancery/decree-replacement/edit?id=${row.id}`), className: "text-amber-600 hover:bg-amber-50 p-2 rounded-xl transition-all" },
                        { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row) => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber || row.numeroDecreto }), className: "text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all" }
                    ]}
                />
            </div>
        );
    };

    const renderHierarchicalContent = () => {
        if (isLoadingStructure || isLoadingDecrees) return <div className="py-20 text-center text-gray-400 uppercase font-black text-xs animate-pulse flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-500" /> Sincronizando Archivo Diocesano...</div>;
        if (filteredRecords.length === 0) return <EmptyState />;

        const unassignedDecrees = getUnassignedDecrees();
        let renderedAny = false;

        return (
            <div className="animate-in fade-in duration-500 mt-6 space-y-8">
                {vicaries.map(vicary => {
                    const validDeaneries = getVicaryDeaneriesWithDecrees(vicary.id);
                    const validDirectParishes = getDirectParishesWithDecrees(vicary.id);

                    if (validDeaneries.length === 0 && validDirectParishes.length === 0) return null;
                    renderedAny = true;
                    const isVicaryOpen = openVicaries.includes(vicary.id);

                    return (
                        <div key={vicary.id} className="bg-white rounded-[2.5rem] shadow-xl shadow-amber-900/5 border border-slate-100 overflow-hidden transition-all duration-300">
                            <div className="bg-slate-50 hover:bg-slate-100 p-6 flex items-center justify-between cursor-pointer border-b border-slate-200 transition-colors" onClick={() => toggleVicary(vicary.id)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                                        <Network className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-[#111111] uppercase tracking-tighter">{vicary.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Jurisdicción Zonal</p>
                                    </div>
                                </div>
                                <div className="text-slate-400">{isVicaryOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}</div>
                            </div>

                            {isVicaryOpen && (
                                <div className="p-6 lg:p-8 space-y-8 animate-in slide-in-from-top-4 duration-300">
                                    {validDeaneries.map(decanate => {
                                        const decanateParishes = getDeaneryParishesWithDecrees(decanate.id);
                                        const isDeaneryOpen = openDeaneries.includes(decanate.id);

                                        return (
                                            <div key={decanate.id} className="relative ml-4 pl-8 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-1 before:bg-slate-100 before:rounded-full space-y-4">
                                                <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors" onClick={() => toggleDeanery(decanate.id)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm"><LayoutGrid className="w-4 h-4 text-slate-500" /></div>
                                                        <h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">{decanate.name}</h4>
                                                    </div>
                                                    <div className="text-slate-400">{isDeaneryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                                                </div>

                                                {isDeaneryOpen && (
                                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                        {decanateParishes.map(parish => {
                                                            const isParishOpen = openParishes.includes(parish.id);
                                                            return (
                                                                <div key={parish.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm ml-6 overflow-hidden">
                                                                    <div className="flex items-center gap-2 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleParish(parish.id)}>
                                                                        <Church className="w-4 h-4 text-amber-500" />
                                                                        <h5 className="font-black text-gray-900 uppercase text-sm">{parish.name}</h5>
                                                                        <span className="ml-auto bg-amber-50 text-amber-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-amber-100">{getParishDecrees(parish.id).length} Decretos</span>
                                                                        <div className="text-gray-400 ml-2">{isParishOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                                                    </div>
                                                                    {isParishOpen && (<div className="px-4 pb-4 animate-in fade-in duration-300"><DecreeTable decrees={getParishDecrees(parish.id)} /></div>)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {validDirectParishes.map(parish => {
                                        const isParishOpen = openParishes.includes(parish.id);
                                        return (
                                            <div key={parish.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm ml-4 overflow-hidden">
                                                <div className="flex items-center gap-2 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleParish(parish.id)}>
                                                    <Church className="w-4 h-4 text-amber-500" />
                                                    <h5 className="font-black text-gray-900 uppercase text-sm">{parish.name} <span className="text-[10px] text-gray-400 ml-2 font-bold">(Sin Decanato)</span></h5>
                                                    <span className="ml-auto bg-amber-50 text-amber-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-amber-100">{getParishDecrees(parish.id).length} Decretos</span>
                                                    <div className="text-gray-400 ml-2">{isParishOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                                </div>
                                                {isParishOpen && (<div className="px-4 pb-4 animate-in fade-in duration-300"><DecreeTable decrees={getParishDecrees(parish.id)} /></div>)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {unassignedDecrees.length > 0 && (
                    <div className="bg-amber-50/30 rounded-[2.5rem] shadow-sm border border-dashed border-amber-200 overflow-hidden">
                        <div className="p-6 flex items-center gap-4 border-b border-amber-100/50">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-amber-100">
                                <FileSignature className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-amber-900 uppercase tracking-tighter">Sede Central / Otros</h3>
                                <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-[0.2em] mt-1">Decretos sin clasificar por parroquia</p>
                            </div>
                        </div>
                        <div className="p-6 lg:p-8"><DecreeTable decrees={unassignedDecrees} /></div>
                    </div>
                )}

                {!renderedAny && unassignedDecrees.length === 0 && <EmptyState />}
            </div>
        );
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20 pt-6">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 relative">
                            <ShieldAlert className="w-7 h-7" />
                            <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5"><Cloud className="w-3 h-3 text-white" /></div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decretos de Reposición</h1>
                            <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest mt-1">Archivo Global de la Diócesis</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate('/chancery/decree-replacement/new')}
                        className="bg-gradient-to-r from-amber-500 to-amber-700 hover:scale-[1.02] text-white px-8 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-900/20 transition-all active:scale-95"
                    >
                        <PlusCircle className="w-4 h-4 mr-2" /> Emitir Nuevo Decreto
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm mb-6">
                        <TabsList className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent p-0">
                            <TabsTrigger value="bautismo" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmacion" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400" disabled>Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonio" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400" disabled>Matrimonios</TabsTrigger>
                        </TabsList>

                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar decreto o titular..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:bg-white outline-none text-[11px] font-bold text-gray-700 uppercase transition-all"
                            />
                        </div>
                    </div>

                    <TabsContent value="bautismo">{renderHierarchicalContent()}</TabsContent>
                    <TabsContent value="confirmacion">{renderHierarchicalContent()}</TabsContent>
                    <TabsContent value="matrimonio">{renderHierarchicalContent()}</TabsContent>
                </Tabs>
            </div>

            <ViewRepositionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} isMasterCopy={true} />

            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen} 
                title="Restaurar Consecutivos y Eliminar" 
                message="Al confirmar, el decreto será eliminado de la Nube. La partida supletoria generada será destruida y el consecutivo del libro supletorio regresará a su estado anterior remotamente." 
                onConfirm={confirmDelete} 
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })} 
                variant="destructive"
                confirmText={isDeleting ? "Eliminando..." : "Confirmar Eliminación"}
            />
        </DashboardLayout>
    );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-[2.5rem] border border-dashed border-gray-200 mt-6 shadow-sm">
        <FileX2 className="w-16 h-16 mb-4 text-gray-200" />
        <p className="font-black uppercase tracking-widest text-sm text-gray-500">Archivo Limpio</p>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-md text-center leading-relaxed">No se encontraron decretos en la estructura diocesana bajo estos criterios.</p>
    </div>
);

export default ChanceryDecreeReplacementViewPage;