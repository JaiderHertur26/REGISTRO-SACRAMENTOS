import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, X, Calendar, User, Users, BookOpen, PenTool, 
    CheckCircle, Loader2, ScrollText, MapPin, Hash, Search, AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import BaptismTicket from '@/components/BaptismTicket';
import CityAutocomplete from '@/components/CityAutocomplete';
import useParroquiaFromMisDatos from '@/hooks/useParroquiaFromMisDatos';
import { generateUUID } from '@/utils/supabaseHelpers';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN CLAVE

const BaptismNewPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, getCiudadesList } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    const parishNameFromMisDatos = useParroquiaFromMisDatos();
    
    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticketData, setTicketData] = useState(null);
    const [parishInfo, setParishInfo] = useState(null); 
    const [ciudades, setCiudades] = useState([]); 
    const [fullParamsCache, setFullParamsCache] = useState(null); // 🚀 Guardamos el objeto completo para actualizarlo luego

    const initialFormData = {
        numeroRegistro: '', Libro: '', folio: '', numero: '',
        fechaSacramento: '', lugarBautismo: '',
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', lugarNacimiento: '', 
        tipoUnionPadres: '', 
        nombrePadre: '', cedulaPadre: '', 
        nombreMadre: '', cedulaMadre: '', 
        abuelosPaternos: '', abuelosMaternos: '', 
        padrinos: '', 
        direccion: '', 
        ministro: '',
        serialRegistro: '', nuip: '', oficinaRegistro: '', fechaExpedicionRegistro: '', 
    };

    const [formData, setFormData] = useState(initialFormData);

    // --- 1. CARGA DE NOMBRE DE PARROQUIA ---
    useEffect(() => {
        if (parishNameFromMisDatos && !formData.lugarBautismo) {
            setFormData(prev => ({ ...prev, lugarBautismo: parishNameFromMisDatos.toUpperCase() }));
        }
    }, [parishNameFromMisDatos]);

    // --- 2. CARGA DE DATOS DESDE SUPABASE ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (user?.parishId) {
                const entityId = user.parishId;
                const misDatos = getMisDatosList(entityId);
                
                if (misDatos?.length > 0) {
                    setParishInfo({ 
                        diocesis: misDatos[0].diocesis || '',
                        nombre: misDatos[0].nombre || '', 
                        direccion: misDatos[0].direccion || '', 
                        telefono: misDatos[0].telefono || '', 
                        ciudad: misDatos[0].ciudad || '' 
                    });
                    
                    if (!formData.lugarBautismo) {
                        setFormData(prev => ({ ...prev, lugarBautismo: (misDatos[0].nombre || '').toUpperCase() }));
                    }
                }

                const contextId = user.dioceseId || entityId;
                const listaCiudadesRaw = getCiudadesList(contextId) || [];
                setCiudades(listaCiudadesRaw.map(c => (c.nombre || '').toUpperCase()));
                
                const storedMinisters = localStorage.getItem(`parrocos_${entityId}`);
                if (storedMinisters) {
                    const parsed = JSON.parse(storedMinisters);
                    const active = parsed.find(p => String(p.estado) === '1');
                    if (active) setFormData(prev => ({ ...prev, ministro: `${active.nombre} ${active.apellido || ''}`.trim().toUpperCase() }));
                }

                // 🚀 CARGA DE PARÁMETROS DESDE SUPABASE EN VEZ DE LOCALSTORAGE
                try {
                    const { data, error } = await supabase
                        .from('parish_parameters')
                        .select('bautizos_params')
                        .eq('parish_id', entityId)
                        .maybeSingle();

                    if (error && error.code !== 'PGRST116') throw error;

                    if (data && data.bautizos_params) {
                        setFullParamsCache(data.bautizos_params); // Guardamos la config para poder actualizarla
                        
                        setFormData(prev => ({
                            ...prev,
                            Libro: data.bautizos_params.ordinarioLibro || '',
                            folio: data.bautizos_params.ordinarioFolio || '',
                            numero: data.bautizos_params.ordinarioNumero || '',
                            numeroRegistro: data.bautizos_params.numeroRegistroActual || '' 
                        }));
                    }
                } catch (e) {
                    console.error("Error cargando parámetros de registro desde Supabase:", e);
                }
            }
        };

        loadInitialData();
    }, [user, getMisDatosList, getCiudadesList]);

    // --- 3. MANEJADORES DE ENTRADA ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        const finalValue = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'direccion', 'oficinaRegistro', 'padrinos', 'nombrePadre', 'nombreMadre'].includes(name) 
            ? value.toUpperCase() 
            : value;
            
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    // 🚀 FIX CRÍTICO: Maneja tanto el evento de escritura como la selección de la lista
    const handleCityChange = (data) => {
        let value = "";
        
        // Si data es un evento de input estándar
        if (data && data.target) {
            value = data.target.value;
        } 
        // Si data es un string (viene de la selección del Autocomplete)
        else if (typeof data === 'string') {
            value = data;
        }
        // Si data es un objeto (formato antiguo)
        else if (data && data.nombre) {
            value = data.nombre;
        }

        setFormData(prev => ({ 
            ...prev, 
            lugarNacimiento: value.toUpperCase() 
        }));
    };

    // --- 4. ENVÍO ---    

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const entityId = user.parishId;
            const storageKey = `pendingBaptisms_${entityId}`;
            
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            const registroCrudo = {
                ...formData,
                id: generateUUID(),
                parishId: entityId,
                status: 'pending',
                creadoPorDecreto: false,
                createdAt: new Date().toISOString()
            };

            const updated = [...existing, registroCrudo];
            localStorage.setItem(storageKey, JSON.stringify(updated));

            // 🚀 INCREMENTO DEL PARÁMETRO DIRECTO A SUPABASE
            if (fullParamsCache && fullParamsCache.numeroRegistroActual) {
                const currentNum = parseInt(fullParamsCache.numeroRegistroActual, 10) || 0;
                const nextNum = String(currentNum + 1).padStart(6, '0');
                
                const updatedParams = { 
                    ...fullParamsCache, 
                    numeroRegistroActual: nextNum 
                };
                
                // Actualizar en la nube
                await supabase
                    .from('parish_parameters')
                    .update({ bautizos_params: updatedParams })
                    .eq('parish_id', entityId);

                console.log("📈 Correlativo incrementado a:", nextNum);
            }
            
            await new Promise(resolve => setTimeout(resolve, 600));
            setTicketData(registroCrudo);
            setIsSuccess(true);
            toast({ title: "Borrador Creado", className: "bg-blue-50 text-blue-900 border-blue-200" });
            setTimeout(() => window.print(), 500);

        } catch (error) {
            console.error("Error al guardar:", error);
            toast({ title: "Error al guardar el documento", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    if (isSuccess) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="print:hidden max-w-xl mx-auto bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100 text-center mt-12 animate-in fade-in duration-500">
                    <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-green-100"><CheckCircle className="w-12 h-12 text-green-500" /></div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter uppercase">Borrador Guardado</h2>
                    <p className="text-gray-500 mb-10 text-sm font-medium leading-relaxed">Documento guardado. Puede imprimir la boleta ahora.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => window.location.reload()} variant="outline" className="py-7 rounded-2xl border-gray-200 text-gray-50 font-black uppercase text-[10px] hover:bg-gray-50">Nueva Inscripción</Button>
                        <Button onClick={() => navigate('/parroquia/bautismo/sentar-registros')} className="py-7 rounded-2xl bg-[#4B7BA7] text-white font-black uppercase text-[10px] shadow-xl shadow-blue-900/20">Sentar Libros</Button>
                    </div>
                </div>
                <div className="hidden print:block bg-white">
                     {ticketData && <BaptismTicket baptismData={ticketData} parishInfo={parishInfo} />}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <div className="print:hidden bg-gray-50 min-h-screen">
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="max-w-5xl mx-auto pb-20">
                    <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Inscripción Previa</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Borrador local con pre-asignación</p>
                        </div>
                        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full w-12 h-12 p-0 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-100 shadow-sm transition-all"><X className="w-5 h-5"/></Button>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-gray-100 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] to-[#4B7BA7]"></div>
                        <div className="p-12 space-y-10">
                            
                            <section>
                                <SectionHeader number="01" title="Archivo y Control (Automático)" icon={Hash} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nº Registro Previo</label>
                                        <input type="text" name="numeroRegistro" value={formData.numeroRegistro} disabled className="w-full px-4 py-4 bg-slate-100 border border-slate-200 rounded-xl outline-none font-black text-[#4B7BA7] text-center cursor-not-allowed opacity-80" />
                                    </div>
                                    <div className="md:col-span-2 flex items-center px-4">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed">
                                            <AlertCircle className="w-4 h-4 inline-block mr-2 mb-0.5 text-amber-500" />
                                            Libro, Folio y Acta se asignarán al asentar oficialmente.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="02" title="Datos de la Celebración" icon={Calendar} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha y Hora Sacramento</label>
                                        <input type="datetime-local" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-800 transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Parroquia / Lugar</label>
                                        <input type="text" name="lugarBautismo" required value={formData.lugarBautismo} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black uppercase text-gray-700 focus:ring-4 focus:ring-blue-500/5" />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="03" title="Identidad del Bautizado" icon={User} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-black text-gray-900 text-lg outline-none focus:ring-4 focus:ring-blue-500/5" /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombres</label><input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-black text-gray-900 text-lg outline-none focus:ring-4 focus:ring-blue-500/5" /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sexo</label>
                                        <select name="sexo" required value={formData.sexo} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-700 uppercase outline-none cursor-pointer focus:ring-4 focus:ring-blue-500/5">
                                            <option value="">SELECCIONE...</option>
                                            <option value="MASCULINO">MASCULINO</option>
                                            <option value="FEMENINO">FEMENINO</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Nacimiento</label><input type="date" name="fechaNacimiento" required value={formData.fechaNacimiento} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/5" /></div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lugar Nacimiento</label>
                                        <CityAutocomplete 
                                            name="lugarNacimiento" 
                                            value={formData.lugarNacimiento} 
                                            onChange={handleCityChange} 
                                            cities={ciudades} 
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-700 uppercase focus:ring-4 focus:ring-blue-500/5 outline-none"
                                        />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="04" title="Residencia y Filiación" icon={Users} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> Dirección de Residencia</label>
                                        <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/5" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Estado Civil de los Padres</label>
                                        <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none focus:ring-4 focus:ring-blue-500/5">
                                            <option value="">SELECCIONE TIPO DE UNIÓN...</option>
                                            <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                            <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                            <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                            <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                            <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5">
                                        <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Datos del Padre</p>
                                        <input type="text" name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl text-sm font-black text-gray-800 uppercase outline-none focus:ring-4 focus:ring-blue-500/5" />
                                        <input type="text" name="cedulaPadre" placeholder="CÉDULA" value={formData.cedulaPadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl text-sm font-bold text-gray-500 outline-none focus:ring-4 focus:ring-blue-500/5" />
                                    </div>
                                    <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5">
                                        <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Datos de la Madre</p>
                                        <input type="text" name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-pink-100 rounded-2xl text-sm font-black text-gray-800 uppercase outline-none focus:ring-4 focus:ring-pink-500/5" />
                                        <input type="text" name="cedulaMadre" placeholder="CÉDULA" value={formData.cedulaMadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-pink-100 rounded-2xl text-sm font-bold text-gray-500 outline-none focus:ring-4 focus:ring-pink-500/5" />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="05" title="Genealogía y Testigos" icon={PenTool} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Abuelos Paternos</label>
                                        <textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] h-28 outline-none resize-none uppercase text-xs font-bold text-gray-600 focus:ring-4 focus:ring-blue-500/5" placeholder="NOMBRES COMPLETOS..." />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Abuelos Maternos</label>
                                        <textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] h-28 outline-none resize-none uppercase text-xs font-bold text-gray-600 focus:ring-4 focus:ring-blue-500/5" placeholder="NOMBRES COMPLETOS..." />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Padrinos</label>
                                        <input type="text" name="padrinos" value={formData.padrinos} onChange={handleChange} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none uppercase font-black text-gray-800 focus:ring-4 focus:ring-blue-500/5" placeholder="NOMBRES SEPARADOS POR COMAS" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Ministro Celebrante</label>
                                        <input type="text" name="ministro" required value={formData.ministro} onChange={handleChange} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none uppercase font-black text-blue-900 border-l-8 border-l-[#4B7BA7] focus:ring-4 focus:ring-blue-500/5" />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="06" title="Registro Civil (Opcional)" icon={ScrollText} />
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Serial Acta</label><input type="text" name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold focus:ring-4 focus:ring-blue-500/5" /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">NUIP / NIP</label><input type="text" name="nuip" value={formData.nuip} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold focus:ring-4 focus:ring-blue-500/5" /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Notaría/Oficina</label><input type="text" name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none uppercase font-bold focus:ring-4 focus:ring-blue-500/5" /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">F. Expedición</label><input type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold focus:ring-4 focus:ring-blue-500/5" /></div>
                                </div>
                            </section>

                            <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] text-white px-12 py-8 rounded-2xl transform active:scale-95 transition-all font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-yellow-900/10">
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Guardar Borrador</>}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
        </div>
    );
};

export default BaptismNewPage;