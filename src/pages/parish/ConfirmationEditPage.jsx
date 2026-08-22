import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient'; 
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, ArrowLeft, Loader2, BookOpen, 
    Calendar, User, Fingerprint, PenTool, Droplet, ShieldCheck, Search, Hash
} from 'lucide-react';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import { motion } from 'framer-motion';

const ConfirmationEditPage = () => {
    const { user } = useAuth();
    const { getParrocos, getMisDatosList } = useAppData(); 
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recordId = searchParams.get('id');

    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rawOriginal, setRawOriginal] = useState({});
    
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);
    const [listaIglesias, setListaIglesias] = useState([]);
    const [userChangedDate, setUserChangedDate] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    // 🚀 ESTADO LIMPIO EXACTO A TU LISTA DE CAMPOS
    const [formData, setFormData] = useState({
        id: '',
        status: '',
        numeroRegistro: '',
        fechaInscripcion: '',
        Libro: '', 
        folio: '', 
        numero: '',
        fechaSacramento: '', 
        lugarSacramento: '', 
        apellidos: '', 
        nombres: '', 
        sexo: '', 
        fechaNacimiento: '', 
        edad: '',
        direccion: '',
        nombrePadre: '', 
        nombreMadre: '', 
        codigoBautizo: '',
        lugarBautismo: '',
        libroBautismo: '',
        folioBautismo: '',
        numeroBautismo: '',
        padrinos: '', 
        responsable: '',
        ministro: '', 
        daFe: '',
        notaMarginal: ''
    });

    const toInputDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.split('T')[0];
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [d, m, y] = dateStr.split('/');
            return `${y}-${m}-${d}`;
        }
        return '';
    };

    useEffect(() => {
        if (!recordId) {
            navigate('/parroquia/confirmacion/partidas');
            return;
        }

        const loadRecord = async () => {
            setIsLoading(true);
            try {
                // 1. Extraer desde Supabase directamente
                const { data: dbRecord, error } = await supabase
                    .from('confirmations')
                    .select('*')
                    .eq('id', recordId)
                    .single();

                if (error || !dbRecord) throw new Error("Registro no encontrado.");

                const raw = typeof dbRecord.raw_data === 'string' ? JSON.parse(dbRecord.raw_data) : (dbRecord.raw_data || {});
                setRawOriginal(raw);

                // Carga de Sacerdotes e Iglesias
                const listaParrocos = getParrocos(parishId) || [];
                setListaSacerdotes(listaParrocos);
                setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

                const parrocoActualObj = listaParrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
                const nombreParrocoActual = parrocoActualObj ? `${parrocoActualObj.nombre} ${parrocoActualObj.apellido || ''}`.trim().toUpperCase() : '';

                try {
                    const { data: iglesiasData } = await supabase.from('iglesias').select('nombre, codigo, ciudad');
                    if (iglesiasData) setListaIglesias(iglesiasData);
                } catch (err) { console.error("Error cargando iglesias", err); }

                // 🚀 CARGA ESTRICTA Y MAPEO
                setFormData({
                    id: dbRecord.id,
                    status: dbRecord.status || 'seated',
                    numeroRegistro: dbRecord.numero_registro || raw.numeroRegistro || raw.inscripcionNumero || raw["Nº REGISTRO PREVIO"] || '',
                    fechaInscripcion: toInputDate(raw.fechaInscripcion || raw["FECHA DE INSCRIPCIÓN"] || dbRecord.created_at) || '',
                    Libro: dbRecord.book_number || raw.Libro || raw.libro || raw.LIBRO || '',
                    folio: dbRecord.folio || raw.folio || raw.page_number || raw.FOLIO || '',
                    numero: dbRecord.number || raw.numero || raw.entry_number || raw.NUMERO || '',
                    fechaSacramento: dbRecord.celebration_date || raw.fechaSacramento || raw.fechaConfirmacion || raw["FECHA DE CONFIRMACIÓN"] || '',
                    lugarSacramento: raw.lugarSacramento || raw.lugarConfirmacion || raw.lugar || raw.place || raw["LUGAR DE CONFIRMACIÓN"] || nombreParroquia,
                    apellidos: dbRecord.apellidos || raw.apellidos || raw.lastName || raw.APELLIDOS || '',
                    nombres: dbRecord.nombres || raw.nombres || raw.firstName || raw.NOMBRES || '',
                    sexo: dbRecord.sexo || raw.sexo || raw.sex || raw.SEXO || '',
                    fechaNacimiento: dbRecord.fecha_nacimiento || raw.fechaNacimiento || raw.birthDate || raw["FECHA DE NACIMIENTO"] || '',
                    edad: raw.edad || raw.age || raw.EDAD || '', 
                    direccion: raw.direccion || raw.DIRECCION || '',
                    nombrePadre: dbRecord.nombre_padre || raw.nombrePadre || raw.fatherName || raw["NOMBRE DEL PADRE"] || '',
                    nombreMadre: dbRecord.nombre_madre || raw.nombreMadre || raw.motherName || raw["NOMBRE DE LA MADRE"] || '',
                    codigoBautizo: raw.codigoBautizo || raw["CODIGO DE BAUTIZO"] || '',
                    lugarBautismo: dbRecord.lugar_bautismo || raw.lugarBautismo || raw.baptismPlace || raw["LUGAR DE BAUTISMO"] || '',
                    libroBautismo: raw.libroBautismo || raw.baptismBook || raw["LIBRO DE BAUTIZO"] || '',
                    folioBautismo: raw.folioBautismo || raw.baptismFolio || raw["FOLIO DE BAUTIZO"] || '',
                    numeroBautismo: raw.numeroBautismo || raw.baptismNumber || raw["NÚMERO DE BAUTIZO"] || '',
                    padrinos: dbRecord.padrinos || raw.padrinos || raw.godparents || raw["PADRINO / MADRINA"] || '',
                    responsable: raw.responsable || raw.RESPONSABLE || '',
                    ministro: dbRecord.ministro || raw.ministro || raw.minister || raw.MINISTRO || '',
                    daFe: dbRecord.da_fe || raw.daFe || raw.ministerFaith || raw["DA FE"] || nombreParrocoActual,
                    notaMarginal: dbRecord.nota_marginal || raw.notaMarginal || raw.observations || ''
                });

            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el registro.", variant: "destructive" });
                navigate('/parroquia/confirmacion/partidas');
            } finally {
                setIsLoading(false);
            }
        };

        loadRecord();
    }, [recordId, parishId, getParrocos, navigate, toast, nombreParroquia]);

    // 🚀 INTELIGENCIA 1: Re-calcula el Párroco (Da Fe) SOLAMENTE si el usuario cambia la fecha
    useEffect(() => {
        if (!userChangedDate || !formData?.fechaSacramento || listaSacerdotes.length === 0) return;

        const fechaSeleccionada = new Date(formData.fechaSacramento.includes('T') ? formData.fechaSacramento : `${formData.fechaSacramento}T12:00:00`);
        const sacerdoteEncontrado = listaSacerdotes.find(s => {
            const inicio = new Date(s.fechaIngreso || s.fechaNombramiento);
            const fin = s.fechaSalida ? new Date(s.fechaSalida) : new Date();
            return fechaSeleccionada >= inicio && fechaSeleccionada <= fin;
        });

        if (sacerdoteEncontrado) {
            setFormData(prev => ({ 
                ...prev, 
                daFe: `${sacerdoteEncontrado.nombre} ${sacerdoteEncontrado.apellido || ''}`.trim().toUpperCase() 
            }));
        }
    }, [formData?.fechaSacramento, listaSacerdotes, userChangedDate]);

    // 🚀 INTELIGENCIA 2: Recalcular Edad Dinámicamente (Protegido contra zonas horarias)
    useEffect(() => {
        if (formData?.fechaNacimiento && formData?.fechaSacramento) {
            const birthStr = toInputDate(formData.fechaNacimiento);
            const confStr = toInputDate(formData.fechaSacramento);
            
            if (birthStr && confStr) {
                const birth = new Date(`${birthStr}T12:00:00`);
                const conf = new Date(`${confStr}T12:00:00`);
                
                if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                    let age = conf.getFullYear() - birth.getFullYear();
                    const m = conf.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
                    
                    if (age >= 0 && formData.edad !== age.toString()) {
                        setFormData(prev => ({ ...prev, edad: age.toString() }));
                    }
                }
            }
        }
    }, [formData?.fechaNacimiento, formData?.fechaSacramento]);

    // 🚀 INTELIGENCIA 3: Asignación en cascada del "Responsable"
    useEffect(() => {
        setFormData(prev => {
            const possibleResponsables = [prev.nombrePadre, prev.nombreMadre, prev.padrinos].filter(v => v && v.trim() !== '');
            const topPriority = possibleResponsables[0] || '';
            
            if (!prev.responsable || possibleResponsables.includes(prev.responsable)) {
                 if (prev.responsable !== topPriority) return { ...prev, responsable: topPriority };
            }
            return prev;
        });
    }, [formData.nombrePadre, formData.nombreMadre, formData.padrinos]);

    // 🚀 INTELIGENCIA 4: Vinculación Automática del Código de Iglesia (Robusta)
    useEffect(() => {
        if (formData.lugarBautismo && listaIglesias.length > 0) {
            const searchStr = formData.lugarBautismo.toUpperCase().trim();
            const searchNormalized = searchStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const matchedChurch = listaIglesias.find(iglesia => {
                if (!iglesia.codigo) return false;
                const nombreNorm = (iglesia.nombre || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return searchNormalized === nombreNorm || searchNormalized.includes(nombreNorm);
            });

            if (matchedChurch && matchedChurch.codigo) {
                setFormData(prev => prev.codigoBautizo !== matchedChurch.codigo ? { ...prev, codigoBautizo: matchedChurch.codigo } : prev);
            }
        }
    }, [formData.lugarBautismo, listaIglesias]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'fechaSacramento') setUserChangedDate(true);

        const uppercaseFields = [
            'nombres', 'apellidos', 'lugarSacramento', 'lugarBautismo', 
            'padrinos', 'responsable', 'nombrePadre', 'nombreMadre', 
            'ministro', 'daFe', 'direccion', 'notaMarginal', 'codigoBautizo'
        ];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSelectBaptismPartida = (partida) => {
        let normalizedSex = '';
        if (partida.sex || partida.sexo) {
            const rawSex = String(partida.sex || partida.sexo).toUpperCase();
            if (rawSex.startsWith('M')) normalizedSex = 'MASCULINO';
            else if (rawSex.startsWith('F')) normalizedSex = 'FEMENINO';
        }

        const raw = partida.raw_data || partida || {};
        const libroValue = partida.book_number || raw.book_number || partida.Libro || raw.Libro || partida.libro || raw.libro || raw.LIBRO || raw["LIBRO N°"] || formData.libroBautismo;
        const folioValue = partida.folio || raw.folio || partida.page_number || raw.page_number || raw.FOLIO || raw["FOLIO N°"] || formData.folioBautismo;
        const numeroValue = partida.number || raw.number || partida.numero || raw.numero || partida.entry_number || raw.entry_number || raw.NUMERO || raw["NÚMERO N°"] || formData.numeroBautismo;

        setFormData(prev => ({
            ...prev,
            nombres: partida.nombres || partida.firstName || raw.nombres || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || raw.apellidos || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || raw.fechaNacimiento || prev.fechaNacimiento,
            sexo: normalizedSex || prev.sexo,
            nombrePadre: partida.nombrePadre || partida.fatherName || raw.nombrePadre || raw.PADRE || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || raw.nombreMadre || raw.MADRE || prev.nombreMadre,
            lugarBautismo: partida.lugarBautismo || partida.baptismPlace || raw.lugarBautismo || raw.LUGBAU || prev.lugarBautismo,
            libroBautismo: libroValue ? String(libroValue).padStart(4, '0') : prev.libroBautismo,
            folioBautismo: folioValue ? String(folioValue).padStart(4, '0') : prev.folioBautismo,
            numeroBautismo: numeroValue ? String(numeroValue).padStart(4, '0') : prev.numeroBautismo,
            codigoBautizo: partida.codigo || partida.codigoBautizo || raw.codigoBautizo || prev.codigoBautizo
        }));
        
        toast({ title: "Datos Importados", description: `Se han cargado los datos origen.`, className: "bg-red-50 border-red-200 text-red-900" });
        setIsSearchModalOpen(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.nombres || !formData.apellidos) {
            toast({ title: "Campos Requeridos", description: "Nombres y Apellidos obligatorios.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            // 🚀 ACTUALIZACIÓN DIRECTA EN SUPABASE CON INYECCIÓN HÍBRIDA
            const payloadToSave = { ...rawOriginal, ...formData };

            const { error } = await supabase.from('confirmations').update({
                book_number: formData.Libro,
                folio: formData.folio,
                number: formData.numero,
                numero_registro: formData.numeroRegistro,
                celebration_date: formData.fechaSacramento || null,
                lugar_bautismo: formData.lugarBautismo || null,
                apellidos: formData.apellidos || null,
                nombres: formData.nombres || null,
                sexo: formData.sexo || null,
                fecha_nacimiento: formData.fechaNacimiento || null,
                nombre_padre: formData.nombrePadre || null,
                nombre_madre: formData.nombreMadre || null,
                padrinos: formData.padrinos || null,
                ministro: formData.ministro || null,
                da_fe: formData.daFe || null,
                nota_marginal: formData.notaMarginal || null,
                raw_data: payloadToSave, // Aquí se empaca todo: EDAD, RESPONSABLE, etc.
                updated_at: new Date().toISOString()
            }).eq('id', recordId);
            
            if (error) throw error;

            toast({ title: "¡Actualizado!", description: "Sincronizado con la Base de Datos Central.", className: "bg-green-600 text-white" });
            navigate('/parroquia/confirmacion/partidas');

        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !formData) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
                <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Accediendo a la Nube...</p>
            </div>
        </DashboardLayout>
    );

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-red-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-red-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto px-4 pb-24 pt-6">
                <datalist id="lista-parrocos">
                    {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                </datalist>

                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none font-serif">Editar Partida</h1>
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Registro de Confirmación en la Nube</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] shadow-2xl shadow-red-900/5 border border-gray-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-[#D4AF37] to-red-600"></div>
                    
                    <div className="p-12 space-y-10">
                        {/* 01. UBICACIÓN FÍSICA Y CONTROL */}
                        <section>
                            <SectionHeader number="01" title="Localización Física y Control" icon={Hash} />
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                <div><label className={labelClass}>Libro</label><input type="text" name="Libro" onChange={handleChange} className={`${inputClass} font-mono text-lg text-red-600`} value={formData.Libro || ''} required /></div>
                                <div><label className={labelClass}>Folio</label><input type="text" name="folio" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.folio || ''} required /></div>
                                <div><label className={labelClass}>Número (Acta)</label><input type="text" name="numero" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.numero || ''} required /></div>
                                
                                <div><label className={labelClass}>Nº Registro Previo</label><input type="text" name="numeroRegistro" value={formData.numeroRegistro || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha Inscripción</label><input type="date" name="fechaInscripcion" value={toInputDate(formData.fechaInscripcion) || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 02. DATOS DE LA CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Datos de la Celebración" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className={labelClass}>Fecha Confirmación</label><input type="date" name="fechaSacramento" required value={toInputDate(formData.fechaSacramento) || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar de Confirmación</label><input type="text" name="lugarSacramento" required value={formData.lugarSacramento || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 03. IDENTIDAD DEL CONFIRMADO */}
                        <section>
                            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-3 mt-10 first:mt-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-2xl bg-red-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-red-900/20">03</div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2"><User className="w-4 h-4 text-[#D4AF37]" /> Identidad del Confirmado</h3>
                                </div>
                                <Button type="button" variant="outline" onClick={() => setIsSearchModalOpen(true)} className="border-[#D4AF37] text-[#D4AF37] hover:bg-yellow-50 h-8 text-xs font-bold uppercase tracking-widest px-4 rounded-xl shadow-sm">
                                    <Search className="w-3.5 h-3.5 mr-2" /> Buscar Partida Origen
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className={labelClass}>Sexo</label>
                                    <select name="sexo" required value={formData.sexo || ''} onChange={handleChange} className={inputClass}>
                                        <option value="">SELECCIONE...</option>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                    </select>
                                </div>
                                <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={toInputDate(formData.fechaNacimiento) || ''} onChange={handleChange} className={inputClass} /></div>
                                <div>
                                    <label className={labelClass}>Edad Conf.</label>
                                    <div className="relative">
                                        <input type="number" name="edad" value={formData.edad || ''} onChange={handleChange} className={`${inputClass} pr-12`} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">AÑOS</span>
                                    </div>
                                </div>
                                <div><label className={labelClass}>Dirección</label><input type="text" name="direccion" value={formData.direccion || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 04. FILIACIÓN */}
                        <section>
                            <SectionHeader number="04" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Padre</p>
                                    <input name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre || ''} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre || ''} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 05. REGISTRO BAUTISMAL */}
                        <section>
                            <SectionHeader number="05" title="Registro de Bautismo Origen" icon={Droplet} />
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>Lugar y Parroquia de Bautismo</label>
                                        <ChurchLocationAutocomplete 
                                            value={formData.lugarBautismo || ''} 
                                            onChange={(val) => {
                                                if (typeof val === 'object' && val !== null) {
                                                    setFormData(prev => ({
                                                        ...prev, 
                                                        lugarBautismo: (val.nombre || val.name || '').toUpperCase(),
                                                        codigoBautizo: (val.codigo || val.code || prev.codigoBautizo)
                                                    }));
                                                } else {
                                                    setFormData(prev => ({...prev, lugarBautismo: String(val).toUpperCase()}));
                                                }
                                            }}
                                            placeholder="Buscar iglesia y ciudad..."
                                        />
                                    </div>
                                    <div><label className={labelClass}>Código de Bautizo</label><input type="text" name="codigoBautizo" value={formData.codigoBautizo || ''} onChange={handleChange} className={inputClass} placeholder="Ej. 000000" /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div><label className={labelClass}>Libro Baut.</label><input name="libroBautismo" value={formData.libroBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                    <div><label className={labelClass}>Folio Baut.</label><input name="folioBautismo" value={formData.folioBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                    <div><label className={labelClass}>Acta Baut.</label><input name="numeroBautismo" value={formData.numeroBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                </div>
                            </div>
                        </section>

                        {/* 06. AUTORIDAD */}
                        <section>
                            <SectionHeader number="06" title="Ministros y Testigos" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-6">
                                <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><input name="ministro" required value={formData.ministro || ''} onChange={handleChange} className={`${inputClass} border-l-8 border-l-red-600`} placeholder="EXCMO. MONS..." /></div>
                                <div><label className={labelClass}>Da Fe (Párroco)</label><input name="daFe" required value={formData.daFe || ''} onChange={handleChange} list="lista-parrocos" className={inputClass} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Padrino / Madrina</label><input name="padrinos" value={formData.padrinos || ''} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                <div><label className={labelClass}>Responsable</label><input type="text" name="responsable" value={formData.responsable || ''} onChange={handleChange} className={`${inputClass} py-5`} placeholder="QUIEN SOLICITA / ACUDIENTE" /></div>
                            </div>
                        </section>

                        {/* 07. OBSERVACIONES */}
                        <section>
                            <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 07. Observaciones</h3>
                            <div>
                                <label className={labelClass}>Nota Marginal / Observaciones</label>
                                <textarea name="notaMarginal" value={formData.notaMarginal || ''} onChange={handleChange} className={`${inputClass} h-24 resize-none font-mono text-xs`} />
                            </div>
                        </section>

                        <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                            <Button type="button" variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="px-8 py-6 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Descartar Cambios</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-800 text-white px-10 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all transform active:scale-95">
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
            
            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onSelectPartida={handleSelectBaptismPartida}
            />
        </DashboardLayout>
    );
};

export default ConfirmationEditPage;