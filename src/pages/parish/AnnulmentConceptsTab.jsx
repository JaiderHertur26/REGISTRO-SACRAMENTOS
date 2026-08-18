import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Search, Edit, Trash2, FileText } from 'lucide-react';
import Table from '@/components/ui/Table';
import EditAnnulmentConceptModal from '@/components/modals/EditAnnulmentConceptModal';
import { supabase } from '@/lib/supabaseClient'; 

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

    // 🚀 CARGA DIRECTA Y CORREGIDA DESDE SUPABASE
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

            // 🚀 SOLUCIÓN ERROR 400: Consulta directa a diocese_id sin JOIN fantasma
            const { data, error } = await supabase
                .from('conceptos_anulacion')
                .select('id, codigo, concepto, expide, tipo, created_at, diocese_id')
                .eq('diocese_id', targetDioceseId)
                .order('codigo', { ascending: true });

            if (error) {
                throw error;
            }
            
            setConcepts(data || []);
            
        } catch (error) {
            console.error("Error loading concepts from Supabase:", error.message);
            toast({ title: "Error", description: "No se pudieron cargar los conceptos desde la nube.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredConcepts = concepts
        .filter(c => {
            const term = searchTerm.toLowerCase();
            return (c.codigo || '').toLowerCase().includes(term) || (c.concepto || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

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
                loadData(); 
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
        { header: 'Código', render: (row) => <span className="font-mono text-xs font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{row.codigo}</span> },
        { header: 'Concepto', render: (row) => <span className="font-bold text-gray-900 uppercase text-xs tracking-tight">{row.concepto}</span> },
        { header: 'Expide', render: (row) => <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">{row.expide}</span> },
        { 
            header: 'Tipo', 
            render: (row) => {
                let badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
                let label = 'Desconocido';

                if (row.tipo === 'porCorreccion') {
                    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                    label = 'Corrección';
                } else if (row.tipo === 'porReposicion') {
                    badgeClass = 'bg-green-50 text-green-700 border-green-200';
                    label = 'Reposición';
                } else if (row.tipo === 'porRepeticion') {
                    badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                    label = 'Repetición';
                } else if (row.tipo === 'porNulidad') {
                    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                    label = 'Nulidad';
                } else if (row.concepto?.toLowerCase().includes('notificaci')) {
                    badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    label = 'Notificación';
                }

                return (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${badgeClass}`}>
                        {label}
                    </span>
                );
            } 
        },
        {
            header: 'Acciones',
            className: 'text-right',
            render: (row) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:bg-green-50 rounded-xl" onClick={(e) => handleSelectForNotes(row, e)} title="Generar Nota Marginal">
                        <FileText className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#4B7BA7] hover:bg-blue-50 rounded-xl" onClick={(e) => handleEdit(row, e)} title="Editar">
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={(e) => handleDelete(row.id, e)} title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4">
                 <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4B7BA7] w-5 h-5 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar por código o concepto..." 
                        className="w-full pl-12 pr-4 py-4 border-none bg-white rounded-2xl shadow-sm focus:ring-4 focus:ring-[#4B7BA7]/10 outline-none text-gray-900 text-sm font-bold uppercase transition-all" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <Table 
                    columns={columns} 
                    data={filteredConcepts} 
                    isLoading={isLoading}
                    className="border-none"
                />
                {!isLoading && filteredConcepts.length === 0 && (
                    <div className="p-16 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                        No se encontraron conceptos en la Nube.
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