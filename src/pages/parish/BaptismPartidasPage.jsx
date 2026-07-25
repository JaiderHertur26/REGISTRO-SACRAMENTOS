import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { 
    Search, Edit, Trash2, ArrowUpDown, FileX2, Info, 
    CheckCircle as CircleCheckBig, XCircle, Eye, AlertOctagon, 
    BookOpen, Loader2, ChevronLeft, ChevronRight, User, Users, MapPin, PenTool
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import BaptismPartidaValidator from '@/components/BaptismPartidaValidator';
import ViewBaptismPartidaModal from '@/components/modals/ViewBaptismPartidaModal';

// --- COMPONENTE: PANEL DE DETALLES EXTENDIDO (LOS 20 CAMPOS) ---
const InfoBox = ({ data }) => {
    if (!data) return null;
    
    const isReplacement = data.isSupplementary || data.tipoIdentidad === 'id_creada_reposicion';

    return (
        <div className="mt-8 border border-blue-200 rounded-[2rem] overflow-hidden shadow-xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 px-8 py-4 flex justify-between items-center">
                <h3 className="text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-3">
                   <Info className="w-5 h-5 text-blue-400" /> Inspección de Registro Permanente
                </h3>
                {isReplacement && (
                    <span className="bg-amber-400 text-slate-900 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <AlertOctagon className="w-3.5 h-3.5"/> Acta por Decreto
                    </span>
                )}
            </div>

            <div className="p-8 space-y-8">
                {/* FILA 1: ARCHIVO E IDENTIDAD */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Localización Física</span>
                        <span className="text-lg font-black text-[#4B7BA7] font-mono bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 inline-block">
                            L:{data.Libro} F:{data.folio} N:{data.numero}
                        </span>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Bautizado (Nombre Completo)</span>
                        <span className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                            {data.apellidos} {data.nombres}
                        </span>
                    </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {/* FILA 2: DATOS DEL SACRAMENTO Y NACIMIENTO */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <DetailItem icon={MapPin} label="Lugar Nacimiento" value={data.lugarNacimiento} />
                    <DetailItem icon={User} label="Fecha Nacimiento" value={data.fechaNacimiento} />
                    <DetailItem icon={MapPin} label="Lugar Bautismo" value={data.lugarBautismo} />
                    <DetailItem icon={User} label="Fecha Bautismo" value={data.fechaSacramento} />
                </div>

                {/* FILA 3: FILIACIÓN (PADRES Y ABUELOS) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-4 h-4" /> Línea Paterna
                        </h4>
                        <DetailItem label="Padre" value={data.nombrePadre} />
                        <DetailItem label="Abuelos Paternos" value={data.abuelosPaternos} isItalic />
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-4 h-4" /> Línea Materna
                        </h4>
                        <DetailItem label="Madre" value={data.nombreMadre} />
                        <DetailItem label="Abuelos Maternos" value={data.abuelosMaternos} isItalic />
                    </div>
                </div>

                {/* FILA 4: TESTIGOS Y AUTORIDADES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <DetailItem icon={Users} label="Padrinos" value={data.padrinos} />
                    <DetailItem icon={PenTool} label="Ministro" value={data.ministro} />
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Párroco que Da Fe (Firma)</span>
                        <span className="text-sm font-black text-blue-600 uppercase border-b-2 border-blue-100 pb-1 inline-block">
                            {data.daFe}
                        </span>
                    </div>
                </div>

                {/* NOTA MARGINAL */}
                <div className="p-6 rounded-[1.5rem] border bg-amber-50/30 border-amber-100">
                    <h4 className="text-[10px] font-black text-amber-600/60 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Nota Marginal Purificada
                    </h4>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed font-mono uppercase italic">
                        "{data.notaMarginal}"
                    </p>
                </div>

                <div className="pt-2">
                   <BaptismPartidaValidator rawData={data} />
                </div>
            </div>
        </div>
    );
};

// Componente miniatura para los detalles
const DetailItem = ({ icon: Icon, label, value, isItalic = false }) => (
    <div className="space-y-1 text-left">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3 text-slate-300" />} {label}
        </span>
        <span className={`text-sm font-bold text-slate-800 uppercase block ${isItalic ? 'italic font-medium text-slate-500' : ''}`}>
            {value || '---'}
        </span>
    </div>
);

const BaptismPartidasPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, purificarRegistroBautismo } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;
  const [sortConfig, setSortConfig] = useState({ key: 'entry_number', direction: 'desc' });
  
  const [selectedPartida, setSelectedPartida] = useState(null); 
  const [parishPrintData, setParishPrintData] = useState({});
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  useEffect(() => {
      if (user?.parishId) {
          const misDatos = getMisDatosList(user.parishId);
          if (misDatos && misDatos.length > 0) setParishPrintData(misDatos[0]);
      }
  }, [user]);

  const fetchRecords = async () => {
      if (!user?.parishId) return;
      if (searchTerm) setIsSearching(true);
      else setIsLoading(true);

      try {
          let query = supabase.from('baptisms').select('*', { count: 'exact' }).eq('parish_id', user.parishId);

          if (searchTerm) {
              const term = `%${searchTerm.toLowerCase()}%`;
              query = query.or(`first_name.ilike.${term},last_name.ilike.${term},father_name.ilike.${term},mother_name.ilike.${term}`);
          }

          query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
          const from = (currentPage - 1) * recordsPerPage;
          const to = from + recordsPerPage - 1;
          query = query.range(from, to);

          const { data, count, error } = await query;
          if (error) throw error;

          // ✅ LLAVE DE ORO: Purificación inmediata al recibir de la nube
          const sanitizedData = data.map(record => (
              purificarRegistroBautismo({ 
                  ...record.raw_data, 
                  id: record.id, 
                  status: record.status,
                  Libro: record.raw_data?.Libro || record.book_number,
                  folio: record.raw_data?.folio || record.page_number,
                  numero: record.raw_data?.numero || record.entry_number
              })
          ));

          setRecords(sanitizedData);
          setTotalRecords(count || 0);

          if (selectedPartida) {
              const updated = sanitizedData.find(r => r.id === selectedPartida.id);
              if (updated) setSelectedPartida(updated);
          }
      } catch (err) {
          toast({ title: "Error de conexión", variant: "destructive" });
      } finally {
          setIsLoading(false);
          setIsSearching(false);
      }
  };

  useEffect(() => {
      const delayDebounceFn = setTimeout(() => {
          setCurrentPage(1);
          fetchRecords();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, sortConfig]);

  useEffect(() => { fetchRecords(); }, [currentPage]);

  const columns = [
    { 
        header: 'Archivo',
        render: (r) => <span className="font-mono text-[11px] font-black text-[#4B7BA7] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase text-center min-w-[120px] inline-block">L:{r.Libro} F:{r.folio} N:{r.numero}</span>
    },
    { header: 'Apellidos', render: (r) => <span className="font-black text-slate-900 uppercase">{r.apellidos}</span> },
    { header: 'Nombres', render: (r) => <span className="font-bold text-slate-700 uppercase">{r.nombres}</span> },
    { header: 'Fecha', render: (r) => <span className="text-slate-500 text-xs font-bold">{r.fechaSacramento}</span> },
    { header: 'Padres', render: (r) => <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{r.nombrePadre} / {r.nombreMadre}</span> },
    {
        header: 'Estado',
        render: (r) => (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-tighter ${r.status === 'anulada' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                {r.status === 'anulada' ? <XCircle className="w-3 h-3"/> : <CircleCheckBig className="w-3 h-3"/>}
                {r.status === 'anulada' ? 'Anulada' : 'Vigente'}
            </span>
        )
    }
  ];

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Base de Datos Central</h1>
                <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">Archivo Permanente • Sincronización en la Nube</p>
            </div>
            <div className="bg-slate-900 text-white px-6 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-2xl">Total en Archivo: {totalRecords}</div>
          </div>

          {/* BARRA DE BÚSQUEDA */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 items-center">
             <div className="relative flex-1">
                {isSearching ? <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4B7BA7] w-5 h-5 animate-spin" /> : <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />}
                <input type="text" placeholder="LOCALIZAR POR APELLIDOS, NOMBRES O PADRES..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-[#4B7BA7]/10 outline-none text-sm font-black uppercase placeholder:text-slate-300 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24"><Loader2 className="w-14 h-14 text-[#4B7BA7] animate-spin mb-4" /><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Consultando Supabase...</p></div>
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                <Table 
                    columns={columns} data={records} onRowClick={(row) => setSelectedPartida(row)}
                    actions={[
                        { label: <Eye className="w-4 h-4" />, onClick: (r, e) => { e.stopPropagation(); setSelectedPartida(r); setIsViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-yellow-50" },
                        { label: <Edit className="w-4 h-4" />, onClick: (r, e) => { e.stopPropagation(); navigate(`/parroquia/bautismo/editar?id=${r.id}`); }, className: "text-[#4B7BA7] hover:bg-blue-50" },
                        { label: <Trash2 className="w-4 h-4" />, onClick: (r, e) => { 
                            e.stopPropagation(); 
                            if(confirm("¿Está seguro de eliminar este registro permanentemente de la nube?")) supabase.from('baptisms').delete().eq('id', r.id).then(() => fetchRecords());
                        }, className: "text-red-500 hover:bg-red-50" }
                    ]}
                />
                <div className="bg-slate-50/50 border-t border-slate-100 px-10 py-5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</span>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl font-black uppercase text-[10px]">Anterior</Button>
                        <div className="h-4 w-px bg-slate-200" />
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="rounded-xl font-black uppercase text-[10px]">Siguiente</Button>
                    </div>
                </div>
            </div>
          )}

          <InfoBox data={selectedPartida} />
          
          {isViewModalOpen && (
              <ViewBaptismPartidaModal 
                  isOpen={isViewModalOpen} 
                  onClose={() => setIsViewModalOpen(false)} 
                  partida={selectedPartida} 
                  auxiliaryData={parishPrintData} 
              />
          )}
      </div>
    </DashboardLayout>
  );
};
export default BaptismPartidasPage;