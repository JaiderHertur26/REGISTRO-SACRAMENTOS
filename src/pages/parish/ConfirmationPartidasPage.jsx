import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { 
    Search, Edit, Trash2, Info, 
    CheckCircle as CircleCheckBig, XCircle, Eye, AlertOctagon, 
    BookOpen, Loader2, User, Users, MapPin, PenTool, Scroll, ShieldCheck, Droplet, Calendar 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewConfirmationPartidaModal from '@/components/modals/ViewConfirmationPartidaModal';

// --- COMPONENTE: PANEL DE DETALLES EXTENDIDO (INSPECCIÓN PARROQUIAL) ---
const InfoBox = ({ data, parishId, getParrocos }) => {
    if (!data) return null;
    
    const isReplacement = data.isSupplementary || data.tipoIdentidad === 'id_creada_reposicion' || data.newBaptismIdRepo;

    // 🚀 RESOLUCIÓN INTELIGENTE DEL PÁRROCO QUE DA FE (MÁQUINA DEL TIEMPO)
    const getResolvedDaFe = () => {
        let rawDaFe = data.daFe || data.dafe || data.da_fe || data.ministerFaith;
        
        if (!rawDaFe || rawDaFe === '---' || rawDaFe.includes('ENCARGADO') || !isNaN(Number(String(rawDaFe).trim()))) {
            if (parishId && getParrocos) {
                const sacerdotes = getParrocos(parishId) || [];
                const fechaRaw = data.fechaSacramento || data.celebration_date || data.sacramentDate;
                if (fechaRaw) {
                    const fechaSac = new Date(fechaRaw.includes('T') ? fechaRaw : `${fechaRaw}T12:00:00`);
                    const sacerdoteEpoca = sacerdotes.find(s => {
                        if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                        const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                        const inicio = new Date(iStr);
                        const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                        return fechaSac >= inicio && fechaSac <= fin;
                    });
                    if (sacerdoteEpoca) rawDaFe = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
                }
                
                if (!rawDaFe || rawDaFe === '---' || !isNaN(Number(String(rawDaFe).trim()))) {
                    const actual = sacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
                    if (actual) rawDaFe = `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase();
                }
            }
        }
        
        if (!rawDaFe || !isNaN(Number(String(rawDaFe).trim()))) rawDaFe = 'EL PÁRROCO';
        rawDaFe = String(rawDaFe).replace(/^(PBRO\.?\s*|PADRE\s*|SACERDOTE\s*)/i, '').trim();
        return rawDaFe !== 'EL PÁRROCO' ? `PBRO. ${rawDaFe}` : rawDaFe;
    };

    // 🚀 RESOLUCIÓN DE MINISTRO (OBISPO/DELEGADO)
    const getResolvedMinistro = () => {
        let min = data.ministro || data.minister;
        if (!min || !isNaN(Number(String(min).trim()))) return '---';
        min = String(min).toUpperCase().trim();
        if (!min.includes('MONS') && !min.includes('EXCMO') && !min.includes('PBRO')) {
            return `MONS. ${min}`;
        }
        return min;
    };

    return (
        <div className="mt-8 border border-slate-200/80 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-red-900 px-8 py-5 flex justify-between items-center">
                <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                    <Info className="w-4 h-4 text-[#D4AF37]" /> Inspección de Registro Parroquial
                </h3>
                {isReplacement && (
                    <span className="bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <AlertOctagon className="w-3 h-3"/> Acta por Decreto
                    </span>
                )}
            </div>

            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Localización Física</span>
                        <span className="text-base font-black text-red-600 font-mono bg-white px-4 py-2 rounded-xl border border-red-100 inline-block shadow-sm">
                            L:{data.Libro} • F:{data.folio} • N:{data.numero}
                        </span>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Confirmado (Apellidos y Nombres)</span>
                        <span className="text-xl font-black text-slate-900 uppercase tracking-tight block">
                            {data.apellidos} {data.nombres}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DetailItem icon={MapPin} label="Lugar Nacimiento" value={data.lugarNacimiento} />
                    <DetailItem icon={User} label="Fecha Nacimiento" value={data.fechaNacimiento || data.birthDate} />
                    <DetailItem icon={MapPin} label="Lugar Confirmación" value={data.lugarSacramento || data.place} />
                    <DetailItem icon={Calendar} label="Fecha Confirmación" value={data.fechaSacramento || data.sacramentDate} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50/20 p-6 rounded-[2rem] border border-blue-100/50 space-y-4">
                        <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-blue-600" /> Línea Paterna
                        </h4>
                        <DetailItem label="Padre" value={data.nombrePadre || data.fatherName} />
                        <DetailItem label="Abuelos Paternos" value={data.abuelosPaternos} isItalic />
                    </div>
                    <div className="bg-pink-50/20 p-6 rounded-[2rem] border border-pink-100/50 space-y-4">
                        <h4 className="text-[10px] font-black text-pink-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-pink-600" /> Línea Materna
                        </h4>
                        <DetailItem label="Madre" value={data.nombreMadre || data.motherName} />
                        <DetailItem label="Abuelos Maternos" value={data.abuelosMaternos} isItalic />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <DetailItem icon={Droplet} label="Lugar Bautismo Origen" value={data.lugarBautismo || data.baptismPlace} />
                    <DetailItem icon={Users} label="Padrinos" value={data.padrinos || data.godparents} />
                    <DetailItem icon={PenTool} label="Ministro Celebrante" value={getResolvedMinistro()} />
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#D4AF37]" /> Párroco que Da Fe
                        </span>
                        <span className="text-xs font-black text-red-600 uppercase bg-white px-3 py-1.5 rounded-xl border border-red-100 inline-block shadow-sm">
                            {getResolvedDaFe()}
                        </span>
                    </div>
                </div>

                <div className="p-6 rounded-[2rem] border bg-amber-50/30 border-amber-200/60 shadow-sm">
                    <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" /> Nota Marginal / Observaciones
                    </h4>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed font-mono uppercase italic whitespace-pre-wrap">
                        {data.notaMarginal || data.observations || 'SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ icon: Icon, label, value, isItalic = false }) => (
    <div className="space-y-1 text-left">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3 text-slate-400" />} {label}
        </span>
        <span className={`text-xs font-bold text-slate-800 uppercase block ${isItalic ? 'italic font-medium text-slate-500' : ''}`}>
            {value || '---'}
        </span>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
const ConfirmationPartidasPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, getParrocos } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [records, setRecords] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 50;
    
    const [selectedPartida, setSelectedPartida] = useState(null); 
    const [parishPrintData, setParishPrintData] = useState({});
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

    const totalPages = Math.ceil(totalRecords / recordsPerPage);

    useEffect(() => {
        if (parishId) {
            const misDatos = getMisDatosList(parishId);
            if (misDatos?.length > 0) setParishPrintData(misDatos[0]);
        }
    }, [parishId, getMisDatosList]);

    const fetchRecords = async () => {
        if (!parishId) return;
        setIsLoading(true);

        try {
            // 🚀 CONSULTA DIRECTA A SUPABASE (CONFIRMATIONS)
            const { data, error } = await supabase
                .from('confirmations')
                .select('*')
                .eq('parish_id', parishId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Procesamiento Híbrido
            const processedData = (data || []).map(r => {
                const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
                return {
                    ...raw,
                    id: r.id,
                    status: r.status || 'seated',
                    Libro: r.book_number || raw.Libro || raw.libro || '---',
                    folio: r.folio || raw.folio || raw.page_number || '---',
                    numero: r.number || raw.numero || raw.entry_number || '---',
                    apellidos: r.apellidos || raw.apellidos || raw.lastName || '',
                    nombres: r.nombres || raw.nombres || raw.firstName || '',
                    fechaSacramento: r.celebration_date || raw.fechaSacramento || raw.sacramentDate || '',
                    nombrePadre: r.nombre_padre || raw.nombrePadre || raw.fatherName || '',
                    nombreMadre: r.nombre_madre || raw.nombreMadre || raw.motherName || '',
                };
            });

            let filtered = processedData;
            if (searchTerm.trim()) {
                const term = searchTerm.trim().toUpperCase();
                filtered = filtered.filter(r => 
                    (r.nombres && r.nombres.includes(term)) ||
                    (r.apellidos && r.apellidos.includes(term)) ||
                    (r.nombrePadre && r.nombrePadre.includes(term)) ||
                    (r.nombreMadre && r.nombreMadre.includes(term)) ||
                    (`${r.Libro}:${r.folio}:${r.numero}`.includes(term))
                );
            }

            setTotalRecords(filtered.length);
            const from = (currentPage - 1) * recordsPerPage;
            setRecords(filtered.slice(from, from + recordsPerPage));

            if (selectedPartida) {
                const updated = filtered.find(r => r.id === selectedPartida.id);
                if (updated) setSelectedPartida(updated);
            }
        } catch (err) {
            console.error("Error al consultar partidas:", err);
            toast({ title: "Error", description: "No se pudieron cargar los registros de confirmación.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [parishId, searchTerm, currentPage]);

    const columns = [
        { 
            header: 'Archivo',
            render: (r) => <span className="font-black text-[12px] text-red-600 bg-red-50 px-2.5 py-1 rounded-xl border border-red-100 uppercase text-center min-w-[110px] inline-block shadow-sm">L:{r.Libro} F:{r.folio} N:{r.numero}</span>
        },
        { header: 'Apellidos', render: (r) => <span className="font-black text-slate-900 uppercase text-xs">{r.apellidos}</span> },
        { header: 'Nombres', render: (r) => <span className="font-black text-slate-900 uppercase text-xs">{r.nombres}</span> },
        { header: 'Fecha', render: (r) => <span className="font-black text-slate-900 uppercase text-xs">{r.fechaSacramento}</span> },    
        {
            header: 'Estado',
            render: (r) => {
                const isAnnulled = r.status === 'anulada' || r.isAnnulled;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-tighter ${isAnnulled ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                        {isAnnulled ? <XCircle className="w-3 h-3"/> : <CircleCheckBig className="w-3 h-3"/>}
                        {isAnnulled ? 'Anulada' : 'Vigente'}
                    </span>
                )
            }
        }
    ];

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-[1600px] mx-auto space-y-6 pb-20 pt-2">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase font-serif">Partidas de Confirmación</h1>
                        <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">{nombreParroquia} • Archivo Parroquial Permanente</p>
                    </div>
                    <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                        Total en Archivo: {totalRecords}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="LOCALIZAR POR APELLIDOS, NOMBRES, PADRES O LIBRO:FOLIO:NÚMERO..." 
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-red-600/10 outline-none text-xs font-black uppercase placeholder:text-slate-300 transition-all" 
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border border-slate-100">
                        <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Consultando Libro de Confirmaciones...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-16 text-center shadow-sm">
                        <Scroll className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold uppercase text-slate-700">No hay actas registradas</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Las confirmaciones aparecerán aquí una vez que hayan sido firmadas y selladas.</p>
                        <Button variant="outline" className="mt-6 rounded-xl font-black uppercase text-[10px] text-red-600 border-red-200 hover:bg-red-50" onClick={() => navigate('/parroquia/confirmacion/sentar-registros')}>
                            Ir a Sentar Registros
                        </Button>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-red-900/5 border border-slate-100 overflow-hidden">
                        <Table 
                            columns={columns} 
                            data={records} 
                            onRowClick={(row) => setSelectedPartida(row)}
                            actions={[
                                { label: <Eye className="w-4 h-4" />, onClick: (r, e) => { e.stopPropagation(); setSelectedPartida(r); setIsViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-yellow-50", title: "Ver Partida" },
                                { label: <Edit className="w-4 h-4" />, onClick: (r, e) => { e.stopPropagation(); navigate(`/parroquia/confirmacion/editar?id=${r.id}`); }, className: "text-red-600 hover:bg-red-50", title: "Editar" },
                                { label: <Trash2 className="w-4 h-4" />, onClick: (r, e) => { 
                                    e.stopPropagation(); 
                                    if(confirm("¿Está seguro de eliminar esta confirmación permanentemente de la nube?")) {
                                        supabase.from('confirmations').delete().eq('id', r.id).then(() => fetchRecords());
                                    }
                                }, className: "text-red-500 hover:bg-red-50", title: "Eliminar" }
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

                <InfoBox data={selectedPartida} parishId={parishId} getParrocos={getParrocos} />
                
                {isViewModalOpen && (
                    <ViewConfirmationPartidaModal 
                        isOpen={isViewModalOpen} 
                        onClose={() => setIsViewModalOpen(false)} 
                        partida={selectedPartida} 
                        auxiliaryData={{ ...parishPrintData, diocese: user?.dioceseName || 'DIÓCESIS', city: user?.city || 'CIUDAD' }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
};

export default ConfirmationPartidasPage;