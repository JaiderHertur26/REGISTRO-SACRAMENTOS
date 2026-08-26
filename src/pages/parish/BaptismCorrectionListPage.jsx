import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Plus, Search, Eye, Edit, Trash2, FileText, ShieldAlert, BookOpen, ArrowRight, Loader2, Cloud, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';
import { calculatePreviousConsecutive } from '@/services/sacramentParametersService';

// Librería y Plantilla para Impresión Directa
import { useReactToPrint } from 'react-to-print';
import BaptismCorrectionPrintTemplate from '@/components/BaptismCorrectionPrintTemplate'; 

const BaptismCorrectionListPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, getParrocos } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [corrections, setCorrections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    // 🚀 LÓGICA DE IMPRESIÓN DIRECTA 1-CLIC
    const printRef = useRef(null);
    
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: 'Decreto_Correccion_Bautismo'
    });

    const onPrintClick = (row) => {
        setSelectedDecree(row);
        setTimeout(() => handlePrint(), 300);
    };

    const misDatosList = user?.parishId ? getMisDatosList(user.parishId) : [];
    const parrocos = user?.parishId ? getParrocos(user.parishId) : [];
    const parrocoActivo = parrocos?.find(p => String(p.estado || p.Estado) === '1');
    const parrocoNombre = parrocoActivo ? `${parrocoActivo.nombre} ${parrocoActivo.apellido || ''}`.trim() : '';
    const parroquiaInfo = misDatosList?.[0] || {};
    
    const printData = selectedDecree ? {
        ...selectedDecree,
        parroquiaInfo,
        parroquiaNombre: parroquiaInfo.nombre || user?.parishName,
        ciudad: parroquiaInfo.ciudad || user?.city,
        parrocoNombre
    } : {};

    useEffect(() => { if (user?.parishId) loadParishCorrectionsFromCloud(); }, [user]);

    const loadParishCorrectionsFromCloud = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('decretos').select('*').eq('tipo', 'correccion')
                .eq('parish_id', user.parishId).order('created_at', { ascending: false });

            if (error) throw error;
            
            // 🚀 FILTRO APLICADO: Solo los que tengan abuelos (Bautizos)
            const formattedData = data.map(item => ({
                id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                ...(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)
            })).filter(item => item.abuelosPaternos !== undefined || item.sacramento === 'bautismo');
            
            setCorrections(formattedData);
        } catch (error) { toast({ title: "Error", description: "No se descargaron los decretos.", variant: "destructive" }); } 
        finally { setLoading(false); }
    };

    // 🚀 LÓGICA DE RESTAURACIÓN COMPLETA (ROLLBACK TOTAL)
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const decreeToUndo = corrections.find(c => c.id === deleteConfig.id);
            if (!decreeToUndo) throw new Error("Decreto no encontrado");

            const pad = (num) => num ? String(num).padStart(4, '0') : '0000';
            const origSum = decreeToUndo.originalPartidaSummary;
            const newSum = decreeToUndo.newPartidaSummary;

            // 1. Restaurar la Partida Original
            if (origSum) {
                const origBook = pad(origSum.book || origSum.Libro);
                const origPage = pad(origSum.page || origSum.folio);
                const origEntry = pad(origSum.entry || origSum.numero);

                const { data: origData } = await supabase.from('baptisms')
                    .select('id, raw_data').eq('parish_id', user.parishId)
                    .eq('book_number', origBook).eq('folio', origPage).eq('number', origEntry).maybeSingle();

                if (origData) {
                    const cleanedRaw = { ...origData.raw_data };
                    delete cleanedRaw.notaMarginal; 
                    cleanedRaw.anulado = false;
                    cleanedRaw.status = 'seated';
                    
                    await supabase.from('baptisms').update({ 
                        status: 'seated', nota_marginal: null, raw_data: cleanedRaw 
                    }).eq('id', origData.id);
                }
            }

            // 2. Eliminar la Partida Supletoria y Revertir el Parámetro
            if (newSum) {
                const newBook = pad(newSum.book || newSum.Libro);
                const newPage = pad(newSum.page || newSum.folio);
                const newEntry = pad(newSum.entry || newSum.numero);

                await supabase.from('baptisms').delete()
                    .eq('parish_id', user.parishId).eq('book_number', newBook).eq('folio', newPage).eq('number', newEntry);

                // --- REVERSA MATEMÁTICA PERFECTA ---
                try {
                    const { data: pData } = await supabase.from('parish_parameters')
                        .select('bautizos_params').eq('parish_id', user.parishId).maybeSingle();

                    if (pData && pData.bautizos_params) {
                        const cloudParams = pData.bautizos_params;
                        
                        const previosSupletorios = calculatePreviousConsecutive(
                            cloudParams.suplementarioNumero,
                            cloudParams.suplementarioFolio,
                            cloudParams.suplementarioLibro,
                            cloudParams.suplementarioPartidas || 2,
                            cloudParams.suplementarioReiniciar || false
                        );

                        if (parseInt(newEntry, 10) === parseInt(previosSupletorios.numero, 10)) {
                            const newParamsObj = { 
                                ...cloudParams, 
                                suplementarioNumero: previosSupletorios.numero,
                                suplementarioFolio: previosSupletorios.folio,
                                suplementarioLibro: previosSupletorios.libro
                            };
                            
                            await supabase.from('parish_parameters').update({ bautizos_params: newParamsObj }).eq('parish_id', user.parishId);
                        }
                    }
                } catch (err) { console.error("Error revirtiendo consecutivos:", err); }
            }

            // 3. Eliminar el Decreto
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);

            toast({ title: "Restauración Completada", description: "Decreto borrado, partida restaurada y consecutivos actualizados.", className: "bg-green-50 text-green-900 border-green-200" });
            loadParishCorrectionsFromCloud();
        } catch (error) { 
            console.error("Error al restaurar:", error);
            toast({ title: "Error", description: "No se pudo restaurar la partida.", variant: "destructive" }); 
        } finally { 
            setIsDeleting(false); setDeleteConfig({ isOpen: false, id: null, name: '' }); 
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

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    const filteredCorrections = corrections.filter(item => {
        const term = searchTerm.toLowerCase();
        return (item.decreeNumber || '').toLowerCase().includes(term) || resolveName(item.originalPartidaSummary, item.targetName).toLowerCase().includes(term);
    });

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText className="w-4 h-4" /></div>
                    <span className="font-black text-gray-900 font-mono tracking-tighter">{row.decreeNumber || 'SIN-NÚMERO'}</span>
                </div>
            )
        },
        { 
            header: 'Partida Anulada', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-red-600 text-xs uppercase">{resolveName(row.originalPartidaSummary, row.targetName)}</span>
                    <span className="text-[10px] text-gray-400 font-mono">L:{pad(row.originalPartidaSummary?.book || row.originalPartidaSummary?.Libro)} F:{pad(row.originalPartidaSummary?.page || row.originalPartidaSummary?.folio)} N:{pad(row.originalPartidaSummary?.entry || row.originalPartidaSummary?.numero)}</span>
                </div>
            )
        },
        { header: '', render: () => <ArrowRight className="w-4 h-4 text-gray-300" />, className: "w-4 px-0" },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-green-600 text-xs uppercase">{resolveName(row.newPartidaSummary, row.newTargetName)}</span>
                    <span className="text-[10px] text-gray-400 font-mono font-bold">L:{pad(row.newPartidaSummary?.book || row.newPartidaSummary?.Libro)} F:{pad(row.newPartidaSummary?.page || row.newPartidaSummary?.folio)} N:{pad(row.newPartidaSummary?.entry || row.newPartidaSummary?.numero)}</span>
                </div>
            )
        },
        { header: 'Fecha', render: (row) => <span className="text-xs font-medium text-gray-500">{row.decreeDate}</span> },
        {
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    
                    {/* 🚀 Botón: IMPRIMIR DIRECTO */}
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600 hover:bg-purple-50 rounded-xl" onClick={() => onPrintClick(row)}><Printer className="w-4 h-4" /></Button>
                    
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 hover:bg-amber-50 rounded-xl" onClick={() => navigate(`/parroquia/decretos/editar-correccion?id=${row.id}`)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber })}><Trash2 className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 relative"><ShieldAlert className="w-7 h-7" /><div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5"><Cloud className="w-3 h-3 text-white" /></div></div>
                    <div><h1 className="text-3xl font-black text-gray-900 font-serif">Archivo de Decretos</h1><p className="text-gray-500 text-sm font-medium uppercase text-[10px] tracking-widest">Correcciones de Bautismo</p></div>
                </div>
                <Button className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-6 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 active:scale-95 transition-all" onClick={() => navigate('/parroquia/decretos/nuevo-correccion')}><Plus className="w-4 h-4 mr-2" /> Nuevo Decreto</Button>
            </div>

            {/* 🚀 AÑADIDO: PESTAÑAS TIPO CAPARAZÓN PARA NAVEGAR ENTRE SACRAMENTOS */}
            <Tabs defaultValue="bautizos" className="w-full mb-8">
                <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-2xl h-14">
                    <TabsTrigger value="bautizos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#4B7BA7] data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmaciones" onClick={() => navigate('/parroquia/decretos/ver-correcciones-confirmacion')} className="rounded-xl font-bold uppercase text-[10px] tracking-widest cursor-pointer text-gray-500 hover:bg-gray-200/50 transition-all">Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonios" disabled className="opacity-30 rounded-xl font-bold uppercase text-[10px] tracking-widest">Matrimonios</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 bg-gray-50/50 border-b border-gray-100">
                    <div className="relative max-w-md group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" /><Input placeholder="Buscar por acta, decreto o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 py-7 text-sm rounded-2xl border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                </div>

                {loading ? (
                    <div className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" /><p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Descargando...</p></div>
                ) : filteredCorrections.length > 0 ? (
                    <Table columns={columns} data={filteredCorrections} className="border-none" />
                ) : (
                    <div className="py-32 text-center"><BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-6" /><h3 className="text-lg font-black text-gray-400 uppercase">Sin Coincidencias</h3></div>
                )}
            </div>

            {viewModalOpen && <ViewCorrectionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} sacrament="bautismo" />}
            
            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen} 
                title="Restaurar Partida y Eliminar Decreto" 
                message="Al confirmar, el decreto será eliminado de la Nube. La partida supletoria será destruida y la partida original recuperará su validez legal (se borrará la nota marginal de anulación)." 
                onConfirm={confirmDelete} 
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })} 
                variant="destructive"
                confirmText={isDeleting ? "Restaurando..." : "Confirmar Restauración"}
            />

            {/* ========================================================= */}
            {/* 🖨️ CONTENEDORES OCULTOS PARA IMPRESIÓN (BAUTISMO) */}
            {/* ========================================================= */}
            <div style={{ display: 'none' }}>
                <BaptismCorrectionPrintTemplate ref={printRef} data={printData} />
            </div>

        </DashboardLayout>
    );
};

export default BaptismCorrectionListPage;