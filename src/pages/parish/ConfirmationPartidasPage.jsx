import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import Table from '@/components/ui/Table';
import { Search, Edit, Trash2, ArrowUpDown, Info, CheckCircle, XCircle, Eye, FileText, AlertOctagon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmationReadingSummaryPanel from '@/components/ConfirmationReadingSummaryPanel';
import ViewConfirmationPartidaModal from '@/components/modals/ViewConfirmationPartidaModal';

const convertirSexo = (sexoCode) => {
    if (sexoCode == 1 || sexoCode === '1') return 'MASCULINO';
    if (sexoCode == 2 || sexoCode === '2') return 'FEMENINO';
    if (sexoCode === 'MASCULINO' || sexoCode === 'FEMENINO') return sexoCode;
    return 'NO ESPECIFICADO';
};

const InfoBox = ({ data, replacementDecree }) => {
    if (!data) return null;
    return (
        <div className="mt-8 border border-blue-200 rounded-lg overflow-hidden shadow-sm bg-white animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-[#4B7BA7] to-[#2a4e70] px-6 py-3 border-b border-blue-800 flex justify-between items-center">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-200" />
                   Detalles del Registro Seleccionado
                </h3>
                {data.newBaptismIdRepo && <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded border border-yellow-600 shadow-sm flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> PARTIDA SUPLETORIA (REPOSICIÓN)</span>}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Libro / Folio / Número</span>
                     <span className="text-base font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block font-mono">
                         {data.book_number} / {data.page_number} / {data.entry_number}
                     </span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Fecha Confirmación</span>
                     <span className="text-base font-medium text-gray-800">{data.sacramentDate || '-'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Lugar Confirmación</span>
                     <span className="text-base font-medium text-gray-800 truncate" title={data.sacramentPlace}>{data.lugarConfirmacion || data.sacramentPlace || '-'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Ministro</span>
                     <span className="text-base font-medium text-gray-800 truncate" title={data.minister}>{data.minister || '-'}</span>
                 </div>
                 <div className="border-t border-gray-100 col-span-full my-1"></div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Apellidos</span>
                     <span className="text-base font-bold text-gray-900">{data.lastName}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Nombres</span>
                     <span className="text-base font-bold text-gray-900">{data.firstName}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Sexo</span>
                     <span className="text-base font-medium text-gray-800">{convertirSexo(data.sex)}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Fecha Nacimiento</span>
                     <span className="text-base font-medium text-gray-800">{data.birthDate || '-'}</span>
                 </div>
                 <div className="border-t border-gray-100 col-span-full my-1"></div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Padre</span>
                     <span className="text-base font-medium text-gray-800">{data.fatherName || 'NO REGISTRADO'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Madre</span>
                     <span className="text-base font-medium text-gray-800">{data.motherName || 'NO REGISTRADO'}</span>
                 </div>
                 <div className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Lugar Confirmación (Detalle)</span>
                      <span className="text-base font-medium text-gray-800">{data.lugarConfirmacionDetalle || data.lugarConfirmacion || '-'}</span>
                 </div>

                 {replacementDecree && (
                    <div className="col-span-full mt-4 border-t border-yellow-200 pt-4 bg-yellow-50 p-4 rounded border">
                        <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> NOTA MARGINAL: REPOSICIÓN POR DECRETO (NUEVA PARTIDA)
                        </h4>
                        <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-yellow-900">
                             Esta partida se inscribe por reposición según Decreto No. <strong>{replacementDecree.decreeNumber}</strong> de fecha <strong>{replacementDecree.decreeDate}</strong>, debido a la pérdida/deterioro del original.
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );
};

const ConfirmationPartidasPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, getDecreeReplacementByNewBaptismId } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for data handling
  const [selectedPartida, setSelectedPartida] = useState(null); // Used for InfoBox
  const [selectedRecord, setSelectedRecord] = useState(null); // Used for Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState({ key: 'entry_number', direction: 'desc' });
  const [parishPrintData, setParishPrintData] = useState({});
  const [isReadingPanelOpen, setIsReadingPanelOpen] = useState(false);
  const [selectedReadingRecord, setSelectedReadingRecord] = useState(null);
  const [replacementDecree, setReplacementDecree] = useState(null);

  useEffect(() => { loadData(); loadParishData(); }, [user]);

  useEffect(() => {
    if (selectedPartida && selectedPartida.newBaptismIdRepo) {
        const decree = getDecreeReplacementByNewBaptismId(selectedPartida.newBaptismIdRepo, user.parishId);
        setReplacementDecree(decree);
    } else {
        setReplacementDecree(null);
    }
  }, [selectedPartida, user]);

  const loadParishData = () => {
    if (!user?.parishId) return;
    try { const misDatos = getMisDatosList(user.parishId); if (misDatos && misDatos.length > 0) setParishPrintData(misDatos[0]); } 
    catch (err) { console.error("Error loading parish data:", err); }
  };

  const loadData = () => {
    if (!user?.parishId && !user?.dioceseId) return;
    setIsLoading(true);
    const entityId = user.parishId || user.dioceseId;
    const key = `confirmations_${entityId}`;
    try {
        const storedData = localStorage.getItem(key);
        if (storedData) setRecords(JSON.parse(storedData)); else setRecords([]);
    } catch (error) { console.error("Error loading confirmations:", error); toast({ title: "Error", description: "No se pudieron cargar los registros.", variant: "destructive" }); } 
    finally { setIsLoading(false); }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a, b) => {
      let aValue = a[sortConfig.key], bValue = b[sortConfig.key];
      if (sortConfig.key === 'entry_number') {
         aValue = (parseInt(a.book_number || 0) * 1000000) + (parseInt(a.page_number || 0) * 1000) + parseInt(a.entry_number || 0);
         bValue = (parseInt(b.book_number || 0) * 1000000) + (parseInt(b.page_number || 0) * 1000) + parseInt(b.entry_number || 0);
      } else if (sortConfig.key === 'sacramentDate') {
          const parse = d => d && d.includes('/') ? new Date(d.split('/').reverse().join('-')).getTime() : new Date(d).getTime();
          aValue = parse(a.sacramentDate); bValue = parse(b.sacramentDate);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
  });

  const filteredRecords = sortedRecords.filter(r => {
    const term = searchTerm.toLowerCase();
    return (r.firstName || '').toLowerCase().includes(term) || (r.lastName || '').toLowerCase().includes(term);
  });

  const handleDelete = (id, e) => {
      e?.stopPropagation(); 
      if (window.confirm("¿Está seguro de eliminar este registro? Esta acción no se puede deshacer.")) {
          const entityId = user.parishId || user.dioceseId;
          const key = `confirmations_${entityId}`;
          const updatedRecords = records.filter(r => r.id !== id);
          localStorage.setItem(key, JSON.stringify(updatedRecords));
          setRecords(updatedRecords);
          if (selectedPartida?.id === id) setSelectedPartida(null);
          toast({ title: "Registro eliminado", description: "La confirmación ha sido eliminada correctamente." });
      }
  };

  const handleEdit = (id, e) => { e?.stopPropagation(); navigate(`/parroquia/confirmacion/editar?id=${id}`); };
  
  const handleViewClick = (row, e) => { 
      e?.stopPropagation(); 
      setSelectedRecord({...row, godparents: row.godparents || ''}); 
      setIsViewModalOpen(true); 
  };

  const columns = [
    { 
        header: <div onClick={() => handleSort('entry_number')} className="cursor-pointer">Número <ArrowUpDown className="inline w-3 h-3"/></div>, 
        render: (row) => (
             <div className="flex flex-col items-start gap-1">
                 <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-700">L:{row.book_number} F:{row.page_number} N:{row.entry_number}</span>
                 {row.newBaptismIdRepo && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200">REPOSICIÓN</span>}
             </div>
        )
    },
    { header: <div onClick={() => handleSort('lastName')} className="cursor-pointer">Apellidos <ArrowUpDown className="inline w-3 h-3"/></div>, render: (row) => <span className="font-semibold text-gray-900">{row.lastName}</span> },
    { header: 'Nombres', render: (row) => <span className="text-gray-800">{row.firstName}</span> },
    { header: 'Fecha Conf.', render: (row) => <span className="text-gray-600 text-sm">{row.sacramentDate}</span> }
  ];

  if (isLoading) return <DashboardLayout entityName={user?.parishName || "Parroquia"}><div className="flex justify-center items-center h-64"><p className="text-gray-500">Cargando partidas...</p></div></DashboardLayout>;

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div><h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Partidas de Confirmación</h1><p className="text-gray-600 mt-1">Consulte, edite e imprima los registros de confirmación asentados.</p></div>
        <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-600 shadow-sm">Total: {filteredRecords.length}</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex gap-4">
         <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Buscar por apellidos o nombres..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <Table columns={columns} data={filteredRecords} onRowClick={(row) => setSelectedPartida(row)} actions={[
                    { label: <Eye className="w-4 h-4" />, type: 'view', onClick: handleViewClick, className: "text-[#D4AF37] hover:bg-yellow-50 p-2 rounded-full", title: "Visualizar Partida" },
                    { 
                        label: (row) => {
                            const isAnnulled = row.status === 'anulada' || row.isAnnulled;
                            return isAnnulled 
                                ? <XCircle className="w-4 h-4" />
                                : <CheckCircle className="w-4 h-4" />;
                        },
                        type: 'verify-status', 
                        className: (row) => {
                            const isAnnulled = row.status === 'anulada' || row.isAnnulled;
                            return `p-2 rounded-full h-9 w-9 flex items-center justify-center cursor-default ${
                                isAnnulled ? 'text-red-500' : 'text-green-500'
                            }`;
                        }, 
                        title: (row) => {
                            const isAnnulled = row.status === 'anulada' || row.isAnnulled;
                            return isAnnulled ? "Partida Anulada" : "Partida Correcta";
                        },
                        disabled: true
                    },
                    { label: <Edit className="w-4 h-4" />, type: 'edit', onClick: (row, e) => handleEdit(row.id, e), className: "text-[#4B7BA7] hover:bg-blue-50 p-2 rounded-full", title: "Editar" },
                    { label: <Trash2 className="w-4 h-4" />, type: 'delete', onClick: (row, e) => handleDelete(row.id, e), className: "text-red-500 hover:bg-red-50 p-2 rounded-full", title: "Eliminar" }
            ]}/>
      </div>
      <InfoBox data={selectedPartida} replacementDecree={replacementDecree} />
      
      <ViewConfirmationPartidaModal 
          isOpen={isViewModalOpen}
          onClose={() => { setIsViewModalOpen(false); setSelectedRecord(null); }}
          partida={selectedRecord}
          auxiliaryData={{ ...parishPrintData, diocese: user?.dioceseName || parishPrintData.diocese || 'ARQUIDIÓCESIS', city: user?.city || parishPrintData.ciudad || 'CIUDAD' }}
      />
      
      <ConfirmationReadingSummaryPanel isOpen={isReadingPanelOpen} onClose={() => { setIsReadingPanelOpen(false); setSelectedReadingRecord(null); }} data={selectedReadingRecord} />
    </DashboardLayout>
  );
};

export default ConfirmationPartidasPage;