import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { Edit, Trash2, PlusCircle, Search, FileX2, Eye, Network, LayoutGrid, Church, FileSignature, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN DE SUPABASE

const ChanceryDecreeReplacementViewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { getConceptosAnulacion } = useAppData(); // Usamos la app data para los conceptos
    
    // --- ESTADOS DE DECRETOS ---
    const [activeTab, setActiveTab] = useState("bautismo");
    const [records, setRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // --- ESTADOS ESTRUCTURA ECLESIÁSTICA ---
    const [vicaries, setVicaries] = useState([]);
    const [deaneries, setDeaneries] = useState([]);
    const [parishes, setParishes] = useState([]);
    const [isLoadingStructure, setIsLoadingStructure] = useState(true);

    // --- ESTADOS PARA MODAL ---
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);

    // 1. CARGAR ESTRUCTURA DESDE SUPABASE
    useEffect(() => {
        const fetchStructure = async () => {
            if (!user?.dioceseId) return;
            setIsLoadingStructure(true);
            try {
                const [vicRes, decRes, parRes] = await Promise.all([
                    supabase.from('vicarias').select('*').eq('diocese_id', user.dioceseId),
                    supabase.from('decanatos').select('*'),
                    supabase.from('parishes').select('*').eq('diocese_id', user.dioceseId)
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
    }, [user?.dioceseId]);

    // 2. CARGAR DECRETOS DE REPOSICIÓN LOCALES
    const loadData = () => {
        if (!user) return;
        const chanceryId = String(user.dioceseId || user.id);
        const allDecreesMap = new Map();

        // Escaneamos TODO el almacenamiento local
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // EL FILTRO CLAVE: Buscamos llaves de reposición vinculadas a Cancillería
            if ((key.includes('decreeReplacement') || key.includes('decrees_replacement')) && key.includes(chanceryId)) {
                try {
                    const rawData = localStorage.getItem(key);
                    if (rawData && rawData.startsWith('[')) { 
                        const parsed = JSON.parse(rawData);
                        parsed.forEach(item => {
                            const isDecree = item && (item.decreeNumber || item.numeroDecreto) && (item.targetName || item.nombres);
                            const isNotRegularPartida = item.type === 'replacement' || item.conceptoAnulacionId || item.newPartidaSummary;

                            if (isDecree && isNotRegularPartida) {
                                const itemSacrament = item.sacrament || 'bautismo';
                                if (itemSacrament === activeTab || activeTab === "bautismo") {
                                    allDecreesMap.set(item.id, item);
                                }
                            }
                        });
                    }
                } catch (e) {}
            }
        }

        const sortedRecords = Array.from(allDecreesMap.values())
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        setRecords(sortedRecords);
        setFilteredRecords(sortedRecords);
    };

    useEffect(() => {
        loadData();
    }, [user, activeTab]);

    // 3. APLICAR BÚSQUEDA
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = records.filter(r => 
            (r.targetName || r.nombres || '').toLowerCase().includes(term) ||
            (r.apellidos || '').toLowerCase().includes(term) ||
            (r.decreeNumber || r.numeroDecreto || '').toLowerCase().includes(term) ||
            (r.targetParishName || '').toLowerCase().includes(term)
        );
        setFilteredRecords(filtered);
    }, [searchTerm, records]);

    // 4. ELIMINAR DECRETO (Lógica Reposición)
    const handleDelete = (id) => {
        if (window.confirm("¿Está seguro de eliminar este decreto de TODO EL SISTEMA? Esta acción borrará la copia de Cancillería y las copias de la Parroquia.")) {
            let deleted = false;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.includes('decreeReplacement') || key.includes('decreeReplacements')) {
                    try {
                        let currentRecords = JSON.parse(localStorage.getItem(key) || '[]');
                        const originalLength = currentRecords.length;
                        currentRecords = currentRecords.filter(r => r.id !== id);
                        
                        if (currentRecords.length < originalLength) {
                            localStorage.setItem(key, JSON.stringify(currentRecords));
                            deleted = true;
                        }
                    } catch(e) {}
                }
            }

            if (deleted) {
                // Actualizar estado local eliminando el registro
                setRecords(prev => prev.filter(r => r.id !== id));
                toast({ title: "Eliminado", description: "El decreto ha sido borrado del sistema central.", className: "bg-green-50 text-green-900 border-green-200" });
            } else {
                toast({ title: "Error", description: "No se pudo eliminar el archivo.", variant: "destructive" });
            }
        }
    };

    // --- LÓGICA DE AGRUPACIÓN JERÁRQUICA ---
    const getParishDecrees = (parishId) => {
        return filteredRecords.filter(r => String(r.targetParishId) === String(parishId));
    };

    const getDeaneryParishesWithDecrees = (deaneryId) => {
        return parishes
            .filter(p => String(p.decanate_id) === String(deaneryId) || String(p.decanateId) === String(deaneryId))
            .filter(p => getParishDecrees(p.id).length > 0);
    };

    const getVicaryDeaneriesWithDecrees = (vicaryId) => {
        return deaneries
            .filter(d => String(d.vicaria_id) === String(vicaryId) || String(d.vicaryId) === String(vicaryId))
            .filter(d => getDeaneryParishesWithDecrees(d.id).length > 0);
    };

    const getDirectParishesWithDecrees = (vicaryId) => {
        return parishes
            .filter(p => (String(p.vicary_id) === String(vicaryId) || String(p.vicaryId) === String(vicaryId)) && (!p.decanate_id && !p.decanateId))
            .filter(p => getParishDecrees(p.id).length > 0);
    };

    const getUnassignedDecrees = () => {
        // Decretos que no tienen un parishId asignado o que pertenecen a una parroquia que ya no existe
        const parishIds = parishes.map(p => String(p.id));
        return filteredRecords.filter(r => !r.targetParishId || !parishIds.includes(String(r.targetParishId)));
    };

    // --- COMPONENTE DE TABLA DE DECRETOS ---
    const DecreeTable = ({ decrees }) => {
        if (decrees.length === 0) return null;
        
        const columns = [
            { header: 'No. Decreto', render: (row) => <span className="font-mono font-black text-[#4B7BA7] text-xs">#{row.decreeNumber || row.numeroDecreto || '---'}</span> },
            { header: 'Fecha', render: (row) => <span className="text-[11px] font-bold text-gray-500 uppercase">{row.decreeDate || row.fechaDecreto || '---'}</span> },
            { header: 'Concepto / Causa', render: (row) => {
                const conceptos = getConceptosAnulacion(user?.dioceseId || user?.id) || [];
                const conceptoMatch = conceptos.find(c => String(c.id) === String(row.conceptoAnulacionId));
                const nombreConcepto = conceptoMatch ? conceptoMatch.concepto : (row.concepto || row.causa || 'DECRETO DE REPOSICIÓN');
                return <span className="font-bold text-[9px] bg-orange-50 text-orange-700 px-3 py-1 rounded-full border border-orange-100 block truncate w-full max-w-[180px] uppercase tracking-widest">{nombreConcepto}</span>;
            } },
            { header: 'Titular', render: (row) => <span className="font-black uppercase text-xs text-gray-900">{row.targetName || `${row.nombres || ''} ${row.apellidos || ''}`.trim()}</span> },
            { header: 'Nueva Partida', render: (row) => {
                const data = row.newPartidaSummary || row.datosNuevaPartida || {};
                const L = data.book || data.book_number || data.numeroLibro || '-';
                const F = data.page || data.page_number || data.folio || '-';
                const N = data.entry || data.entry_number || data.numeroActa || '-';
                return <span className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-widest">L:{L} / F:{F} / A:{N}</span>;
            } },
            { header: 'Estado', render: (row) => <span className="bg-green-50 text-green-600 px-3 py-1 border border-green-100 rounded-full text-[9px] font-black uppercase tracking-widest">{row.estado || row.status || 'Activo'}</span> }
        ];

        return (
            <div className="overflow-x-auto rounded-xl border border-gray-200 mt-3 shadow-sm">
                <Table 
                    columns={columns} 
                    data={decrees}
                    actions={[
                        { label: <Eye className="w-4 h-4" />, type: 'view', onClick: (row) => { setSelectedDecree(row); setViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-yellow-50 p-2 rounded-xl transition-all", title: "Vista Previa / Imprimir" },
                        { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: (row) => navigate(`/chancery/decree-replacement/edit?id=${row.id}`), className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-xl transition-all", title: "Editar" },
                        { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row) => handleDelete(row.id), className: "text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all", title: "Eliminar" }
                    ]}
                />
            </div>
        );
    };

    // --- RENDERIZADO DEL CONTENIDO JERÁRQUICO ---
    const renderHierarchicalContent = () => {
        if (isLoadingStructure) return <div className="py-20 text-center text-gray-400 uppercase font-black text-xs animate-pulse">Estructurando Diócesis...</div>;
        if (filteredRecords.length === 0) return <EmptyState />;

        const unassignedDecrees = getUnassignedDecrees();
        let renderedAny = false;

        return (
            <div className="animate-in fade-in duration-500 mt-6 space-y-8">
                
                {/* RECORRIDO POR VICARÍAS */}
                {vicaries.map(vicary => {
                    const validDeaneries = getVicaryDeaneriesWithDecrees(vicary.id);
                    const validDirectParishes = getDirectParishesWithDecrees(vicary.id);
                    
                    if (validDeaneries.length === 0 && validDirectParishes.length === 0) return null;
                    renderedAny = true;

                    return (
                        <div key={vicary.id} className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                            {/* CABECERA VICARÍA */}
                            <div className="bg-slate-50 p-6 flex items-center gap-4 border-b border-slate-200">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                                    <Network className="w-6 h-6 text-[#4B7BA7]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl text-[#111111] uppercase tracking-tighter">{vicary.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Jurisdicción Zonal</p>
                                </div>
                            </div>

                            <div className="p-6 lg:p-8 space-y-8">
                                {/* DECANATOS DE ESTA VICARÍA */}
                                {validDeaneries.map(decanate => {
                                    const decanateParishes = getDeaneryParishesWithDecrees(decanate.id);
                                    return (
                                        <div key={decanate.id} className="relative ml-4 pl-8 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-1 before:bg-slate-100 before:rounded-full space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                                                    <LayoutGrid className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">{decanate.name}</h4>
                                            </div>

                                            <div className="space-y-6">
                                                {decanateParishes.map(parish => (
                                                    <div key={parish.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm ml-6">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Church className="w-4 h-4 text-[#D4AF37]" />
                                                            <h5 className="font-black text-gray-900 uppercase text-sm">{parish.name}</h5>
                                                            <span className="ml-auto bg-blue-50 text-[#4B7BA7] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
                                                                {getParishDecrees(parish.id).length} Decretos
                                                            </span>
                                                        </div>
                                                        <DecreeTable decrees={getParishDecrees(parish.id)} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* PARROQUIAS DIRECTAS DE ESTA VICARÍA */}
                                {validDirectParishes.map(parish => (
                                    <div key={parish.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm ml-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Church className="w-4 h-4 text-[#D4AF37]" />
                                            <h5 className="font-black text-gray-900 uppercase text-sm">{parish.name} <span className="text-[10px] text-gray-400 ml-2 font-bold">(Sin Decanato)</span></h5>
                                            <span className="ml-auto bg-blue-50 text-[#4B7BA7] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
                                                {getParishDecrees(parish.id).length} Decretos
                                            </span>
                                        </div>
                                        <DecreeTable decrees={getParishDecrees(parish.id)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* DECRETOS SIN PARROQUIA ASIGNADA / DECRETOS LOCALES DE CANCILLERÍA */}
                {unassignedDecrees.length > 0 && (
                    <div className="bg-amber-50/30 rounded-[2.5rem] shadow-sm border border-dashed border-amber-200 overflow-hidden">
                        <div className="p-6 flex items-center gap-4 border-b border-amber-100/50">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-amber-100">
                                <FileSignature className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-amber-900 uppercase tracking-tighter">Sede Central / Huérfanos</h3>
                                <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-[0.2em] mt-1">Decretos sin vínculo parroquial</p>
                            </div>
                        </div>
                        <div className="p-6 lg:p-8">
                            <DecreeTable decrees={unassignedDecrees} />
                        </div>
                    </div>
                )}

                {/* Si no se renderizó nada a pesar de tener filtros (búsqueda que no coincide con la jerarquía) */}
                {!renderedAny && unassignedDecrees.length === 0 && <EmptyState />}
            </div>
        );
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
                
                {/* 🏛️ HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">Decretos de Reposición</h1>
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                            <Network className="w-3 h-3 text-[#D4AF37]" /> Archivo Organizado por Jurisdicción
                        </p>
                    </div>
                    <Button 
                        onClick={() => navigate('/chancery/decree-replacement/new')} 
                        className="w-full md:w-auto bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:scale-[1.02] text-white px-8 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-yellow-900/20 transition-all active:scale-95"
                    >
                        <PlusCircle className="w-4 h-4 mr-2" /> Emitir Nuevo Decreto
                    </Button>
                </div>

                {/* 📝 CONTROLES DE BÚSQUEDA Y PESTAÑAS */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
                        
                        <TabsList className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent p-0">
                            <TabsTrigger value="bautismo" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400">
                                Bautizos
                            </TabsTrigger>
                            <TabsTrigger value="confirmacion" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400">
                                Confirmaciones
                            </TabsTrigger>
                            <TabsTrigger value="matrimonio" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white data-[state=active]:shadow-md transition-all bg-gray-50 text-gray-400">
                                Matrimonios
                            </TabsTrigger>
                        </TabsList>
                        
                        {/* 🔍 BUSCADOR */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Buscar decreto o titular..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/20 focus:bg-white outline-none text-[11px] font-bold text-gray-700 uppercase transition-all"
                            />
                        </div>
                    </div>

                    {/* RENDERIZADO JERÁRQUICO */}
                    <TabsContent value="bautismo">{renderHierarchicalContent()}</TabsContent>
                    <TabsContent value="confirmacion">{renderHierarchicalContent()}</TabsContent>
                    <TabsContent value="matrimonio">{renderHierarchicalContent()}</TabsContent>
                </Tabs>

            </div>

            {/* MODAL DE VISTA PREVIA E IMPRESIÓN */}
            <ViewRepositionDecreeModal 
                isOpen={viewModalOpen}
                onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }}
                decreeData={selectedDecree}
            />
        </DashboardLayout>
    );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-[2.5rem] border border-dashed border-gray-200 mt-6 shadow-sm">
         <FileX2 className="w-16 h-16 mb-4 text-gray-200" />
         <p className="font-black uppercase tracking-widest text-sm text-gray-500">Archivo Limpio</p>
         <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-md text-center leading-relaxed">
             No se encontraron decretos de reposición en la estructura diocesana bajo estos criterios. Si busca un decreto en específico, intente borrar el buscador.
         </p>
    </div>
);

export default ChanceryDecreeReplacementViewPage;