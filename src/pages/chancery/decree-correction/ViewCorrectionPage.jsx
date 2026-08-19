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
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';

const ViewCorrectionPage = () => {
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

    // 1. CARGA DE ESTRUCTURA DIOCESANA
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

    // 2. CARGA DE DECRETOS DE CORRECCIÓN (100% SUPABASE)
    const fetchAllDecrees = async () => {
        if (isLoadingStructure) return; 
        const parishIds = parishes.map(p => p.id);
        if (parishIds.length === 0) { setRecords([]); setIsLoadingDecrees(false); return; }

        setIsLoadingDecrees(true);
        try {
            const { data, error } = await supabase.from('decretos').select('id, payload, parish_id').eq('tipo', 'correccion').in('parish_id', parishIds).order('created_at', { ascending: false });
            if (error) throw error;

            if (data) {
                const mappedDecrees = data.map(d => {
                    const targetParish = parishes.find(p => p.id === d.parish_id);
                    return {
                        ...d.payload, id: d.id, targetParishId: d.parish_id,
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

    useEffect(() => { fetchAllDecrees(); }, [isLoadingStructure, parishes]);

    // 3. FILTROS
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = records.filter(r => {
            if (!term) return true;
            return ((r.targetName || r.nombres || '').toLowerCase().includes(term) || (r.decreeNumber || r.numeroDecreto || '').toLowerCase().includes(term) || (r.targetParishName || '').toLowerCase().includes(term));
        });
        setFilteredRecords(filtered);
    }, [searchTerm, records, activeTab]);

    // 4. ROLLBACK MAESTRO DE CORRECCIÓN
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const decreeToUndo = records.find(c => c.id === deleteConfig.id);
            if (!decreeToUndo) throw new Error("Decreto no encontrado");

            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const origSum = decreeToUndo.originalPartidaSummary;
            const newSum = decreeToUndo.newPartidaSummary;
            const targetParishId = decreeToUndo.targetParishId;

            // A. Restaurar la Original
            if (origSum) {
                const origBook = pad(origSum.book || origSum.Libro);
                const origPage = pad(origSum.page || origSum.folio);
                const origEntry = pad(origSum.entry || origSum.numero);

                const { data: origData } = await supabase.from('baptisms').select('id, raw_data').eq('parish_id', targetParishId).eq('book_number', origBook).eq('folio', origPage).eq('number', origEntry).maybeSingle();

                if (origData) {
                    const cleanedRaw = { ...origData.raw_data };
                    delete cleanedRaw.anulado; delete cleanedRaw.isAnnulled;
                    cleanedRaw.status = 'seated'; cleanedRaw.estado = 'permanente';
                    // Reemplazamos la nota actual vaciándola para limpiarla (o puedes implementar lógica más compleja para borrar solo la de anulación)
                    cleanedRaw.notaMarginal = null; 
                    await supabase.from('baptisms').update({ status: 'seated', nota_marginal: null, raw_data: cleanedRaw }).eq('id', origData.id);
                }
            }

            // B. Eliminar la Supletoria y Reverso de Parámetros
            if (newSum) {
                const newBook = pad(newSum.book || newSum.Libro);
                const newPage = pad(newSum.page || newSum.folio);
                const newEntry = pad(newSum.entry || newSum.numero);

                await supabase.from('baptisms').delete().eq('parish_id', targetParishId).eq('book_number', newBook).eq('folio', newPage).eq('number', newEntry);

                const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', targetParishId).maybeSingle();
                if (pData && pData.bautizos_params) {
                    const currentParams = pData.bautizos_params;
                    if (Number(newEntry) === Number(currentParams.suplementarioNumero) - 1) {
                        await supabase.from('parish_parameters').update({ bautizos_params: { ...currentParams, suplementarioNumero: Number(currentParams.suplementarioNumero) - 1 } }).eq('parish_id', targetParishId);
                    }
                }
            }

            // C. Eliminar Decreto
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);

            toast({ title: "Restauración Completada", description: "Decreto borrado, partida restaurada y supletoria destruida.", className: "bg-green-50 text-green-900 border-green-200" });
            fetchAllDecrees();
        } catch (error) { 
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

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        const conceptos = getConceptosAnulacion(user?.dioceseId || user?.id) || [];
        const c = conceptos.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'CORRECCIÓN DE PARTIDA';
    };

    const DecreeTable = ({ decrees }) => {
        if (decrees.length === 0) return null;
        const columns = [
            { header: 'No. Decreto', render: (row) => <span className="font-mono font-black text-blue-600 text-xs">#{row.decreeNumber || row.numeroDecreto}</span> },
            { header: 'Fecha', render: (row) => <span className="text-[11px] font-bold text-gray-500 uppercase">{row.decreeDate || row.fechaDecreto}</span> },
            { header: 'Titular Corregido', render: (row) => <span className="font-black uppercase text-xs text-purple-600">{row.targetName || row.nombres}</span> },
            {
                header: 'Ubicación Original', render: (row) => {
                    const sum = row.originalPartidaSummary || {};
                    return <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono line-through">L:{sum.book || sum.Libro || ''} F:{sum.page || sum.folio || ''} N:{sum.entry || sum.numero || ''}</span>;
                }
            },
            { header: 'Concepto', render: (row) => <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight block max-w-[150px] truncate">{getConceptName(row)}</span> }
        ];

        return (
            <div className="overflow-x-auto rounded-xl border border-gray-200 mt-3 shadow-sm">
                <Table columns={columns} data={decrees}
                    actions={[
                        { label: <Eye className="w-4 h-4" />, type: 'view', onClick: (row) => { setSelectedDecree(row); setViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-yellow-50 p-2 rounded-xl transition-all" },
                        { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: (row) => navigate(`/chancery/decree-correction/edit?id=${row.id}`), className: "text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all" },
                        { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row) => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber }), className: "text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all" }
                    ]}
                />
            </div>
        );
    };

    const renderHierarchicalContent = () => {
        if (isLoadingStructure || isLoadingDecrees) return <div className="py-20 text-center text-gray-400 uppercase font-black text-xs animate-pulse flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" /> Sincronizando Archivo Diocesano...</div>;
        if (filteredRecords.length === 0) return <EmptyState />;
        return (
            <div className="animate-in fade-in duration-500 mt-6 space-y-8">
                {vicaries.map(vicary => {
                    const validDeaneries = getVicaryDeaneriesWithDecrees(vicary.id);
                    const validDirectParishes = getDirectParishesWithDecrees(vicary.id);
                    if (validDeaneries.length === 0 && validDirectParishes.length === 0) return null;
                    const isVicaryOpen = openVicaries.includes(vicary.id);

                    return (
                        <div key={vicary.id} className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden transition-all duration-300">
                            <div className="bg-slate-50 hover:bg-slate-100 p-6 flex items-center justify-between cursor-pointer border-b border-slate-200 transition-colors" onClick={() => toggleVicary(vicary.id)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"><Network className="w-6 h-6 text-[#4B7BA7]" /></div>
                                    <div><h3 className="font-black text-xl text-[#111111] uppercase tracking-tighter">{vicary.name}</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Jurisdicción Zonal</p></div>
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
                                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm"><LayoutGrid className="w-4 h-4 text-slate-500" /></div><h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">{decanate.name}</h4></div>
                                                    <div className="text-slate-400">{isDeaneryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                                                </div>
                                                {isDeaneryOpen && (
                                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                        {decanateParishes.map(parish => {
                                                            const isParishOpen = openParishes.includes(parish.id);
                                                            return (
                                                                <div key={parish.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm ml-6 overflow-hidden">
                                                                    <div className="flex items-center gap-2 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleParish(parish.id)}>
                                                                        <Church className="w-4 h-4 text-blue-500" />
                                                                        <h5 className="font-black text-gray-900 uppercase text-sm">{parish.name}</h5>
                                                                        <span className="ml-auto bg-blue-50 text-[#4B7BA7] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">{getParishDecrees(parish.id).length} Decretos</span>
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
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 relative"><ShieldAlert className="w-7 h-7" /><div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5"><Cloud className="w-3 h-3 text-white" /></div></div>
                        <div><h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decretos de Corrección</h1><p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest mt-1">Archivo Global de la Diócesis</p></div>
                    </div>
                    <Button onClick={() => navigate('/chancery/decree-correction/new')} className="bg-gradient-to-r from-blue-600 to-blue-800 hover:scale-[1.02] text-white px-8 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-95"><PlusCircle className="w-4 h-4 mr-2" /> Emitir Nuevo Decreto</Button>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm mb-6">
                        <TabsList className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent p-0">
                            <TabsTrigger value="bautismo" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmacion" disabled className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white transition-all bg-gray-50 text-gray-400">Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonio" disabled className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white transition-all bg-gray-50 text-gray-400">Matrimonios</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input type="text" placeholder="Buscar decreto o titular..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/20 focus:bg-white outline-none text-[11px] font-bold text-gray-700 uppercase transition-all" />
                        </div>
                    </div>
                    <TabsContent value="bautismo">{renderHierarchicalContent()}</TabsContent>
                </Tabs>
            </div>
            <ViewCorrectionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} isMasterCopy={true} />
            <ConfirmationDialog isOpen={deleteConfig.isOpen} title="Restaurar Partida Original y Eliminar" message="El decreto será eliminado. La partida supletoria será destruida y la partida original recuperará su validez canónica (se borrará la nota marginal de anulación)." onConfirm={confirmDelete} onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })} variant="destructive" confirmText={isDeleting ? "Restaurando..." : "Confirmar Restauración"} />
        </DashboardLayout>
    );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-[2.5rem] border border-dashed border-gray-200 mt-6 shadow-sm"><FileX2 className="w-16 h-16 mb-4 text-gray-200" /><p className="font-black uppercase tracking-widest text-sm text-gray-500">Archivo Limpio</p></div>
);

export default ViewCorrectionPage;