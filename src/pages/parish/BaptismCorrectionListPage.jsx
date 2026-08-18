import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { 
    Plus, Search, Eye, Edit, Trash2, 
    FileText, ShieldAlert, BookOpen, 
    ArrowRight, Loader2, Cloud 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';

const BaptismCorrectionListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [corrections, setCorrections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    // Modal States
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, name: '' });

    // 🚀 AL CARGAR, TRAEMOS LOS DECRETOS DE LA NUBE PARA ESTA PARROQUIA
    useEffect(() => {
        if (user?.parishId) {
            loadParishCorrectionsFromCloud();
        }
    }, [user]);

    // 🚀 CONSULTA DIRECTA A SUPABASE
    const loadParishCorrectionsFromCloud = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('decretos')
                .select('*')
                .eq('tipo', 'correccion')
                .eq('parish_id', user.parishId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Desempaquetamos el payload para que la tabla lo pueda leer fácil
            const formattedData = data.map(item => {
                let payloadObj = {};
                if (item.payload) {
                    payloadObj = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
                }
                return {
                    id: item.id,
                    parish_id: item.parish_id,
                    created_at: item.created_at,
                    ...payloadObj
                };
            });

            setCorrections(formattedData);
        } catch (error) {
            console.error("Error al cargar decretos de la nube:", error);
            toast({ 
                title: "Error de Conexión", 
                description: "No se pudieron descargar los decretos.", 
                variant: "destructive" 
            });
        } finally {
            setLoading(false);
        }
    };

    // 🚀 BORRADO DIRECTO EN SUPABASE
    const confirmDelete = async () => {
        try {
            const { error } = await supabase
                .from('decretos')
                .delete()
                .eq('id', deleteConfig.id);

            if (error) throw error;

            toast({ 
                title: "Decreto Eliminado", 
                description: "El historial en la nube ha sido actualizado.",
                className: "bg-green-50 text-green-900 border-green-200" 
            });
            loadParishCorrectionsFromCloud(); // Recargamos la lista fresca
        } catch (error) {
            toast({ 
                title: "Error", 
                description: "No se pudo eliminar el registro de la nube.", 
                variant: "destructive" 
            });
        } finally {
            setDeleteConfig({ isOpen: false, id: null, name: '' });
        }
    };

    // 🧠 RESOLUTOR DE IDENTIDAD (Lee de la cápsula del decreto)
    const resolveName = (summary, fallbackName) => {
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${lName}, ${fName}`.toUpperCase();
        }
        return (fallbackName || '---').toUpperCase();
    };

    const filteredCorrections = corrections.filter(item => {
        const term = searchTerm.toLowerCase();
        const decreeNum = (item.decreeNumber || '').toLowerCase();
        const personName = resolveName(item.originalPartidaSummary, item.targetName).toLowerCase();
        
        return decreeNum.includes(term) || personName.includes(term);
    });

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-gray-900 font-mono tracking-tighter">
                            {row.decreeNumber || 'SIN-NÚMERO'}
                        </span>
                        {/* Indicador visual si el decreto lo hizo la Cancillería */}
                        {row.targetParishId && (
                            <span className="text-[8px] text-purple-600 font-bold uppercase tracking-widest mt-0.5">
                                Emisión Cancillería
                            </span>
                        )}
                    </div>
                </div>
            )
        },
        { 
            header: 'Partida Anulada', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-red-600 text-xs uppercase tracking-tight">
                        {resolveName(row.originalPartidaSummary, row.targetName)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                        L:{row.originalPartidaSummary?.book || row.originalPartidaSummary?.Libro || '-'} F:{row.originalPartidaSummary?.page || row.originalPartidaSummary?.folio || '-'} N:{row.originalPartidaSummary?.entry || row.originalPartidaSummary?.numero || '-'}
                    </span>
                </div>
            )
        },
        {
            header: '',
            render: () => <ArrowRight className="w-4 h-4 text-gray-300" />,
            className: "w-4 px-0"
        },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-green-600 text-xs uppercase tracking-tight">
                        {resolveName(row.newPartidaSummary, row.targetName)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono font-bold">
                        L:{row.newPartidaSummary?.book || row.newPartidaSummary?.Libro || '-'} F:{row.newPartidaSummary?.page || row.newPartidaSummary?.folio || '-'} N:{row.newPartidaSummary?.entry || row.newPartidaSummary?.numero || '-'}
                    </span>
                </div>
            )
        },
        { 
            header: 'Fecha', 
            render: (row) => <span className="text-xs font-medium text-gray-500">{row.decreeDate}</span> 
        },
        {
            header: 'Acciones',
            className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 hover:bg-amber-50 rounded-xl" onClick={() => navigate(`/parroquia/decretos/editar-correccion?id=${row.id}`)}>
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => setDeleteConfig({ isOpen: true, id: row.id, name: row.decreeNumber })}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-sm relative">
                        <ShieldAlert className="w-7 h-7" />
                        <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 shadow-sm border-2 border-white">
                            <Cloud className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Archivo de Decretos</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Correcciones de Bautismo Sincronizadas</p>
                    </div>
                </div>
                <Button 
                    className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/20 transition-all active:scale-95"
                    onClick={() => navigate('/parroquia/decretos/nuevo-correccion')}
                >
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Decreto
                </Button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                {/* Barra de Filtros */}
                <div className="p-8 bg-gray-50/50 border-b border-gray-100">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                        <Input 
                            placeholder="Buscar por acta, decreto o nombre..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 py-7 text-sm rounded-2xl border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>
                </div>

                {/* Tabla de Resultados */}
                {loading ? (
                    <div className="py-24 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Descargando Archivo de la Nube...</p>
                    </div>
                ) : filteredCorrections.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table columns={columns} data={filteredCorrections} className="border-none" />
                        <div className="p-6 bg-gray-50/30 border-t border-gray-50 text-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Mostrando {filteredCorrections.length} decretos de esta parroquia
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="py-32 text-center">
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BookOpen className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-black text-gray-400 uppercase tracking-widest">Sin Coincidencias</h3>
                        <p className="text-gray-400 text-sm mt-1">No se encontraron decretos guardados en la nube para esta parroquia.</p>
                        {searchTerm && (
                            <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4 text-blue-600 font-bold">
                                Limpiar búsqueda
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Modales Auxiliares */}
            <ViewCorrectionDecreeModal 
                isOpen={viewModalOpen}
                onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }}
                decreeData={selectedDecree}
            />

            <ConfirmationDialog 
                isOpen={deleteConfig.isOpen}
                title="¿Eliminar Decreto?"
                message={`Estás a punto de borrar permanentemente el decreto ${deleteConfig.name} de la base de datos central. Esta acción no restaurará la partida original ni borrará la nueva, solo elimina el historial del decreto.`}
                onConfirm={confirmDelete}
                onClose={() => setDeleteConfig({ isOpen: false, id: null, name: '' })}
                variant="destructive"
                confirmText="Sí, Eliminar de la Nube"
            />
        </DashboardLayout>
    );
};

export default BaptismCorrectionListPage;