import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { 
    Search, Church, Calendar, BookOpen, 
    Loader2, Globe, MapPin, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const UnifiedSearchPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [searchLoading, setSearchLoading] = useState(false);
    const [diocesesList, setDiocesesList] = useState([]);
    const [misDatosList, setMisDatosList] = useState([]); 

    const [searchParams, setSearchParams] = useState({ 
        firstName: '', lastName: '', sacramentType: '', 
        dateStart: '', dateEnd: '', dioceseId: '', parishId: 'all' 
    });
    
    const [results, setResults] = useState(null);
    const [filteredParishes, setFilteredParishes] = useState([]);

    const nombreEntidad = user?.parishName || user?.parish_name || 'BÚSQUEDA CENTRAL';

    // 🚀 1. CARGA INICIAL
    useEffect(() => {
        const fetchInitialEntities = async () => {
            try {
                const [dioRes, misRes] = await Promise.all([
                    supabase.from('dioceses').select('id, name').order('name', { ascending: true }),
                    supabase.from('mis_datos').select('entity_id, payload')
                ]);

                if (dioRes.data) setDiocesesList(dioRes.data);
                if (misRes.data) setMisDatosList(misRes.data);
            } catch (error) {
                console.error("Error cargando entidades iniciales:", error);
                toast({ title: "Error de conexión", description: "No se pudieron cargar las jurisdicciones.", variant: "destructive" });
            }
        };
        fetchInitialEntities();
    }, [toast]);

    // 🚀 2. CARGAR PARROQUIAS
    useEffect(() => {
        const loadParishes = async () => {
            if (!searchParams.dioceseId || searchParams.dioceseId === 'all') {
                setFilteredParishes([]); 
                return;
            }
            try {
                const { data } = await supabase
                    .from('parishes')
                    .select('id, name, city, address, diocese_id')
                    .eq('diocese_id', searchParams.dioceseId)
                    .order('name', { ascending: true });
                
                if (data) setFilteredParishes(data);
            } catch (error) {
                console.error("Error cargando parroquias:", error);
            }
        };
        loadParishes();
    }, [searchParams.dioceseId]);

    const dioceseOptions = useMemo(() => [{ id: 'all', name: 'TODAS LAS DIÓCESIS (GLOBAL)' }, ...diocesesList], [diocesesList]);

    const sacramentOptions = [
        { value: 'baptism', label: 'BAUTISMO' },
        { value: 'confirmation', label: 'CONFIRMACIÓN' }
        // Se omiten matrimonios por ahora según instrucción
    ];

    // 🚀 3. EL BUSCADOR (BASADO 100% EN TU CÓDIGO FUNCIONAL)
    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!searchParams.dioceseId) {
            toast({ title: "Campo Requerido", description: "Seleccione una Diócesis para filtrar.", variant: "destructive" });
            return;
        }
        if (!searchParams.firstName.trim() && !searchParams.lastName.trim()) { 
            toast({ title: "Atención", description: "Ingrese Nombres o Apellidos para realizar la búsqueda.", variant: "destructive" }); 
            return; 
        }
        
        setSearchLoading(true);
        setResults(null);

        try {
            let isGlobal = searchParams.dioceseId === 'all';
            let queryParishIds = [];

            if (!isGlobal) {
                if (searchParams.parishId && searchParams.parishId !== 'all') {
                    queryParishIds = [searchParams.parishId];
                } else {
                    queryParishIds = filteredParishes.map(p => p.id);
                }

                if (queryParishIds.length === 0) {
                    setResults([]);
                    setSearchLoading(false);
                    return;
                }
            }

            const type = searchParams.sacramentType;
            const fetchPromises = [];
            
            const tablesToSearch = [];
            if (!type || type === 'baptism') tablesToSearch.push({ name: 'baptisms', label: 'BAUTISMO' });
            if (!type || type === 'confirmation') tablesToSearch.push({ name: 'confirmations', label: 'CONFIRMACIÓN' });

            // CONSULTA DIRECTA A SUPABASE (Como en ConfirmationPartidasPage)
            tablesToSearch.forEach(table => {
                let q = supabase.from(table.name).select('*');
                
                if (!isGlobal && queryParishIds.length > 0) {
                    if (queryParishIds.length === 1) {
                        q = q.eq('parish_id', queryParishIds[0]);
                    } else {
                        q = q.in('parish_id', queryParishIds);
                    }
                }
                
                q = q.limit(15000); // Límite seguro para no saturar memoria
                fetchPromises.push(q.then(res => ({ typeLabel: table.label, data: res.data || [] })));
            });

            const fetchedResults = await Promise.all(fetchPromises);

            // PROCESAMIENTO HÍBRIDO (El secreto de tu código)
            let allProcessedData = [];

            fetchedResults.forEach(fetchResult => {
                const tableProcessed = fetchResult.data.map(r => {
                    // Esta es la línea clave que tienes en ConfirmationPartidasPage
                    const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
                    
                    return {
                        id: r.id,
                        parishId: r.parish_id,
                        type: fetchResult.typeLabel,
                        status: r.status || 'vigente',
                        Libro: r.book_number || raw.Libro || raw.libro || '---',
                        folio: r.folio || raw.folio || raw.page_number || '---',
                        numero: r.number || raw.numero || raw.entry_number || '---',
                        // Unificamos nombres desde columna o JSON crudo
                        apellidos: (r.apellidos || raw.apellidos || raw.lastName || '').toUpperCase(),
                        nombres: (r.nombres || raw.nombres || raw.firstName || '').toUpperCase(),
                        fechaSacramento: r.celebration_date || raw.fechaSacramento || raw.sacramentDate || raw.fechaBautismo || raw.fechaConfirmacion || ''
                    };
                });
                
                allProcessedData = [...allProcessedData, ...tableProcessed];
            });

            // Mapear info de las parroquias encontradas
            let allParishesRef = [...filteredParishes];
            if (isGlobal) {
                let allFoundParishIds = new Set(allProcessedData.map(d => d.parishId).filter(Boolean));
                if (allFoundParishIds.size > 0) {
                    const { data: missingParishes } = await supabase.from('parishes').select('id, name, city, address, diocese_id').in('id', Array.from(allFoundParishIds));
                    if (missingParishes) allParishesRef = missingParishes;
                }
            }

            // Normalizador de texto
            const normalizeText = (str) => {
                if (!str) return '';
                return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ' ').trim();
            };

            const termFirst = normalizeText(searchParams.firstName);
            const termLast = normalizeText(searchParams.lastName);

            // FILTRADO JAVASCRIPT (Idéntico al .filter() de tu componente)
            let finalFiltered = allProcessedData.filter(r => {
                const nom = normalizeText(r.nombres);
                const ape = normalizeText(r.apellidos);

                if (termFirst && !nom.includes(termFirst)) return false;
                if (termLast && !ape.includes(termLast)) return false;

                // Filtro de fechas
                if (searchParams.dateStart || searchParams.dateEnd) {
                    if (!r.fechaSacramento) return false;
                    
                    let rTime;
                    const rStr = String(r.fechaSacramento).trim();
                    if (rStr.includes('/')) {
                        const parts = rStr.split('/');
                        rTime = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`).getTime();
                    } else {
                        rTime = new Date(rStr.includes('T') ? rStr : `${rStr}T12:00:00`).getTime();
                    }

                    if (isNaN(rTime)) return false;

                    if (searchParams.dateStart) {
                        const sTime = new Date(`${searchParams.dateStart}T00:00:00`).getTime();
                        if (rTime < sTime) return false;
                    }
                    if (searchParams.dateEnd) {
                        const eTime = new Date(`${searchParams.dateEnd}T23:59:59`).getTime();
                        if (rTime > eTime) return false;
                    }
                }

                return true;
            });

            // Enriquecer con datos de la parroquia
            const enrichedResults = [];
            finalFiltered.forEach(record => {
                const parish = allParishesRef.find(p => p.id === record.parishId);
                if (!parish) return;

                let parishAddress = parish.address || 'Dirección no registrada';
                if (parishAddress === 'Dirección no registrada') {
                    const misDatosMatch = misDatosList.find(md => md.entity_id === parish.id);
                    if (misDatosMatch) {
                        let pData = misDatosMatch.payload;
                        if (typeof pData === 'string') {
                            try { pData = JSON.parse(pData); } catch(e) { pData = {}; }
                        }
                        if (Array.isArray(pData)) pData = pData[0] || {};
                        if (pData.direccion && pData.direccion.trim() !== '') parishAddress = pData.direccion;
                    }
                }

                enrichedResults.push({
                    ...record,
                    parishName: parish.name,
                    city: parish.city || '',
                    dioceseId: parish.diocese_id || parish.dioceseId,
                    parishAddress
                });
            });

            // Ordenar de más reciente a más antiguo
            enrichedResults.sort((a, b) => new Date(b.fechaSacramento || 0) - new Date(a.fechaSacramento || 0));
            
            setResults(enrichedResults);
            
        } catch (error) {
            console.error("Error consultando Supabase:", error);
            toast({ title: "Error de Búsqueda", description: "Ocurrió un error al conectar con los servidores.", variant: "destructive" });
        } finally {
            setSearchLoading(false);
        }
    };

    return (
        <DashboardLayout entityName={nombreEntidad}>
            <Helmet><title>Buscador Unificado | Eclesia Digital</title></Helmet>

            <div className="max-w-5xl mx-auto py-8">
                <header className="mb-8 lg:mb-12">
                    <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                        <Globe className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Herramienta de Verificación Global</span>
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">Buscador Unificado de Sacramentos</h1>
                    <p className="text-gray-500 font-medium mt-2 text-sm lg:text-base">Localice actas en los archivos digitales de su Diócesis o a nivel Nacional.</p>
                </header>

                <section className="bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-xl shadow-blue-900/5 p-6 lg:p-8 border border-gray-100 mb-12">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Diócesis <span className="text-red-500">*</span></label>
                            <select 
                                required 
                                value={searchParams.dioceseId} 
                                onChange={e => setSearchParams({...searchParams, dioceseId: e.target.value, parishId: 'all'})} 
                                className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]"
                            >
                                <option value="">-- SELECCIONE UN ALCANCE --</option>
                                {dioceseOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Parroquia</label>
                            <select 
                                disabled={!searchParams.dioceseId || searchParams.dioceseId === 'all'} 
                                value={searchParams.parishId} 
                                onChange={e => setSearchParams({...searchParams, parishId: e.target.value})} 
                                className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none disabled:opacity-30 focus:ring-2 focus:ring-[#D4AF37]"
                            >
                                <option value="all">-- TODAS LAS PARROQUIAS --</option>
                                {filteredParishes.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.city ? `- ${p.city}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo de Acta</label>
                            <select value={searchParams.sacramentType} onChange={e => setSearchParams({...searchParams, sacramentType: e.target.value})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]">
                                <option value="">BAUTISMO Y CONFIRMACIÓN</option>
                                {sacramentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres</label>
                            <input type="text" value={searchParams.firstName} onChange={e => setSearchParams({...searchParams, firstName: e.target.value})} placeholder="EJ: PEDRO PABLO" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase focus:ring-2 focus:ring-[#D4AF37]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                            <input type="text" value={searchParams.lastName} onChange={e => setSearchParams({...searchParams, lastName: e.target.value})} placeholder="EJ: ROJAS PEREZ" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase focus:ring-2 focus:ring-[#D4AF37]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Desde</label>
                                <input type="date" value={searchParams.dateStart} onChange={e => setSearchParams({...searchParams, dateStart: e.target.value})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-[10px] outline-none focus:ring-2 focus:ring-[#D4AF37]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hasta</label>
                                <input type="date" value={searchParams.dateEnd} onChange={e => setSearchParams({...searchParams, dateEnd: e.target.value})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-[10px] outline-none focus:ring-2 focus:ring-[#D4AF37]" />
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex justify-end pt-2 lg:pt-4">
                            <Button disabled={searchLoading} className="w-full lg:w-auto px-12 py-6 lg:py-7 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
                                {searchLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Search className="w-4 h-4 mr-2" /> Localizar Actas</>}
                            </Button>
                        </div>
                    </form>
                </section>

                <AnimatePresence>
                    {results && (
                        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                            <div className="flex items-center justify-between px-2 lg:px-4">
                                <h3 className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Coincidencias ({results.length})</h3>
                                <div className="h-px flex-1 bg-gray-200 mx-4 lg:mx-6"></div>
                            </div>

                            {results.length === 0 ? (
                                <div className="bg-white p-12 lg:p-20 rounded-[2rem] lg:rounded-[2.5rem] border border-dashed border-gray-200 text-center">
                                    <Search className="w-12 h-12 lg:w-16 lg:h-16 text-gray-200 mx-auto mb-4" />
                                    <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px] lg:text-xs">No se localizaron registros para esta búsqueda</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                                    {results.map(r => {
                                        return (
                                            <motion.div whileHover={{ y: -5 }} key={`${r.type}-${r.id}`} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border-l-8 border-[#D4AF37] relative group overflow-hidden flex flex-col justify-between">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                                    <BookOpen className="w-20 h-20 lg:w-24 lg:h-24" />
                                                </div>
                                                
                                                <div>
                                                    <span className="bg-blue-50 text-[#4B7BA7] px-3 py-1 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-widest">{r.type}</span>
                                                    <h4 className="text-lg lg:text-xl font-black text-gray-900 uppercase mt-3 tracking-tighter leading-tight pr-10">
                                                        {r.nombres} {r.apellidos}
                                                    </h4>
                                                </div>

                                                <div className="space-y-2 pt-4 lg:pt-6 mt-4 lg:mt-6 border-t border-gray-50">
                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                                        <span className="text-[10px] lg:text-xs font-bold uppercase">{r.fechaSacramento || 'Fecha no registrada'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        <Church className="w-4 h-4 text-[#4B7BA7] shrink-0" />
                                                        <span className="text-[10px] lg:text-xs font-bold uppercase truncate" title={r.parishName}>
                                                            {r.parishName} {r.city ? `(${r.city})` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-3 text-gray-400 mt-2">
                                                        <MapPin className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">
                                                                {diocesesList.find(d => d.id === r.dioceseId)?.name || 'DIÓCESIS'}
                                                            </span>
                                                            <span className="text-[8px] lg:text-[9px] font-bold uppercase tracking-tight mt-0.5 text-gray-400 truncate max-w-[200px] lg:max-w-[220px]" title={r.parishAddress}>
                                                                {r.parishAddress}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
};

export default UnifiedSearchPage;