import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Plus, Search, Eye, Edit, Trash2, FileText, ShieldAlert, BookOpen, Loader2, Cloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService';

const BaptismRepositionListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    // --- CARGA DE DATOS DE LA NUBE ---
    useEffect(() => { 
        if (user?.parishId) loadParishReplacementsFromCloud(); 
    }, [user]);

    const loadParishReplacementsFromCloud = async () => {
        setLoading(true);
        try {
            // 1. Cargar Conceptos para mapear la causa
            let targetDioceseId = user.dioceseId || user.diocese_id;
            if (!targetDioceseId) {
                const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                if (pData) targetDioceseId = pData.diocese_id;
            }

            if (targetDioceseId) {
                const { data: cData } = await supabase.from('conceptos_anulacion').select('*').eq('diocese_id', targetDioceseId);
                if (cData) setConcepts(cData);
            }

            // 2. Cargar Decretos de Reposición
            const { data, error } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion')
                .eq('parish_id', user.parishId).order('created_at', { ascending: false });

            if (error) throw error;
            const formattedData = data.map(item => ({
                id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                ...(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)
            }));
            setRecords(formattedData);

        } catch (error) { 
            toast({ title: "Error", description: "No se descargaron los decretos.", variant: "destructive" }); 
        } finally { 
            setLoading(false); 
        }
    };

    // 🚀 LÓGICA DE RESTAURACIÓN COMPLETA (ROLLBACK TOTAL PARA REPOSICIONES)
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const decreeToUndo = records.find(c => c.id === deleteConfig.id);
            if (!decreeToUndo) throw new Error("Decreto no encontrado");

            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const newSum = decreeToUndo.newPartidaSummary || decreeToUndo.datosNuevaPartida;

            // 1. Eliminar la Partida Supletoria y Revertir el Parámetro
            if (newSum) {
                const newBook = pad(newSum.book || newSum.book_number || newSum.Libro);
                const newPage = pad(newSum.page || newSum.page_number || newSum.folio);
                const newEntry = pad(newSum.entry || newSum.entry_number || newSum.numero);

                await supabase.from('baptisms').delete()
                    .eq('parish_id', user.parishId)
                    .eq('book_number', newBook)
                    .eq('folio', newPage)
                    .eq('number', newEntry);

                // MAGIA DEL REVERSO DEL LIBRO SUPLETORIO CON EL MOTOR MATEMÁTICO Y SALVAVIDAS
                const { data: pData } = await supabase
                    .from('parish_parameters')
                    .select('bautizos_params')
                    .eq('parish_id', user.parishId)
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

                    const newParamsObj = { 
                        ...currentParams, 
                        suplementarioNumero: previosSupletorios.numero,
                        suplementarioFolio: previosSupletorios.folio,
                        suplementarioLibro: previosSupletorios.libro
                    };
                    
                    await supabase
                        .from('parish_parameters')
                        .update({ bautizos_params: newParamsObj })
                        .eq('parish_id', user.parishId);
                }
            }

            // 2. Eliminar el Decreto
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);

            toast({ 
                title: "Restauración Completada", 
                description: "Decreto borrado, partida eliminada y consecutivos actualizados.", 
                className: "bg-green-50 text-green-900 border-green-200" 
            });
            loadParishReplacementsFromCloud();
        } catch (error) { 
            console.error("Error al restaurar:", error);
            toast({ title: "Error", description: "No se pudo restaurar la partida.", variant: "destructive" }); 
        } finally { 
            setIsDeleting(false);
            setDeleteConfig({ isOpen: false, id: null, name: '' }); 
        }
    };

    const resolveName = (summary, fallbackName) => {
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${fName} ${lName}`.trim().toUpperCase();
        }
        return (fallbackName || '---').toUpperCase();
    };

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        if (row.causa) return row.causa.toUpperCase();
        const c = concepts.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'REPOSICIÓN DE PARTIDA';
    };

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    const filteredRecords = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return records.filter(item => {
            const decreeNum = (item.decreeNumber || item.numeroDecreto || '').toLowerCase();
            const personName = resolveName(item.newPartidaSummary, item.targetName || item.nombres).toLowerCase();
            return decreeNum.includes(term) || personName.includes(term);
        });
    }, [searchTerm, records]);

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText className="w-4 h-4" /></div>
                    <span className="font-black text-gray-900 font-mono tracking-tighter">{row.decreeNumber || row.numeroDecreto || 'SIN-NÚMERO'}</span>
                </div>
            )
        },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => {
                const sum = row.newPartidaSummary || row.datosNuevaPartida || {};
                return (
                    <div className="flex flex-col">
                        <span className="font-bold text-green-600 text-xs uppercase">{resolveName(sum, row.targetName || row.nombres)}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-bold">L:{pad(sum.book || sum.book_number || sum.Libro)} F:{pad(sum.page || sum.page_number || sum.folio)} N:{pad(sum.entry || sum.entry_number || sum.numero)}</span>
                    </div>
                );
            }
        },
        { 
            header: 'Causa / Concepto', 
            render: (row) => (
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight block max-w-[180px] truncate">{getConceptName(row)}</span>
            )
        },
        { header: 'Fecha', render: (row) => <span className="text-xs font-medium text-gray-500">{row.decreeDate || row.fechaDecreto}</span> },
        {
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 hover:bg-amber-50 rounded-xl" onClick={() => navigate(`/parroquia/decretos/editar-reposicion?id=${row.id}`)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber || row.numeroDecreto })}><Trash2 className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    {/* Usamos tono Azul para distinguir sutilmente de las Correcciones (Ámbar) pero con el mismo diseño */}
                    <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 relative">
                        <ShieldAlert className="w-7 h-7" />
                        <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5">
                            <Cloud className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif">Archivo de Reposiciones</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase text-[10px] tracking-widest">Partidas Supletorias Sincronizadas (Nube)</p>
                    </div>
                </div>
                <Button className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-6 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 active:scale-95 transition-all" onClick={() => navigate('/parroquia/decretos/nuevo-reposicion')}>
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Decreto
                </Button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 bg-gray-50/50 border-b border-gray-100">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                        <Input placeholder="Buscar por decreto o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 py-7 text-sm rounded-2xl border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all" />
                    </div>
                </div>

                {loading ? (
                    <div className="py-24 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Descargando...</p>
                    </div>
                ) : filteredRecords.length > 0 ? (
                    <Table columns={columns} data={filteredRecords} className="border-none" />
                ) : (
                    <div className="py-32 text-center">
                        <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-6" />
                        <h3 className="text-lg font-black text-gray-400 uppercase">Sin Coincidencias</h3>
                    </div>
                )}
            </div>

            {viewModalOpen && <ViewRepositionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} />}
            
            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen} 
                title="Restaurar Consecutivos y Eliminar" 
                message="Al confirmar, el decreto será eliminado de la Nube. La partida supletoria generada será destruida y el consecutivo regresará a su estado anterior." 
                onConfirm={confirmDelete} 
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })} 
                variant="destructive"
                confirmText={isDeleting ? "Borrando..." : "Confirmar Eliminación"}
            />
        </DashboardLayout>
    );
};

export default BaptismRepositionListPage;