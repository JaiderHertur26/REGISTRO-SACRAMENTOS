import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Edit, Trash2, Plus, Loader2 } from 'lucide-react';
import Table from '@/components/ui/Table';
import CreateAnnulmentConceptModal from '@/components/modals/CreateAnnulmentConceptModal';
import EditAnnulmentConceptModal from '@/components/modals/EditAnnulmentConceptModal';
import { supabase } from '@/lib/supabaseClient';

const AnnulmentConceptsTab = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dioceseId, setDioceseId] = useState(null); // 🚀 Guardamos la Diócesis para relacionar los conceptos
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedConcept, setSelectedConcept] = useState(null);

    useEffect(() => {
        loadData();
    }, [user]);

    // 🚀 LEER DIRECTAMENTE DESDE SUPABASE (Vinculado a la Diócesis de la Cancillería)
    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            // 1. Encontrar la Diócesis a la que pertenece esta Cancillería
            let targetDioceseId = user.dioceseId || user.diocese_id;

            if (!targetDioceseId && (user.chanceryId || user.chancery_id)) {
                const { data: chancery } = await supabase
                    .from('chancelleries')
                    .select('diocese_id')
                    .eq('id', user.chanceryId || user.chancery_id)
                    .single();
                if (chancery) targetDioceseId = chancery.diocese_id;
            }

            if (!targetDioceseId) {
                throw new Error("No se pudo determinar la Diócesis de la Cancillería.");
            }

            setDioceseId(targetDioceseId);

            // 2. Extraer todos los conceptos de esta Diócesis (que son los que verán las Parroquias)
            const { data, error } = await supabase
                .from('conceptos_anulacion')
                .select('id, codigo, concepto, expide, tipo, created_at, diocese_id')
                .eq('diocese_id', targetDioceseId)
                .order('codigo', { ascending: true });

            if (error) throw error;
            setConcepts(data || []);

        } catch (error) {
            console.error("Error loading concepts:", error);
            toast({ title: "Error", description: "No se pudieron cargar los conceptos de la nube.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // 🚀 ELIMINAR DIRECTAMENTE EN SUPABASE
    const handleDelete = async (id, e) => {
        e?.stopPropagation();
        if (window.confirm("¿Está seguro de eliminar este concepto permanentemente? Esta acción afectará a las parroquias que lo utilicen.")) {
            try {
                const { error } = await supabase
                    .from('conceptos_anulacion')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                toast({ title: "Eliminado", description: "El concepto ha sido borrado de la base de datos diocesana.", className: "bg-green-50 border-green-200 text-green-900" });
                loadData(); 
            } catch (error) {
                console.error("Error al eliminar:", error);
                toast({ title: "Error", description: "No se pudo eliminar el concepto.", variant: "destructive" });
            }
        }
    };

    const handleEdit = (concept, e) => {
        e?.stopPropagation();
        setSelectedConcept(concept);
        setIsEditOpen(true);
    };

    const handleCreate = () => {
        setIsCreateOpen(true);
    };

    const filteredConcepts = concepts
        .filter(c => {
            const term = searchTerm.toLowerCase();
            return (c.codigo || '').toLowerCase().includes(term) || (c.concepto || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
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
                <Button 
                    onClick={handleCreate} 
                    className="w-full md:w-auto bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/20 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Concepto Diocesano
                </Button>
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
                        No se encontraron conceptos de anulación en Supabase.
                    </div>
                )}
            </div>

            <CreateAnnulmentConceptModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={loadData}
                dioceseId={dioceseId} // 🚀 Pasamos el ID para inyectarlo al crear
            />

            <EditAnnulmentConceptModal
                isOpen={isEditOpen}
                onClose={() => { setIsEditOpen(false); setSelectedConcept(null); }}
                concept={selectedConcept}
                onSuccess={loadData}
                dioceseId={dioceseId} // 🚀 Pasamos el ID para conservarlo al editar
            />
        </div>
    );
};

export default AnnulmentConceptsTab;