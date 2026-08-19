import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';

const DecreeCorrectionListPage = () => {
    const { user } = useAuth();
    const { getBaptismCorrections, deleteBaptismCorrection, getBaptisms } = useAppData();
    const [corrections, setCorrections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { toast } = useToast();

    // Modal State
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);

    useEffect(() => {
        // For Chancery, we might want to load corrections for the whole diocese or specific logic
        // Currently reusing parish logic, assuming user.parishId might be null for Chancery or handled differently
        // If Chancery manages specific parish, it uses that ID. If managing diocese, logic might need adjustment in context.
        // As per instructions, copying logic first.
        if (user?.dioceseId) {
             // TODO: Update context to support fetching by dioceseId if needed
             // For now, loading what we can based on context availability
             loadCorrections();
        }
    }, [user]);

    const loadCorrections = () => {
        // Using parishId if available, otherwise might need diocese-level fetch
        // Adapting to use dioceseId for Chancery context if AppDataContext supports it, 
        // otherwise falling back to what's available or needing context update.
        // For exact copy as requested:
        const data = getBaptismCorrections(user?.parishId || user?.dioceseId); 
        setCorrections(data);
    };

    const handleDelete = (id) => {
        if (window.confirm("¿Está seguro de que desea eliminar este decreto? Esta acción no se puede deshacer y no restaurará la partida original automáticamente.")) {
            const result = deleteBaptismCorrection(id, user?.parishId || user?.dioceseId);
            if (result.success) {
                toast({ title: "Eliminado", description: "Decreto eliminado correctamente.", className: "bg-green-50" });
                loadCorrections();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        }
    };

    const handleView = (decree) => {
        setSelectedDecree(decree);
        setViewModalOpen(true);
    };

    const handleEdit = (id) => {
         navigate(`/chancery/decree-correction/edit?id=${id}`);
    };

    // Helper to resolve names dynamically
    const resolveBaptismName = (baptismId, fallbackData) => {
        if (baptismId) {
            const baptisms = getBaptisms(user?.parishId || user?.dioceseId) || [];
            const found = baptisms.find(b => b.id === baptismId);
            if (found) {
                return `${found.firstName || found.nombres || ''} ${found.lastName || found.apellidos || ''}`.trim();
            }
        }
        // Fallback if ID lookup fails or no ID
        if (fallbackData) {
            const fName = fallbackData.firstName || fallbackData.nombres || '';
            const lName = fallbackData.lastName || fallbackData.apellidos || '';
            return `${fName} ${lName}`.trim();
        }
        return '';
    };

    const filteredCorrections = corrections.filter(item => {
        const annulledName = resolveBaptismName(item.targetBaptismId || item.originalPartidaId, item.originalPartidaSummary);
        const term = searchTerm.toLowerCase();
        
        return item.decreeNumber.toLowerCase().includes(term) ||
               annulledName.toLowerCase().includes(term);
    });

    const columns = [
        { header: 'No. Decreto', accessor: 'decreeNumber', className: "font-semibold text-gray-900" },
        { header: 'Fecha', accessor: 'decreeDate' },
        { 
            header: 'Partida Anulada', 
            render: (row) => {
                const name = resolveBaptismName(row.targetBaptismId || row.originalPartidaId, row.originalPartidaSummary || row.targetBaptismData);
                return name ? name.toUpperCase() : '';
            }
        },
        { 
            header: 'Nueva Partida', 
            render: (row) => {
                const name = resolveBaptismName(row.newPartidaId, row.baptismData || row.newPartidaSummary);
                return name ? name.toUpperCase() : '';
            }
        },
        {
            header: 'Acciones',
            render: (row) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800" onClick={() => handleView(row)}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-800" onClick={() => handleEdit(row.id)}>
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#2C3E50]">Decretos de Corrección</h1>
                    <p className="text-gray-500">Historial de correcciones y anulaciones de bautismo</p>
                </div>
                <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => navigate('/chancery/decree-correction/new')}
                >
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Decreto
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar por número de decreto o nombre..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 max-w-md"
                    />
                </div>

                <Table columns={columns} data={filteredCorrections} />
                
                {filteredCorrections.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {searchTerm ? 'No se encontraron decretos con ese criterio.' : 'No hay decretos registrados aún.'}
                    </div>
                )}
            </div>

            <ViewCorrectionDecreeModal 
                isOpen={viewModalOpen}
                onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }}
                decreeData={selectedDecree}
            />
        </DashboardLayout>
    );
};

export default DecreeCorrectionListPage;