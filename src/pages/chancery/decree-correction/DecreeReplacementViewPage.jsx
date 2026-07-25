import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { Edit, Trash2, PlusCircle, Search, FileX2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const DecreeReplacementViewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.parishId || user?.dioceseId) {
        loadData();
    }
  }, [user, activeTab]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = records.filter(r => 
        (r.nombres || '').toLowerCase().includes(term) ||
        (r.apellidos || '').toLowerCase().includes(term) ||
        (r.numeroDecreto || '').toLowerCase().includes(term)
    );
    setFilteredRecords(filtered);
  }, [searchTerm, records]);

  const loadData = () => {
      const entityId = user.parishId || user.dioceseId;
      const storageKey = `decrees_correction_${entityId}`;
      const allDecrees = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      const sacramentDecrees = allDecrees.filter(d => d.sacrament === activeTab);
      setRecords(sacramentDecrees);
      setFilteredRecords(sacramentDecrees);
  };

  const handleDelete = (id) => {
      if (window.confirm("¿Está seguro de eliminar este decreto? Esta acción no se puede deshacer.")) {
          const entityId = user.parishId || user.dioceseId;
          const storageKey = `decrees_correction_${entityId}`;
          const allDecrees = JSON.parse(localStorage.getItem(storageKey) || '[]');
          
          const updated = allDecrees.filter(d => d.id !== id);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          
          loadData();
          toast({ title: "Decreto eliminado", description: "El registro ha sido borrado correctamente." });
      }
  };

  const columns = [
    { header: 'No. Decreto', accessor: 'numeroDecreto', className: "font-mono font-bold w-32" },
    { header: 'Fecha', accessor: 'fechaDecreto', className: "w-32" },
    { header: 'Sujeto (Apellidos)', accessor: 'apellidos', className: "font-semibold" },
    { header: 'Sujeto (Nombres)', accessor: 'nombres' },
    { header: 'Error', accessor: 'errorEncontrado', className: "truncate max-w-[200px]" },
    { header: 'Corrección', accessor: 'correccionRealizada', className: "truncate max-w-[200px]" }
  ];

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Decretos de Corrección (Vista)</h1>
            <p className="text-gray-600 mt-1">Listado de decretos emitidos para corregir errores en partidas.</p>
        </div>
        <Button onClick={() => navigate('/chancery/decree-correction/new')} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 font-bold shadow-md">
            <PlusCircle className="w-4 h-4" /> Nuevo Decreto
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 min-h-[500px]">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <TabsList className="grid w-full md:w-auto grid-cols-3 bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger value="bautismo" className="px-6 py-2">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmacion" className="px-6 py-2">Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonio" className="px-6 py-2">Matrimonios</TabsTrigger>
                </TabsList>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Buscar decreto..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm"
                    />
                </div>
            </div>

            <TabsContent value="bautismo" className="mt-0">
                {filteredRecords.length === 0 ? <EmptyState /> : <DecreeTable data={filteredRecords} columns={columns} onDelete={handleDelete} navigate={navigate} />}
            </TabsContent>
            {/* ... other tabs ... */}
         </Tabs>
      </div>
    </DashboardLayout>
  );
};

const DecreeTable = ({ data, columns, onDelete, navigate }) => (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table 
            columns={columns} 
            data={data}
            actions={[
                { 
                    label: <Edit className="w-4 h-4" />, 
                    type: 'edit', 
                    onClick: (row) => navigate(`/chancery/decree-correction/edit?id=${row.id}&sacrament=${row.sacrament}`), 
                    className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-full transition-colors"
                },
                { 
                    label: <Trash2 className="w-4 h-4" />, 
                    type: 'delete', 
                    onClick: (row) => onDelete(row.id), 
                    className: "text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                }
            ]}
        />
    </div>
);

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
         <FileX2 className="w-12 h-12 mb-3 text-gray-300" />
         <p className="font-medium">No se encontraron decretos</p>
         <p className="text-sm">Intente con otro término o cree un nuevo registro.</p>
    </div>
);

export default DecreeReplacementViewPage;