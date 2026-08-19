import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Search, Eye, Filter, Pencil } from 'lucide-react';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';

const ChanceryCorrectionDecreeListPage = () => {
    const { user } = useAuth();
    const { data, getBaptismCorrections } = useAppData();
    const [allDecrees, setAllDecrees] = useState([]);
    const [filteredDecrees, setFilteredDecrees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // Modal State
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);

    useEffect(() => {
        if (user?.dioceseId) {
            loadAllDioceseCorrections();
        }
    }, [user, data.parishes]);

    const loadAllDioceseCorrections = () => {
        // 1. Identify all parishes in this diocese
        const dioceseParishes = data.parishes.filter(p => p.dioceseId === user.dioceseId);
        
        // 2. Aggregate corrections from all parishes
        let aggregated = [];
        
        dioceseParishes.forEach(parish => {
            const parishCorrections = getBaptismCorrections(parish.id) || [];
            // Attach parish name for context
            const enriched = parishCorrections.map(c => ({
                ...c,
                parishName: parish.name,
                parishCity: parish.city
            }));
            aggregated = [...aggregated, ...enriched];
        });

        // 3. Sort by date descending
        aggregated.sort((a, b) => new Date(b.createdAt || b.decreeDate) - new Date(a.createdAt || a.decreeDate));

        setAllDecrees(aggregated);
        setFilteredDecrees(aggregated);
    };

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = allDecrees.filter(item => {
            const decreeNum = (item.decreeNumber || '').toLowerCase();
            const pName = (item.parishName || '').toLowerCase();
            
            // Extracting name for search matching
            const personName = item.subject_name || 
                             item.person_name || 
                             item.originalPartidaSummary?.names || 
                             item.baptismData?.nombres || 
                             '';
            
            return decreeNum.includes(term) || 
                   pName.includes(term) || 
                   personName.toLowerCase().includes(term);
        });
        setFilteredDecrees(filtered);
    }, [searchTerm, allDecrees]);

    const handleView = (decree) => {
        setSelectedDecree(decree);
        setViewModalOpen(true);
    };

    const handleEdit = (decree) => {
        navigate(`/chancery/decree-correction/edit?id=${decree.id}`);
    };

    const columns = [
        { header: 'No. Decreto', accessor: 'decreeNumber', className: "font-semibold text-gray-900" },
        { header: 'Fecha', accessor: 'decreeDate' },
        { header: 'Parroquia', accessor: 'parishName', className: "text-sm text-gray-600" },
        { 
            header: 'Sujeto (Partida Anulada)', 
            render: (row) => {
                // Priority extraction of person's name
                return row.subject_name || 
                       row.person_name || 
                       row.originalPartidaSummary?.names || 
                       `${row.baptismData?.nombres || ''} ${row.baptismData?.apellidos || ''}`.trim() || 
                       'N/A';
            }
        },
        { header: 'Concepto', accessor: 'annulmentConceptCode', className: "text-xs uppercase bg-gray-100 px-2 py-1 rounded" },
        {
            header: 'Acciones',
            render: (row) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleView(row)}>
                        <Eye className="w-4 h-4 mr-1" /> Ver Detalle
                    </Button>
                    <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => handleEdit(row)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                    </Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={`Cancillería - ${user?.dioceseName || ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#2C3E50]">Decretos de Corrección</h1>
                    <p className="text-gray-500">Vista general de decretos de corrección (Bautismo) en la diócesis.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Filter className="w-4 h-4" /> Filtros
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar por decreto, parroquia o nombre..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 max-w-lg"
                    />
                </div>

                <Table columns={columns} data={filteredDecrees} />
                
                {filteredDecrees.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg mt-4 border border-dashed border-gray-200">
                        <p className="font-medium">No se encontraron decretos.</p>
                        <p className="text-sm mt-1">Intente ajustar los términos de búsqueda.</p>
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

export default ChanceryCorrectionDecreeListPage;