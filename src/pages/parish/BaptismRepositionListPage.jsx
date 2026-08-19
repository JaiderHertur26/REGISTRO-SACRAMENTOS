import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { PlusCircle, Search, Eye, Edit, Trash2, ShieldCheck, BookOpen, History, Loader2, FileX2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';

const BaptismRepositionListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    // --- CARGA DE DATOS DE LA NUBE ---
    useEffect(() => {
        const loadData = async () => {
            if (!user?.parishId) return;
            setIsLoading(true);
            try {
                // Conceptos
                let targetDioceseId = user.dioceseId || user.diocese_id;
                if (!targetDioceseId) {
                    const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                    if (pData) targetDioceseId = pData.diocese_id;
                }

                if (targetDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('*').eq('diocese_id', targetDioceseId);
                    if (cData) setConcepts(cData);
                }

                // Decretos
                const { data, error } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion')
                    .eq('parish_id', user.parishId).order('created_at', { ascending: false });

                if (error) throw error;
                const formattedData = data.map(item => ({
                    id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                    ...(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)
                }));
                setRecords(formattedData);

            } catch (error) {
                toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user, activeTab, toast]);

    const resolvePersonName = (summary, fallback) => {
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${fName} ${lName}`.trim().toUpperCase();
        }
        return (fallback || '---').toUpperCase();
    };

    const filteredRecords = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return records.filter(r => {
            const decreeNum = (r.decreeNumber || r.numeroDecreto || '').toLowerCase();
            const personName = resolvePersonName(r.newPartidaSummary, r.targetName).toLowerCase();
            return decreeNum.includes(term) || personName.includes(term);
        });
    }, [searchTerm, records]);

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        if (row.causa) return row.causa.toUpperCase();
        const c = concepts.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'REPOSICIÓN TÉCNICA';
    };

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    // 🚀 RESTAURACIÓN COMPLETA (ROLLBACK DE REPOSICIÓN)
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const decreeToUndo = records.find(c => c.id === deleteConfig.id);
            if (!decreeToUndo) throw new Error("Decreto no encontrado");

            const newSum = decreeToUndo.newPartidaSummary;

            // 1. Eliminar la Partida Supletoria y Revertir el Parámetro
            if (newSum) {
                const newBook = pad(newSum.book || newSum.Libro);
                const newPage = pad(newSum.page || newSum.folio);
                const newEntry = pad(newSum.entry || newSum.numero);

                await supabase.from('baptisms').delete()
                    .eq('parish_id', user.parishId)
                    .eq('book_number', newBook)
                    .eq('folio', newPage)
                    .eq('number', newEntry);

                // REVERSO DEL LIBRO SUPLETORIO
                const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', user.parishId).maybeSingle();

                if (pData && pData.bautizos_params) {
                    const currentParams = pData.bautizos_params;
                    const currentSupNum = Number(currentParams.suplementarioNumero);
                    const deletedEntryNum = Number(newEntry);

                    if (deletedEntryNum === currentSupNum - 1) {
                        const newParamsObj = { ...currentParams, suplementarioNumero: currentSupNum - 1 };
                        await supabase.from('parish_parameters').update({ bautizos_params: newParamsObj }).eq('parish_id', user.parishId);
                    }
                }
            }

            // 2. Eliminar el Decreto
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);

            toast({ title: "Decreto Eliminado", description: "El decreto y la partida han sido borrados. Consecutivo restaurado.", className: "bg-green-50 text-green-900 border-green-200" });
            setRecords(prev => prev.filter(r => r.id !== deleteConfig.id));
        } catch (error) {
            toast({ title: "Error", description: "No se pudo procesar la solicitud.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteConfig({ isOpen: false, id: null, name: '' });
        }
    };

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><History className="w-4 h-4" /></div>
                    <span className="font-mono font-black text-gray-900 tracking-tighter">{row.decreeNumber || row.numeroDecreto || 'SN-000'}</span>
                </div>
            )
        },
        { 
            header: 'Bautizado(a)', 
            render: (row) => <span className="font-bold text-gray-800 text-xs uppercase tracking-tight">{resolvePersonName(row.newPartidaSummary, row.targetName)}</span>
        },
        { 
            header: 'Ubicación Supletoria', 
            render: (row) => {
                const sum = row.newPartidaSummary || row.datosNuevaPartida || {};
                return (
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 w-fit">
                        L:{pad(sum.book || sum.book_number || sum.libro)} F:{pad(sum.page || sum.page_number || sum.folio)} N:{pad(sum.entry || sum.entry_number || sum.numero)}
                    </div>
                );
            } 
        },
        { 
            header: 'Causa', 
            render: (row) => <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight block max-w-[150px] truncate">{getConceptName(row)}</span>
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
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#D4AF37] hover:bg-yellow-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#4B7BA7] hover:bg-blue-50 rounded-xl" onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${row.id}`)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber || row.numeroDecreto })}><Trash2 className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20"><BookOpen className="w-7 h-7" /></div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decretos de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Gestión de Partidas Supletorias en la Nube</p>
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
                            <div className="py-32 text-center"><Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto mb-4" /><p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Sincronizando Archivo...</p></div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="py-32 text-center"><div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><FileX2 className="w-10 h-10 text-gray-300" /></div><h3 className="text-lg font-black text-gray-400 uppercase tracking-widest">Sin Decretos</h3><p className="text-gray-400 text-sm mt-1">No se encontraron reposiciones con los criterios ingresados.</p></div>
                        ) : (
                            <TabsContent value="bautismo" className="m-0 focus:outline-none">
                                <div className="overflow-x-auto">
                                    <Table columns={columns} data={filteredRecords} className="border-none" />
                                    <div className="p-6 bg-gray-50/30 border-t border-gray-50 text-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mostrando {filteredRecords.length} decretos de reposición archivados</span></div>
                                </div>
                            </TabsContent>
                        )}
                    </div>
                </Tabs>
            </div>

            {viewModalOpen && <ViewRepositionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} />}

            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen}
                title="Restaurar y Eliminar Reposición"
                message={`Estás a punto de borrar el decreto ${deleteConfig.name} de la Nube. La partida supletoria generada será destruida y el consecutivo regresará a su estado anterior.`}
                onConfirm={confirmDelete}
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })}
                variant="destructive"
                confirmText={isDeleting ? "Borrando..." : "Sí, Eliminar de la Nube"}
            />
        </DashboardLayout>
    );
};

export default BaptismRepositionListPage;