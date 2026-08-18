import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Plus, Search, Eye, Edit, Trash2, FileText, ShieldAlert, BookOpen, ArrowRight, Loader2, CheckCircle2, Cloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient'; 

const BaptismCorrectionListPage = () => {
    const { user } = useAuth();
    const [corrections, setCorrections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { toast } = useToast();

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    useEffect(() => {
        if (user?.parishId) loadCloudCorrections();
    }, [user]);

    // 🚀 LECTURA DIRECTA DE SUPABASE
    const loadCloudCorrections = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('decretos')
                .select('*')
                .eq('tipo', 'correccion')
                .eq('parish_id', user.parishId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedData = data.map(item => ({
                id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                ...(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)
            }));

            setCorrections(formattedData);
        } catch (error) {
            toast({ title: "Error", description: "Fallo al conectar con la Nube.", variant: "destructive" });
        } finally { setLoading(false); }
    };

    // 🚀 BORRADO DIRECTO EN SUPABASE
    const confirmDelete = async () => {
        try {
            await supabase.from('decretos').delete().eq('id', deleteConfig.id);
            toast({ title: "Eliminado", description: "Decreto borrado de la Nube.", className: "bg-green-50 text-green-900 border-green-200" });
            loadCloudCorrections();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo borrar.", variant: "destructive" });
        } finally { setDeleteConfig({ isOpen: false, id: null, name: '' }); }
    };

    const resolveName = (summary, fallback) => summary ? `${summary.lastName || summary.apellidos || ''}, ${summary.firstName || summary.nombres || ''}`.toUpperCase() : (fallback || '---').toUpperCase();

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
                    <div className="flex flex-col">
                        <span className="font-black text-gray-900 font-mono">{row.decreeNumber || 'SIN-NÚMERO'}</span>
                    </div>
                </div>
            )
        },
        { 
            header: 'Partida Anulada', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-red-600 text-xs uppercase">{resolveName(row.originalPartidaSummary, row.targetName)}</span>
                    <span className="text-[10px] text-gray-400 font-mono">L:{row.originalPartidaSummary?.book || row.originalPartidaSummary?.Libro || '-'} F:{row.originalPartidaSummary?.page || row.originalPartidaSummary?.folio || '-'} N:{row.originalPartidaSummary?.entry || row.originalPartidaSummary?.numero || '-'}</span>
                </div>
            )
        },
        { header: '', render: () => <ArrowRight className="w-4 h-4 text-gray-300" />, className: "w-4 px-0" },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-green-600 text-xs uppercase">{resolveName(row.newPartidaSummary, row.targetName)}</span>
                    <span className="text-[10px] text-gray-400 font-mono font-bold">L:{row.newPartidaSummary?.book || row.newPartidaSummary?.Libro || '-'} F:{row.newPartidaSummary?.page || row.newPartidaSummary?.folio || '-'} N:{row.newPartidaSummary?.entry || row.newPartidaSummary?.numero || '-'}</span>
                </div>
            )
        },
        { header: 'Fecha', render: (row) => <span className="text-xs text-gray-500">{row.decreeDate}</span> },
        {
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber })}><Trash2 className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 relative">
                        <ShieldAlert className="w-7 h-7" />
                        <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 shadow-sm border-2 border-white"><Cloud className="w-3 h-3 text-white" /></div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif">Archivo de Decretos</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase text-[10px] tracking-widest">Correcciones Sincronizadas (Nube)</p>
                    </div>
                </div>
                <Button className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-6 rounded-2xl font-black uppercase text-xs" onClick={() => navigate('/parroquia/decretos/nuevo-correccion')}>
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Decreto
                </Button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 bg-gray-50/50 border-b border-gray-100">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 py-7 rounded-2xl bg-white shadow-sm" />
                    </div>
                </div>

                {loading ? (
                    <div className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" /><p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Conectando a la Nube...</p></div>
                ) : filteredCorrections.length > 0 ? (
                    <Table columns={columns} data={filteredCorrections} className="border-none" />
                ) : (
                    <div className="py-32 text-center">
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><BookOpen className="w-10 h-10 text-gray-300" /></div>
                        <h3 className="text-lg font-black text-gray-400 uppercase">Sin Coincidencias</h3>
                        <p className="text-gray-400 text-sm mt-1">No se encontraron decretos en la Nube.</p>
                    </div>
                )}
            </div>

            {viewModalOpen && <ViewCorrectionDecreeModal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} decreeData={selectedDecree} />}
            <ConfirmationDialog isOpen={deleteConfig.isOpen} title="¿Eliminar Decreto de la Nube?" message="Se borrará el historial de forma permanente." onConfirm={confirmDelete} onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })} variant="destructive" />
        </DashboardLayout>
    );
};

export default BaptismCorrectionListPage;