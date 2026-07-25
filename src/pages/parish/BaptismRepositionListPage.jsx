import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { 
    PlusCircle, Search, Eye, Edit, Trash2, 
    FileText, ShieldCheck, BookOpen, 
    ArrowRight, Loader2, FileX2, History
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

const BaptismRepositionListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { 
        getDecreeReplacementsBySacrament, 
        deleteDecreeReplacement,
        getConceptosAnulacion,
        getBaptisms
    } = useAppData();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- ESTADOS DE MODALES ---
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    // --- CARGA DE DATOS ---
    useEffect(() => {
        if (user?.parishId) {
            const loadedConcepts = getConceptosAnulacion(user.parishId);
            setConcepts(loadedConcepts);
            loadData();
        }
    }, [user, activeTab]);

    const loadData = async () => {
        setIsLoading(true);
        // Simulamos un breve delay para asegurar que los hooks de AppData hayan terminado
        setTimeout(() => {
            const data = getDecreeReplacementsBySacrament(activeTab, user.parishId);
            setRecords(data || []);
            setIsLoading(false);
        }, 400);
    };

    // 🧠 RESOLUTOR DE IDENTIDAD (SSOT)
    // Busca el nombre en la Nube, si no está usa el resumen del decreto
    const resolvePersonName = (id, summary, fallback) => {
        if (id) {
            const all = getBaptisms(user?.parishId) || [];
            const found = all.find(b => b.id === id);
            if (found) return `${found.lastName || found.apellidos}, ${found.firstName || found.nombres}`.toUpperCase();
        }
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${lName}, ${fName}`.toUpperCase();
        }
        return (fallback || '---').toUpperCase();
    };

    const filteredRecords = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return records.filter(r => {
            const decreeNum = (r.decreeNumber || r.numeroDecreto || '').toLowerCase();
            const personName = resolvePersonName(r.newPartidaId, r.newPartidaSummary, r.targetName).toLowerCase();
            return decreeNum.includes(term) || personName.includes(term);
        });
    }, [searchTerm, records]);

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        if (row.concepto) return row.concepto.toUpperCase();
        if (row.causa) return row.causa.toUpperCase();
        const c = concepts.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'REPOSICIÓN TÉCNICA';
    };

    const confirmDelete = async () => {
        try {
            const result = await deleteDecreeReplacement(deleteConfig.id, user.parishId);
            if (result.success) {
                toast({ title: "Decreto Eliminado", description: "Se ha removido el historial de la Nube." });
                loadData();
            }
        } catch (error) {
            toast({ title: "Error", description: "No se pudo procesar la solicitud.", variant: "destructive" });
        } finally {
            setDeleteConfig({ isOpen: false, id: null, name: '' });
        }
    };

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                        <History className="w-4 h-4" />
                    </div>
                    <span className="font-mono font-black text-gray-900 tracking-tighter">
                        {row.decreeNumber || row.numeroDecreto || 'SN-000'}
                    </span>
                </div>
            )
        },
        { 
            header: 'Bautizado(a)', 
            render: (row) => (
                <span className="font-bold text-gray-800 text-xs uppercase tracking-tight">
                    {resolvePersonName(row.newPartidaId, row.newPartidaSummary, row.targetName)}
                </span>
            )
        },
        { 
            header: 'Ubicación Supletoria', 
            render: (row) => {
                const sum = row.newPartidaSummary || row.datosNuevaPartida || {};
                const L = sum.book || sum.book_number || sum.libro || '-';
                const F = sum.page || sum.page_number || sum.folio || '-';
                const N = sum.entry || sum.entry_number || sum.numero || '-';
                return (
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 w-fit">
                        L:{L} F:{F} N:{N}
                    </div>
                );
            } 
        },
        { 
            header: 'Causa', 
            render: (row) => (
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight block max-w-[150px] truncate">
                    {getConceptName(row)}
                </span>
            )
        },
        { 
            header: 'Estado', 
            render: (row) => (
                <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-green-200 w-fit">
                    <ShieldCheck className="w-3 h-3" /> {row.estado || row.status || 'Activo'}
                </div>
            )
        },
        {
            header: 'Acciones',
            className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#D4AF37] hover:bg-yellow-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#4B7BA7] hover:bg-blue-50 rounded-xl" onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${row.id}`)}>
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber || row.numeroDecreto })}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decretos de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Gestión de Partidas Supletorias por Pérdida o Deterioro</p>
                    </div>
                </div>
                <Button 
                    onClick={() => navigate('/parroquia/decretos/nuevo-reposicion')} 
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl hover:shadow-yellow-500/20 text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                    <PlusCircle className="w-4 h-4 mr-2" /> Nueva Reposición
                </Button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden min-h-[600px]">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                    <div className="p-8 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <TabsList className="bg-gray-200/50 p-1 rounded-2xl h-12">
                            <TabsTrigger value="bautismo" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#4B7BA7] data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        </TabsList>
                        
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4B7BA7] w-5 h-5 transition-colors" />
                            <Input 
                                placeholder="Buscar por decreto o nombre..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-12 py-7 text-sm rounded-2xl border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1">
                        {isLoading ? (
                            <div className="py-32 text-center">
                                <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Sincronizando Archivo...</p>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="py-32 text-center">
                                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <FileX2 className="w-10 h-10 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-black text-gray-400 uppercase tracking-widest">Sin Decretos</h3>
                                <p className="text-gray-400 text-sm mt-1">No se encontraron reposiciones con los criterios ingresados.</p>
                                {searchTerm && (
                                    <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4 text-blue-600 font-bold">
                                        Limpiar filtros
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <TabsContent value="bautismo" className="m-0 focus:outline-none">
                                <div className="overflow-x-auto">
                                    <Table columns={columns} data={filteredRecords} className="border-none" />
                                    <div className="p-6 bg-gray-50/30 border-t border-gray-50 text-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            Mostrando {filteredRecords.length} decretos de reposición archivados
                                        </span>
                                    </div>
                                </div>
                            </TabsContent>
                        )}
                    </div>
                </Tabs>
            </div>

            {/* MODALES AUXILIARES */}
            {viewModalOpen && (
                <ViewRepositionDecreeModal 
                    isOpen={viewModalOpen}
                    onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }}
                    decreeData={selectedDecree}
                />
            )}

            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen}
                title="¿Eliminar Registro de Reposición?"
                message={`Estás a punto de borrar el historial del decreto ${deleteConfig.name}. Esta acción no borrará automáticamente la partida supletoria generada, solo elimina el documento del decreto.`}
                onConfirm={confirmDelete}
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })}
                variant="destructive"
                confirmText="Sí, Eliminar de la Nube"
            />
        </DashboardLayout>
    );
};

export default BaptismRepositionListPage;