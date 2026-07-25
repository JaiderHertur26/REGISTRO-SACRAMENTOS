import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Search, Edit, Trash2, FileText } from 'lucide-react';
import Table from '@/components/ui/Table';
import EditAnnulmentConceptModal from '@/components/modals/EditAnnulmentConceptModal';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN DE SUPABASE

const AnnulmentConceptsTab = ({ onSelectConcept }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedConcept, setSelectedConcept] = useState(null);

    useEffect(() => {
        loadData();
    }, [user]);

    // 🚀 CARGA DIRECTA RELACIONAL DESDE SUPABASE
    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            let targetDioceseId = user.dioceseId || user.diocese_id;

            // Si el user no tiene dioceseId en su sesión actual, lo buscamos en BD
            if (!targetDioceseId) {
                if (user.role === 'PARROQUIA' || user.parishId) {
                    const { data: parish } = await supabase
                        .from('parishes')
                        .select('diocese_id')
                        .eq('id', user.parishId)
                        .single();
                    if (parish) targetDioceseId = parish.diocese_id;
                } else if (user.role === 'CANCILLERIA' || user.chanceryId) {
                    const { data: chancery } = await supabase
                        .from('chancelleries')
                        .select('diocese_id')
                        .eq('id', user.chanceryId)
                        .single();
                    if (chancery) targetDioceseId = chancery.diocese_id;
                }
            }

            if (!targetDioceseId) {
                throw new Error("No se pudo determinar a qué Diócesis pertenece el usuario.");
            }

            // JOIN: Traemos todos los conceptos cuya cancillería pertenezca a esta Diócesis
            const { data, error } = await supabase
                .from('conceptos_anulacion')
                .select(`
                    id, codigo, concepto, expide, tipo, created_at,
                    chancelleries!inner ( diocese_id )
                `)
                .eq('chancelleries.diocese_id', targetDioceseId)
                .order('codigo', { ascending: true });

            if (error) {
                console.error("❌ Error de Supabase:", error.message);
                throw error;
            }
            
            console.log("✅ Datos recibidos de Supabase:", data);
            setConcepts(data || []);
            
        } catch (error) {
            console.error("Error loading concepts from Supabase:", error);
            toast({ title: "Error", description: "No se pudieron cargar los conceptos desde la nube.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and sort concepts by code ascending
    const filteredConcepts = concepts
        .filter(c => {
            const term = searchTerm.toLowerCase();
            return (c.codigo || '').toLowerCase().includes(term) || (c.concepto || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

    // 🚀 ELIMINACIÓN DIRECTA EN SUPABASE
    const handleDelete = async (id, e) => {
        e?.stopPropagation();
        if (window.confirm("¿Está seguro de eliminar este concepto permanentemente de la nube?")) {
            try {
                const { error } = await supabase
                    .from('conceptos_anulacion')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                toast({ title: "Eliminado", description: "El concepto ha sido eliminado de la base de datos.", className: "bg-green-600 text-white" });
                loadData(); // Recargamos la lista desde la nube
            } catch (error) {
                console.error("Error deleting concept:", error);
                toast({ title: "Error", description: "No se pudo eliminar el concepto.", variant: "destructive" });
            }
        }
    };

    const handleEdit = (concept, e) => {
        e?.stopPropagation();
        setSelectedConcept(concept);
        setIsEditOpen(true);
    };

    const handleSelectForNotes = (concept, e) => {
        e?.stopPropagation();
        if (onSelectConcept) {
            onSelectConcept(concept);
            toast({
                title: "Concepto Seleccionado",
                description: `Generando nota marginal para: ${concept.concepto}`,
                className: "bg-blue-600 text-white"
            });
        }
    };

    const columns = [
        { header: 'Código', render: (row) => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{row.codigo}</span> },
        { header: 'Concepto', render: (row) => <span className="font-semibold text-gray-900">{row.concepto}</span> },
        { header: 'Expide', render: (row) => <span className="text-gray-600 text-sm">{row.expide}</span> },
        { 
            header: 'Tipo', 
            render: (row) => {
                let badgeClass = 'bg-gray-100 text-gray-800';
                let label = 'Desconocido';

                if (row.tipo === 'porCorreccion') {
                    badgeClass = 'bg-blue-50 text-blue-600';
                    label = 'Por Corrección';
                } else if (row.tipo === 'porReposicion') {
                    badgeClass = 'bg-green-50 text-green-600';
                    label = 'Por Reposición';
                } else if (row.tipo === 'porRepeticion') {
                    badgeClass = 'bg-purple-50 text-purple-600';
                    label = 'Por Repetición';
                } else if (row.tipo === 'porNulidad') {
                    badgeClass = 'bg-amber-50 text-amber-600';
                    label = 'Por Nulidad';
                } else if (row.concepto?.toLowerCase().includes('notificaci')) {
                    badgeClass = 'bg-indigo-50 text-indigo-600';
                    label = 'Notificación';
                }

                return (
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>
                        {label}
                    </span>
                );
            } 
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                 <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Buscar por código o concepto..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <Table 
                    columns={columns} 
                    data={filteredConcepts} 
                    isLoading={isLoading}
                    actions={[
                        { label: <FileText className="w-4 h-4" />, type: 'select', onClick: handleSelectForNotes, className: "text-green-600 hover:bg-green-50 p-2 rounded-full", title: "Generar Nota Marginal" },
                        { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: handleEdit, className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-full", title: "Editar" },
                        { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row, e) => handleDelete(row.id, e), className: "text-red-500 hover:bg-red-50 p-2 rounded-full", title: "Eliminar" }
                    ]}
                />
                {!isLoading && filteredConcepts.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No se encontraron conceptos de anulación.
                    </div>
                )}
            </div>
            
            <EditAnnulmentConceptModal 
                isOpen={isEditOpen} 
                onClose={() => { setIsEditOpen(false); setSelectedConcept(null); }} 
                concept={selectedConcept}
                onSuccess={loadData} 
            />
        </div>
    );
};

export default AnnulmentConceptsTab;