import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { 
    Search, Church, Calendar, BookOpen, 
    Loader2, Globe, MapPin 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const UnifiedSearchPage = () => {
    // 🔐 AL ESTAR AQUÍ, GARANTIZAMOS QUE EL USUARIO TIENE UN ROL
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

    // 🚀 1. CARGA INICIAL (SOLO DIÓCESIS) PARA EVITAR LÍMITE DE 1000 FILAS
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

    // 🚀 2. EFECTO EN CASCADA: CARGAR PARROQUIAS DINÁMICAMENTE COMO EN CANCILLERÍA
    useEffect(() => {
        const loadParishes = async () => {
            if (!searchParams.dioceseId || searchParams.dioceseId === 'all') {
                setFilteredParishes([]); 
                return;
            }
            try {
                // Al filtrar por diócesis antes, evitamos el límite de Supabase
                const { data } = await supabase
                    .from('parishes')
                    .select('id, name, city, diocese_id')
                    .eq('diocese_id', searchParams.dioceseId)
                    .order('name', { ascending: true });
                
                if (data) setFilteredParishes(data);
            } catch (error) {
                console.error("Error cargando parroquias:", error);
            }
        };
        loadParishes();
    }, [searchParams.dioceseId]);

    const dioceseOptions = useMemo(() => [{ id: 'all', name: 'TODAS LAS DIÓCESIS' }, ...diocesesList], [diocesesList]);

    const sacramentOptions = [
        { value: 'baptism', label: 'BAUTISMO' },
        { value: 'confirmation', label: 'CONFIRMACIÓN' },
        { value: 'marriage', label: 'MATRIMONIO' },
    ];

    // 🚀 3. MOTOR DE BÚSQUEDA INTELIGENTE
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
            let all = [];
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

            // Constructor dinámico de consultas para hacer la búsqueda rápida en la base de datos
            const buildQuery = (table) => {
                let q = supabase.from(table).select('*');
                if (!isGlobal) {
                    q = q.in('parish_id', queryParishIds);
                }
                
                // Si buscan nombres, aplicamos el filtro desde el servidor (ilike)
                if (searchParams.firstName.trim() && table !== 'marriages' && table !== 'matrimonios') {
                    q = q.ilike('nombres', `%${searchParams.firstName.trim()}%`);
                }
                if (searchParams.lastName.trim() && table !== 'marriages' && table !== 'matrimonios') {
                    q = q.ilike('apellidos', `%${searchParams.lastName.trim()}%`);
                }
                return q;
            };

            if (!type || type === 'baptism') fetchPromises.push(buildQuery('baptisms').then(res => ({ type: 'baptism', data: res.data || [] })));
            if (!type || type === 'confirmation') fetchPromises.push(buildQuery('confirmations').then(res => ({ type: 'confirmation', data: res.data || [] })));
            if (!type || type === 'marriage') {
                fetchPromises.push(
                    buildQuery('marriages').then(res => ({ type: 'marriage', data: res.data || [] }))
                    .catch(() => buildQuery('matrimonios').then(res => ({ type: 'marriage', data: res.data || [] })))
                );
            }

            const fetchedResults = await Promise.all(fetchPromises);

            // Identificar los IDs de todas las parroquias encontradas (esencial para la búsqueda global)
            let allFoundParishIds = new Set();
            fetchedResults.forEach(fetchResult => {
                fetchResult.data.forEach(row => {
                    if (row.parish_id) allFoundParishIds.add(row.parish_id);
                });
            });

            // Si es global, buscar los nombres exactos de las parroquias encontradas
            let allParishesRef = [...filteredParishes];
            if (isGlobal && allFoundParishIds.size > 0) {
                const { data: missingParishes } = await supabase.from('parishes').select('id, name, city, diocese_id').in('id', Array.from(allFoundParishIds));
                if (missingParishes) {
                    allParishesRef = missingParishes;
                }
            }

            fetchedResults.forEach(fetchResult => {
                const sacType = fetchResult.type;
                
                const cloudRecords = fetchResult.data.map(dbRow => ({
                    id: dbRow.id,
                    parishId: dbRow.parish_id,
                    ...(dbRow.raw_data || {})
                }));

                cloudRecords.forEach(record => {
                    const parish = allParishesRef.find(p => p.id === record.parishId);
                    if (!parish) return;

                    if (matchesSearch(record, searchParams, sacType)) {
                        let parishAddress = 'Dirección no registrada';
                        const misDatosMatch = misDatosList.find(md => md.entity_id === parish.id);
                        if (misDatosMatch) {
                            let pData = misDatosMatch.payload;
                            if (typeof pData === 'string') {
                                try { pData = JSON.parse(pData); } catch(e) { pData = {}; }
                            }
                            if (Array.isArray(pData)) pData = pData[0] || {};
                            if (pData.direccion && pData.direccion.trim() !== '') {
                                parishAddress = pData.direccion;
                            }
                        }

                        const typeLabel = sacType === 'baptism' ? 'BAUTISMO' : sacType === 'confirmation' ? 'CONFIRMACIÓN' : 'MATRIMONIO';

                        all.push({
                            ...record,
                            type: typeLabel,
                            parishName: parish.name,
                            dioceseId: parish.diocese_id || parish.dioceseId,
                            parishAddress
                        });
                    }
                });
            });

            setResults(all);
        } catch (error) {
            console.error("Error consultando Supabase:", error);
            toast({ title: "Error de Búsqueda", description: "Ocurrió un error al conectar con los servidores.", variant: "destructive" });
        } finally {
            setSearchLoading(false);
        }
    };

    const matchesSearch = (r, p, type) => {
        const recordName = type === 'marriage' ? `${r.groomName} ${r.brideName}` : (r.firstName || r.nombres || '');
        const recordLastName = type === 'marriage' ? `${r.groomSurname} ${r.brideSurname}` : (r.lastName || r.apellidos || '');
        
        if (p.firstName && !recordName.toLowerCase().includes(p.firstName.toLowerCase())) return false;
        if (p.lastName && !recordLastName.toLowerCase().includes(p.lastName.toLowerCase())) return false;

        const recordDate = r.sacramentDate || r.fechaSacramento || r.fechaBautismo || r.fechaConfirmacion || r.fechaMatrimonio;
        if (p.dateStart && recordDate < p.dateStart) return false;
        if (p.dateEnd && recordDate > p.dateEnd) return false;

        return true;
    };

    return (
        <DashboardLayout entityName={nombreEntidad}>
            <Helmet><title>Buscador Unificado | Eclesia Digital</title></Helmet>

            <div className="max-w-5xl mx-auto py-8">
                <header className="mb-8 lg:mb-12">
                    <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                        <Globe className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Herramienta Interna de Verificación</span>
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">Buscador Unificado de Sacramentos</h1>
                    <p className="text-gray-500 font-medium mt-2 text-sm lg:text-base">Localice actas en los archivos digitales de las Diócesis autorizadas.</p>
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
                                <option value="">-- SELECCIONE UNA DIÓCESIS --</option>
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
                                <option value="">TODOS</option>
                                {sacramentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres</label>
                            <input type="text" value={searchParams.firstName} onChange={e => setSearchParams({...searchParams, firstName: e.target.value})} placeholder="EJ: PEDRO" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase focus:ring-2 focus:ring-[#D4AF37]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                            <input type="text" value={searchParams.lastName} onChange={e => setSearchParams({...searchParams, lastName: e.target.value})} placeholder="EJ: ROJAS" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase focus:ring-2 focus:ring-[#D4AF37]" />
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
                                {searchLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Search className="w-4 h-4 mr-2" /> Buscar Actas</>}
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
                                    <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px] lg:text-xs">No se localizaron registros</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                                    {results.map(r => {
                                        const name = r.type === 'MATRIMONIO' ? `${r.groomName} & ${r.brideName}` : `${(r.firstName || r.nombres)} ${(r.lastName || r.apellidos)}`;
                                        const date = r.sacramentDate || r.fechaSacramento || r.fechaBautismo || r.fechaConfirmacion || r.fechaMatrimonio;

                                        return (
                                            <motion.div whileHover={{ y: -5 }} key={`${r.type}-${r.id}`} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border-l-8 border-[#D4AF37] relative group overflow-hidden flex flex-col justify-between">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><BookOpen className="w-20 h-20 lg:w-24 lg:h-24" /></div>
                                                
                                                <div>
                                                    <span className="bg-blue-50 text-[#4B7BA7] px-3 py-1 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-widest">{r.type}</span>
                                                    <h4 className="text-lg lg:text-xl font-black text-gray-900 uppercase mt-3 tracking-tighter leading-tight pr-10">{name}</h4>
                                                </div>

                                                <div className="space-y-2 pt-4 lg:pt-6 mt-4 lg:mt-6 border-t border-gray-50">
                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                                        <span className="text-[10px] lg:text-xs font-bold uppercase">{date || '---'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        <Church className="w-4 h-4 text-[#4B7BA7] shrink-0" />
                                                        <span className="text-[10px] lg:text-xs font-bold uppercase truncate">{r.parishName}</span>
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