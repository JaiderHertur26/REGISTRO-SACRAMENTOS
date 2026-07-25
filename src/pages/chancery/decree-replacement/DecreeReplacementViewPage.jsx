import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { Edit, Trash2, PlusCircle, Search, FileX2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';

const ChanceryDecreeReplacementViewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { getConceptosAnulacion } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedDecree, setSelectedDecree] = useState(null);

  useEffect(() => {
    if (user) { loadData(); }
  }, [user, activeTab]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = records.filter(r => 
        (r.targetName || r.nombres || '').toLowerCase().includes(term) ||
        (r.apellidos || '').toLowerCase().includes(term) ||
        (r.numeroDecreto || r.decreeNumber || '').toLowerCase().includes(term)
    );
    setFilteredRecords(filtered);
  }, [searchTerm, records]);

  // --- EL "BUSCADOR OMNISCIENTE" PARA CANCILLERÍA ---
  const loadData = () => {
      const allDecreesMap = new Map();

      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          
          if (key.includes('decreeReplacement') || key.includes('decreeReplacements')) {
              try {
                  const rawData = localStorage.getItem(key);
                  if (rawData && rawData.startsWith('[')) {
                      const parsed = JSON.parse(rawData);
                      parsed.forEach(decree => {
                          const isDecree = decree && (decree.decreeNumber || decree.numeroDecreto) && (decree.targetName || decree.nombres);
                          const isNotRegularPartida = decree.type === 'replacement' || decree.conceptoAnulacionId || decree.newPartidaSummary;

                          if (isDecree && isNotRegularPartida) {
                              const itemSacrament = decree.sacrament || 'bautismo';
                              if (itemSacrament === activeTab || activeTab === "bautismo") {
                                  if (!allDecreesMap.has(decree.id) || decree.isMasterCopy) {
                                      allDecreesMap.set(decree.id, decree);
                                  }
                              }
                          }
                      });
                  }
              } catch (e) {}
          }
      }

      const sortedRecords = Array.from(allDecreesMap.values())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      
      setRecords(sortedRecords);
      setFilteredRecords(sortedRecords);
  };

  const handleDelete = (id) => {
      if (window.confirm("¿Está seguro de eliminar este decreto de TODO EL SISTEMA? Esta acción borrará la copia de Cancillería y las copias de la Parroquia.")) {
          let deleted = false;

          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key.includes('decreeReplacement') || key.includes('decreeReplacements')) {
                  try {
                      let currentRecords = JSON.parse(localStorage.getItem(key) || '[]');
                      const originalLength = currentRecords.length;
                      currentRecords = currentRecords.filter(r => r.id !== id);
                      
                      if (currentRecords.length < originalLength) {
                          localStorage.setItem(key, JSON.stringify(currentRecords));
                          deleted = true;
                      }
                  } catch(e) {}
              }
          }

          if (deleted) {
              toast({ title: "Eliminado", description: "El decreto ha sido borrado del sistema central." });
              loadData();
          } else {
              toast({ title: "Error", description: "No se pudo eliminar el archivo.", variant: "destructive" });
          }
      }
  };

  const columns = [
    { 
        header: 'No. Decreto', 
        className: "font-mono font-bold w-32 text-blue-800", 
        render: (row) => row.decreeNumber || row.numeroDecreto || '---' 
    },
    { 
        header: 'Fecha', 
        className: "w-32", 
        render: (row) => row.decreeDate || row.fechaDecreto || '---' 
    },
    { 
        header: 'Concepto / Causa', 
        render: (row) => {
            const conceptos = getConceptosAnulacion(user.dioceseId || user.id) || [];
            const conceptoMatch = conceptos.find(c => String(c.id) === String(row.conceptoAnulacionId));
            const nombreConcepto = conceptoMatch ? conceptoMatch.concepto : (row.concepto || row.causa || 'DECRETO DE REPOSICIÓN');
            
            return <span className="font-semibold text-[10px] bg-orange-100 text-orange-800 px-2 py-1 rounded block truncate w-full max-w-[150px]">
                {nombreConcepto.toUpperCase()}
            </span>;
        } 
    },
    { 
        header: 'Parroquia Destino', 
        render: (row) => <span className="text-[11px] font-bold text-purple-700 uppercase">{row.targetParishName || row.parroquia || 'DESCONOCIDA'}</span> 
    },
    { 
        header: 'Titular', 
        render: (row) => <span className="font-bold uppercase text-gray-800">{row.targetName || `${row.nombres || ''} ${row.apellidos || ''}`.trim()}</span> 
    },
    { 
        header: 'Nueva Partida', 
        render: (row) => {
            const data = row.newPartidaSummary || row.datosNuevaPartida || {};
            const L = data.book || data.book_number || data.numeroLibro || '-';
            const F = data.page || data.page_number || data.folio || '-';
            const N = data.entry || data.entry_number || data.numeroActa || '-';
            return <span className="font-mono text-[11px] text-gray-500">L:{L} F:{F} N:{N}</span>;
        } 
    },
    { 
        header: 'Estado', 
        render: (row) => <span className="bg-green-100 text-green-700 px-2 py-0.5 border border-green-200 rounded text-[10px] font-bold uppercase tracking-wider">{row.estado || row.status || 'Activo'}</span> 
    }
  ];

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Decretos de Reposición (Cancillería)</h1>
            <p className="text-gray-600 mt-1">Archivo central de decretos maestros emitidos para reponer partidas parroquiales.</p>
        </div>
        <Button onClick={() => navigate('/chancery/decree-replacement/new')} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 font-bold shadow-md">
            <PlusCircle className="w-4 h-4" /> Emitir Decreto
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 min-h-[500px]">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <TabsList className="grid w-full md:w-auto grid-cols-3 bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger value="bautismo" className="px-6 py-2 font-medium">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmacion" className="px-6 py-2 font-medium" disabled>Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonio" className="px-6 py-2 font-medium" disabled>Matrimonios</TabsTrigger>
                </TabsList>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Buscar por decreto o nombre..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm"
                    />
                </div>
            </div>

            <TabsContent value="bautismo" className="mt-0">
                {filteredRecords.length === 0 ? <EmptyState /> : (
                    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                        <Table 
                            columns={columns} 
                            data={filteredRecords}
                            actions={[
                                { 
                                    label: <Eye className="w-4 h-4" />, 
                                    onClick: (row) => { setSelectedDecree(row); setViewModalOpen(true); }, 
                                    className: "text-[#D4AF37] hover:bg-yellow-50 p-2 rounded-full transition-colors",
                                    title: "Vista Previa / Imprimir"
                                },
                                { 
                                    label: <Edit className="w-4 h-4" />, 
                                    onClick: (row) => navigate(`/chancery/decree-replacement/edit?id=${row.id}`), 
                                    className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-full transition-colors",
                                    title: "Editar"
                                },
                                { 
                                    label: <Trash2 className="w-4 h-4" />, 
                                    onClick: (row) => handleDelete(row.id), 
                                    className: "text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors",
                                    title: "Eliminar"
                                }
                            ]}
                        />
                    </div>
                )}
            </TabsContent>
         </Tabs>
      </div>

      {viewModalOpen && (
          <ViewRepositionDecreeModal 
              isOpen={viewModalOpen}
              onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }}
              decreeData={selectedDecree}
          />
      )}
    </DashboardLayout>
  );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
         <FileX2 className="w-12 h-12 mb-3 text-gray-300" />
         <p className="font-bold text-gray-700">Archivo Central Vacío</p>
         <p className="text-sm mt-1">No hay decretos emitidos o no coinciden con su búsqueda.</p>
    </div>
);

export default ChanceryDecreeReplacementViewPage;