import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Edit, Trash2, Plus, Loader2 } from 'lucide-react';
import Table from '@/components/ui/Table';
import CreateAnnulmentConceptModal from '@/components/modals/CreateAnnulmentConceptModal';
import EditAnnulmentConceptModal from '@/components/modals/EditAnnulmentConceptModal';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN DE SUPABASE

const AnnulmentConceptsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  // 🚀 LEER DIRECTAMENTE DESDE SUPABASE (Vinculado a la Cancillería)
  const loadData = async () => {
    // REGLA DE NEGOCIO: Solo se leen los conceptos de la Cancillería
    const chanceryId = user?.chancery_id || user?.chanceryId;
    
    if (!chanceryId) {
        setIsLoading(false);
        return; // Si no es cancillería, no carga nada
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('conceptos_anulacion')
        .select('*')
        .eq('chancery_id', chanceryId) // 🚀 Buscamos por chancery_id exacto
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
    if (window.confirm("¿Está seguro de eliminar este concepto permanentemente?")) {
      try {
        const { error } = await supabase
          .from('conceptos_anulacion')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({ title: "Eliminado", description: "El concepto ha sido borrado de la base de datos.", className: "bg-green-50 border-green-200 text-green-900" });
        loadData(); // Recargar la tabla
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

  const filteredConcepts = concepts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.codigo || '').toLowerCase().includes(term) || (c.concepto || '').toLowerCase().includes(term);
  });

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
        }

        return (
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest ${badgeClass}`}>
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
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 font-bold text-sm uppercase"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-[#4B7BA7] hover:bg-[#3b6082] text-white gap-2 px-6 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Crear Nuevo Concepto
        </Button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <Table
          columns={columns}
          data={filteredConcepts}
          isLoading={isLoading}
          actions={[
            { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: handleEdit, className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-full", title: "Editar" },
            { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row, e) => handleDelete(row.id, e), className: "text-red-500 hover:bg-red-50 p-2 rounded-full", title: "Eliminar" }
          ]}
        />
        {!isLoading && filteredConcepts.length === 0 && (
          <div className="p-12 text-center text-gray-400 font-black uppercase tracking-widest text-xs border-t border-gray-50">
            No se encontraron conceptos de anulación en Supabase.
          </div>
        )}
      </div>

      <CreateAnnulmentConceptModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadData}
      />

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