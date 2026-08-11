import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import {
    Search, Edit, Database, BookOpen,
    Loader2, ChevronLeft, ChevronRight, MapPin, Trash2
} from 'lucide-react';

const BD_BautizosPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { obtenerNotasAlMargen, getParrocos } = useAppData();
    const { toast } = useToast();

    const topScrollRef = useRef(null);
    const tableContainerRef = useRef(null);

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    const [registrosTemporales, setRegistrosTemporales] = useState([]);
    const [registrosPermanentes, setRegistrosPermanentes] = useState([]);
    const [totalRegistros, setTotalRegistros] = useState(0);
    const [paginaActual, setPaginaActual] = useState(1);
    const registrosPorPagina = 50;
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState('temporales'); // 🚀 Abre directo en borradores

    // 🚀 1. RASTREADOR DEL ID REAL DE PARROQUIA
    useEffect(() => {
        const resolveParish = async () => {
            if (!user) return;
            let pId = user.parish_id || user.parishId;

            if (!pId && user.email) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('parish_id')
                    .eq('email', user.email)
                    .maybeSingle();
                if (profile) pId = profile.parish_id;
            }

            if (pId) {
                setResolvedParishId(pId);
                const { data: pData } = await supabase
                    .from('parishes')
                    .select('name')
                    .eq('id', pId)
                    .maybeSingle();
                if (pData?.name) setNombreParroquia(pData.name.toUpperCase());
            } else {
                setCargando(false);
            }
        };

        resolveParish();
    }, [user]);

    const getNombreParrocoActual = () => {
        if (!resolvedParishId) return '---';
        const lista = getParrocos(resolvedParishId) || [];
        const actual = lista.find(p => String(p.estado) === '1');
        return actual ? `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() : '---';
    };

    const getFechaHoyLetras = () => {
        try {
            const hoy = new Date().toISOString().split('T')[0];
            return convertDateToSpanishTextNatural(hoy).replace(/^EL\s+/i, '').toUpperCase();
        } catch (e) { return "FECHA ACTUAL"; }
    };

    const purificarRegistro = (raw) => {
        if (!raw) return null;
        const pId = raw.parishId || raw.parish_id || resolvedParishId;
        const config = obtenerNotasAlMargen(pId) || {};
        
        const noteTextRaw = raw.notaMarginal || raw.margin_note || raw.marginNote || '';
        const noteText = String(noteTextRaw).toUpperCase();

        let identityId = 'id_estandar'; 

        if (raw.status === 'anulada' || raw.estado === 'anulada' || raw.isAnnulled === true || String(raw.tipoNotaAlMargen).includes('anulada') || noteText.includes('PARTIDA ANULADA')) {
            identityId = 'id_anulada_correccion';
        } else if (raw.creadoPorDecreto || raw.isSupplementary || raw.hasDecree || raw.correctionDecreeRef || noteText.includes('SE INSCRIBIÓ SEGÚN DECRETO')) {
            identityId = 'id_creada_correccion';
        } else if (raw.replacementDecreeRef || String(raw.tipoNotaAlMargen).includes('Reposicion') || noteText.includes('POR REPOSICIÓN')) {
            identityId = 'id_creada_reposicion';
        } else if (noteText.includes('CONTRAJO MATRIMONIO') || noteText.includes('NOTIFICACIÓN DE MATRIMONIO')) {
            identityId = 'id_notaMatrimonio';
        } else if (raw.tipoIdentidad && raw.tipoIdentidad !== 'id_estandar') {
            identityId = raw.tipoIdentidad; 
        }
        
        const fullDateTime = raw.fechaSacramento || raw.sacramentDate || '';
        let fechaSolo = fullDateTime;
        let horaSolo = '---';

        if (fullDateTime.includes('T')) {
            const parts = fullDateTime.split('T');
            fechaSolo = parts[0];
            horaSolo = parts[1];
        }

        let notaCalculada = "";
        
        if (noteTextRaw && String(noteTextRaw).trim() !== '' && !String(noteTextRaw).includes('[NUMERO_DECRETO]')) {
            notaCalculada = String(noteTextRaw).toUpperCase();
        } else {
            switch (identityId) {
                case 'id_anulada_correccion': 
                    notaCalculada = (config.porCorreccion?.anulada || "ANULADA POR CORRECCIÓN.")
                        .replace(/\[NUMERO_DECRETO\]/g, raw.annulmentDecree || '---'); 
                    break;
                case 'id_creada_correccion': 
                    notaCalculada = (config.porCorreccion?.nuevaPartida || "CREADA POR CORRECCIÓN.")
                        .replace(/\[NUMERO_DECRETO\]/g, raw.correctionDecreeRef || raw.decreeNumber || '---');
                    break;
                case 'id_creada_reposicion': 
                    notaCalculada = (config.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || "CREADA POR REPOSICIÓN.")
                        .replace(/\[NUMERO_DECRETO\]/g, raw.replacementDecreeRef || raw.decreeNumber || '---');
                    break;
                case 'id_notaMatrimonio': 
                    notaCalculada = config.porNotificacionMatrimonial?.textoParaPartidaOriginal || "CONTRAJO MATRIMONIO."; 
                    break;
                default: 
                    notaCalculada = config.estandar || "ES COPIA FIEL DEL ORIGINAL."; 
                    break;
            }
        }

        const notaFinalConFecha = notaCalculada.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras());

        return {
            id: raw.id || null,
            tipoIdentidad: identityId, 
            numeroRegistro: raw.numeroRegistro || '---', 
            direccion: String(raw.direccion || '---').toUpperCase(), 
            Libro: String(raw.Libro || raw.numeroLibro || raw.book_number || '0').padStart(4, '0'),
            folio: String(raw.folio || raw.page_number || '0').padStart(4, '0'),
            numero: String(raw.numero || raw.numeroActa || raw.entry_number || '0').padStart(4, '0'),
            nombres: String(raw.nombres || raw.firstName || '').toUpperCase(),
            apellidos: String(raw.apellidos || raw.lastName || '').toUpperCase(),
            sexo: String(raw.sexo || raw.sex || 'MASCULINO').toUpperCase(),
            fechaNacimiento: raw.fechaNacimiento || raw.birthDate || '---',
            fechaSacramento: fechaSolo, 
            horaSacramento: horaSolo,   
            lugarNacimiento: String(raw.lugarNacimiento || raw.placeOfBirth || '---').toUpperCase(),
            lugarBautismo: String(raw.lugarBautismo || raw.placeOfSacrament || '---').toUpperCase(),
            nombrePadre: String(raw.nombrePadre || raw.fatherName || '---').toUpperCase(),
            cedulaPadre: raw.cedulaPadre || raw.fatherId || '---',
            nombreMadre: String(raw.nombreMadre || raw.motherName || '---').toUpperCase(),
            cedulaMadre: raw.cedulaMadre || raw.motherId || '---',
            tipoUnionPadres: String(raw.tipo_union_padres || raw.tipoUnionPadres || raw.parentalUnion || '---').toUpperCase(),
            abuelosPaternos: String(raw.abuelosPaternos || raw.paternalGrandparents || '---').toUpperCase(),
            abuelosMaternos: String(raw.abuelosMaternos || raw.maternalGrandparents || '---').toUpperCase(),
            ministro: String(raw.ministro || raw.minister || '---').toUpperCase(),
            padrinos: String(raw.padrinos || raw.godparents || '---').toUpperCase(),
            daFe: getNombreParrocoActual(),
            serialRegistro: raw.serialRegistro || '---',
            nuip: raw.nuip || '---',
            oficinaRegistro: raw.oficinaRegistro || '---',
            fechaExpedicionRegistro: raw.fechaExpedicionRegistro || '---',
            notaMarginal: notaFinalConFecha.toUpperCase(),
            estado: raw.status || 'seated'
        };
    };

    const handleDeleteTemporal = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este borrador de la nube? El correlativo regresará al número anterior.")) return;

        try {
            const { error: deleteError } = await supabase
                .from('pending_baptisms')
                .delete()
                .eq('id', id);
                
            if (deleteError) throw deleteError;

            // Decrementar correlativo
            const { data } = await supabase
                .from('parish_parameters')
                .select('bautizos_params')
                .eq('parish_id', resolvedParishId)
                .maybeSingle();

            if (data?.bautizos_params?.numeroRegistroActual) {
                const currentParams = data.bautizos_params;
                const currentNum = parseInt(currentParams.numeroRegistroActual, 10) || 0;
                const prevNum = Math.max(1, currentNum - 1);

                const updatedParams = {
                    ...currentParams,
                    numeroRegistroActual: String(prevNum).padStart(6, '0')
                };

                await supabase.from('parish_parameters').update({ bautizos_params: updatedParams }).eq('parish_id', resolvedParishId);
            }

            setRegistrosTemporales(prev => prev.filter(r => r.id !== id));
            toast({
                title: "Borrador Eliminado",
                description: "Eliminado de la nube y correlativo restaurado.",
                className: "bg-amber-50 border-amber-200 text-amber-900"
            });
        } catch (err) {
            console.error("Error borrando registro temporal:", err);
            toast({ title: "Error", description: "No se pudo eliminar de la nube.", variant: "destructive" });
        }
    };

    // 🚀 2. CONSULTA DIRECTA Y DECODIFICADA DE SUPABASE
    const fetchData = async () => {
        if (!resolvedParishId) return;
        setCargando(true);
        try {
            // 1. Obtener Registros Permanentes
            const { data: permData, count, error: permError } = await supabase
                .from('baptisms')
                .select('*', { count: 'exact' })
                .eq('parish_id', resolvedParishId)
                .order('entry_number', { ascending: false })
                .range((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina - 1);

            if (permError) throw permError;

            if (permData) {
                setRegistrosPermanentes(permData.map(r => {
                    const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
                    return purificarRegistro({
                        ...raw, 
                        id: r.id, 
                        status: r.status, 
                        tipo_union_padres: r.tipo_union_padres, 
                        margin_note: r.margin_note
                    });
                }));
                setTotalRegistros(count || 0);
            }

            // 2. Obtener Registros Temporales (Borradores)
            const { data: tempData, error: tempError } = await supabase
                .from('pending_baptisms')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .order('created_at', { ascending: false });
                
            if (tempError) throw tempError;

            if (tempData) {
                setRegistrosTemporales(tempData.map(r => {
                    const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
                    return purificarRegistro({
                        ...raw, 
                        id: r.id, 
                        status: 'pending'
                    });
                }));
            }
        } catch (err) { 
            console.error("Error cargando base de datos:", err); 
        } finally { 
            setCargando(false); 
        }
    };

    useEffect(() => { 
        if (resolvedParishId) {
            fetchData(); 
        }
    }, [resolvedParishId, paginaActual]);

    const handleTopScroll = () => { if (topScrollRef.current && tableContainerRef.current) tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft; };
    const handleTableScroll = () => { if (topScrollRef.current && tableContainerRef.current) topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft; };

    const columns = [
        { header: 'ID', render: (r) => <span className="text-[9px] font-bold text-gray-400">#{r.numeroRegistro}</span> },
        { header: 'IDENTIDAD', render: (r) => <span className="px-3 py-1 rounded-md text-[9px] font-black bg-slate-900 text-white uppercase">{r.tipoIdentidad.replace('id_', '').replace(/_/g, ' ')}</span> },
        { header: 'L:F:A', render: (r) => <span className="font-mono text-xs font-black text-blue-700">{r.Libro}:{r.folio}:{r.numero}</span> },
        { header: 'APELLIDOS', render: (r) => <span className="font-black text-gray-950 text-xs uppercase">{r.apellidos}</span> },
        { header: 'NOMBRES', render: (r) => <span className="font-bold text-gray-800 text-xs uppercase">{r.nombres}</span> },
        { header: 'FECHA', render: (r) => <span className="text-[10px] font-black text-blue-900">{r.fechaSacramento}</span> },
        { header: 'HORA', render: (r) => <span className="text-[10px] font-bold text-amber-600 italic">{r.horaSacramento}</span> },
        { header: 'DIRECCIÓN', render: (r) => <div className="flex items-center gap-1 min-w-[150px]"><MapPin className="w-3 h-3 text-gray-300" /><span className="text-[10px] text-gray-500 font-bold uppercase">{r.direccion}</span></div> },
        { header: 'PADRE / CÉDULA', render: (r) => <div className="flex flex-col"><span className="text-[10px] font-black uppercase">{r.nombrePadre}</span><span className="text-[9px] font-mono text-gray-400">{r.cedulaPadre}</span></div> },
        { header: 'MADRE / CÉDULA', render: (r) => <div className="flex flex-col"><span className="text-[10px] font-black uppercase">{r.nombreMadre}</span><span className="text-[9px] font-mono text-gray-400">{r.cedulaMadre}</span></div> },
        { header: 'ESTADO CIVIL', render: (r) => <span className="text-[10px] font-bold text-amber-700 uppercase">{r.tipoUnionPadres}</span> },
        { header: 'MINISTRO', render: (r) => <span className="text-[10px] font-bold text-gray-700 uppercase">{r.ministro}</span> },
        { header: 'DA FE (ACTUAL)', render: (r) => <span className="text-[10px] font-black text-blue-600 uppercase">{r.daFe}</span> },
        { header: 'NUIP', render: (r) => <span className="text-[10px] font-mono font-bold text-gray-400">{r.nuip}</span> },
        {
            header: 'NOTA MARGINAL PROCESADA',
            render: (r) => (
                <div className="bg-blue-50/50 p-2 rounded border border-blue-100 min-w-[600px]">
                    <span className="text-[11px] font-bold text-blue-800 leading-tight block whitespace-normal uppercase">
                        {r.notaMarginal}
                    </span>
                </div>
            )
        },
    ];

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-[100vw] px-4 md:px-8 space-y-4 pb-20">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20"><Database className="w-6 h-6" /></div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">Base de Datos Central</h1>
                            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">{nombreParroquia} • Sincronización en Tiempo Real</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col">
                    <Tabs value={tabActiva} onValueChange={setTabActiva}>
                        <TabsList className="w-full justify-start rounded-none border-b bg-gray-50/50 p-2 h-14">
                            <TabsTrigger value="temporales" className="px-8 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                Borradores (Temporales) ({registrosTemporales.length})
                            </TabsTrigger>
                            <TabsTrigger value="permanentes" className="px-8 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                Permanentes ({totalRegistros})
                            </TabsTrigger>
                        </TabsList>

                        <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden h-4 bg-gray-100/50 border-b border-gray-200">
                            <div style={{ width: '5000px', height: '1px' }}></div>
                        </div>

                        <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-auto max-h-[65vh] custom-scrollbar">
                            <div className="min-w-[5000px]">
                                <TabsContent value="temporales" className="p-0 m-0">
                                    {cargando ? (
                                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" /></div>
                                    ) : (
                                        <Table
                                            columns={columns}
                                            data={registrosTemporales}
                                            actions={[
                                                { label: 'Asentar', icon: <BookOpen className="w-4 text-blue-600" />, onClick: (r) => navigate(`/parroquia/bautismo/sentar-registros`) },
                                                { label: 'Eliminar', icon: <Trash2 className="w-4 text-red-500" />, onClick: (r) => handleDeleteTemporal(r.id) }
                                            ]}
                                        />
                                    )}
                                </TabsContent>
                                <TabsContent value="permanentes" className="p-0 m-0">
                                    {cargando ? (
                                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" /></div>
                                    ) : (
                                        <Table
                                            columns={columns}
                                            data={registrosPermanentes}
                                            actions={[
                                                { label: 'Editar', icon: <Edit className="w-4" />, onClick: (r) => navigate(`/parroquia/bautismo/editar?id=${r.id}`) }
                                            ]}
                                        />
                                    )}
                                </TabsContent>
                            </div>
                        </div>
                    </Tabs>

                    <div className="p-4 bg-gray-50/80 flex justify-between items-center border-t border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Página Actual: {paginaActual} — Registros: {tabActiva === 'permanentes' ? totalRegistros : registrosTemporales.length}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setPaginaActual(p => p - 1)} disabled={paginaActual === 1} className="rounded-xl h-8"><ChevronLeft className="w-4 h-4" /></Button>
                            <Button variant="ghost" onClick={() => setPaginaActual(p => p + 1)} disabled={paginaActual * registrosPorPagina >= totalRegistros} className="rounded-xl h-8"><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BD_BautizosPage;