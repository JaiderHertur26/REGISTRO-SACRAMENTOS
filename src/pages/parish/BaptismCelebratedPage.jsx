import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, Calendar, User, Users, 
    BookOpen, PenTool, Loader2, Fingerprint,
    ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import CityAutocomplete from '@/components/CityAutocomplete';

const BaptismCelebratedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    
    // Funciones del contexto para validación, catálogos y guardado permanente
    const { 
        validateBaptismNumbers, 
        getMisDatosList, 
        getCiudadesList, 
        saveBaptism, 
        getParrocos 
    } = useAppData();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ciudades, setCiudades] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    // =========================================================================
    // 📖 DICCIONARIO ÚNICO DE 20 CAMPOS (ESPAÑOL)
    // =========================================================================
    const [formData, setFormData] = useState({
        Libro: '', 
        folio: '', 
        numero: '',
        fechaSacramento: '', 
        lugarBautismo: '', 
        apellidos: '', 
        nombres: '', 
        sexo: '', 
        fechaNacimiento: '', 
        lugarNacimiento: '', 
        tipoUnionPadres: '', 
        nombrePadre: '', 
        cedulaPadre: '', 
        nombreMadre: '', 
        cedulaMadre: '', 
        abuelosPaternos: '', 
        abuelosMaternos: '', 
        padrinos: '', 
        ministro: '', 
        daFe: ''
    });

    // --- 1. CARGA DE DATOS AUTOMÁTICOS AL INICIAR ---
    useEffect(() => {
        if (!user?.parishId) return;

        // Cargar nombre de la Parroquia para el lugar de bautismo
        const misDatos = getMisDatosList(user.parishId);
        const nombreOficial = misDatos[0]?.nombre || user.parishName || '';
        if (nombreOficial) {
            setFormData(prev => ({ ...prev, lugarBautismo: nombreOficial.toUpperCase() }));
        }

        // 🏙️ Cargar ciudades desde el catálogo diocesano (Datos Auxiliares)
        const contextId = user.dioceseId || user.parishId;
        const listaCruda = getCiudadesList(contextId) || [];
        const nombresDeCiudades = listaCruda.map(c => (c.nombre || '').toUpperCase());
        setCiudades(nombresDeCiudades);

        // Cargar sacerdotes para la lógica de periodos
        const parrocos = getParrocos(user.parishId) || [];
        setListaSacerdotes(parrocos);
        
        // Identificar Párroco Actual para el "Da Fe" por defecto
        const actual = parrocos.find(p => String(p.estado) === '1');
        if (actual) {
            setFormData(prev => ({ 
                ...prev, 
                daFe: `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() 
            }));
        }
    }, [user, getMisDatosList, getCiudadesList, getParrocos]);

    // --- 2. 🧠 LÓGICA: IDENTIFICAR MINISTRO POR PERIODO DE FECHA ---
    useEffect(() => {
        if (!formData.fechaSacramento || listaSacerdotes.length === 0) return;

        const fechaSeleccionada = new Date(formData.fechaSacramento);

        const sacerdoteEncontrado = listaSacerdotes.find(s => {
            const inicio = new Date(s.fechaIngreso || s.fechaNombramiento);
            // Si no hay fecha de salida, se asume que es el actual (fecha de hoy)
            const fin = s.fechaSalida ? new Date(s.fechaSalida) : new Date();

            return fechaSeleccionada >= inicio && fechaSeleccionada <= fin;
        });

        if (sacerdoteEncontrado) {
            setFormData(prev => ({ 
                ...prev, 
                ministro: `${sacerdoteEncontrado.nombre} ${sacerdoteEncontrado.apellido || ''}`.trim().toUpperCase() 
            }));
        }
    }, [formData.fechaSacramento, listaSacerdotes]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // =========================================================================
    // 🚀 ENVÍO DIRECTO A LA BASE DE DATOS PERMANENTE
    // =========================================================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación de duplicidad en Libro/Folio/Número
        const check = await validateBaptismNumbers(formData.Libro, formData.folio, formData.numero, user?.parishId);
        if (!check.valid) {
            toast({ 
                title: "Ubicación Ocupada", 
                description: "Los números de Libro, Folio o Acta ya existen en los registros.", 
                variant: "destructive" 
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const registroFinal = {
                ...formData,
                parishId: user.parishId,
                status: 'seated', // Se guarda directamente como asentado (Permanente)
                // Formateo estandarizado para el archivo en Mayúsculas
                nombres: formData.nombres.toUpperCase(),
                apellidos: formData.apellidos.toUpperCase(),
                lugarNacimiento: formData.lugarNacimiento.toUpperCase(),
                nombrePadre: formData.nombrePadre.toUpperCase(),
                nombreMadre: formData.nombreMadre.toUpperCase()
            };

            // Guardado mediante el contexto (Sin importación directa de supabase)
            await saveBaptism(registroFinal);

            toast({ 
                title: "Asentamiento Exitoso", 
                description: "El registro histórico ha sido inyectado en la base de datos.",
                className: "bg-green-50 text-green-900 border-green-200" 
            });

            // Redirección a la Base de Datos para verificar la fila
            navigate('/parroquia/bautismo/base-datos');
            
        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">
                {number}
            </div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />}
                {title}
            </h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-5xl mx-auto pb-20">
                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Asiento de Bautismo</h1>
                        <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Digitalización Directa de Libros Físicos</p>
                    </div>
                    <div className="bg-blue-50 text-[#4B7BA7] px-5 py-3 rounded-2xl text-[10px] border border-blue-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" />
                        Base de Datos Permanente
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>

                    <div className="p-12 space-y-16">

                        {/* 01. UBICACIÓN FÍSICA */}
                        <section>
                            <SectionHeader number="01" title="Protocolo de Archivo" icon={BookOpen} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Libro</label>
                                    <input name="Libro" required value={formData.Libro} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" placeholder="000" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Folio</label>
                                    <input name="folio" required value={formData.folio} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" placeholder="000" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Número</label>
                                    <input name="numero" required value={formData.numero} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" placeholder="000" />
                                </div>
                            </div>
                        </section>

                        {/* 02. CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Asiento del Sacramento" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Sacramento</label>
                                    <input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white transition-all font-bold text-gray-700" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lugar Bautismo</label>
                                    <input name="lugarBautismo" required value={formData.lugarBautismo} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-black text-gray-600 outline-none" />
                                </div>
                            </div>
                        </section>

                        {/* 03. EL BAUTIZADO */}
                        <section>
                            <SectionHeader number="03" title="Identidad del Sujeto" icon={User} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Apellidos</label><input name="apellidos" required value={formData.apellidos} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-black text-gray-900 text-lg shadow-sm outline-none focus:bg-white transition-all" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombres</label><input name="nombres" required value={formData.nombres} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl uppercase font-black text-gray-900 text-lg shadow-sm outline-none focus:bg-white transition-all" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sexo</label>
                                    <select name="sexo" required value={formData.sexo} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-700 uppercase outline-none cursor-pointer shadow-sm focus:bg-white transition-all">
                                        <option value="">SELECCIONE...</option>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                    </select>
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Nacimiento</label><input type="date" name="fechaNacimiento" required value={formData.fechaNacimiento} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 shadow-sm outline-none focus:bg-white transition-all" /></div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lugar Nacimiento</label>
                                    {/* AUTOCOMPLETADO CONECTADO A CIUDADES AUXILIARES */}
                                    <CityAutocomplete 
                                        name="lugarNacimiento" 
                                        value={formData.lugarNacimiento} 
                                        onChange={handleChange} 
                                        cities={ciudades} 
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-700 uppercase shadow-sm outline-none focus:bg-white transition-all" 
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 04. FILIACIÓN */}
                        <section>
                            <SectionHeader number="04" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="mb-8">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-3 block">Tipo de Unión de Padres</label>
                                <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                    <option value="">SELECCIONE...</option>
                                    <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                    <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                    <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                    <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                    <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Padre</p>
                                    <input name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl font-black uppercase text-gray-800 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" />
                                    <input name="cedulaPadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaPadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl font-bold text-gray-500 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" />
                                </div>
                                <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-pink-100 rounded-2xl font-black uppercase text-gray-800 outline-none focus:ring-4 focus:ring-pink-500/5 transition-all" />
                                    <input name="cedulaMadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaMadre} onChange={handleChange} className="w-full px-5 py-4 bg-white border border-pink-100 rounded-2xl font-bold text-gray-500 outline-none focus:ring-4 focus:ring-pink-500/5 transition-all" />
                                </div>
                            </div>
                        </section>

                        {/* 05. ABUELOS */}
                        <section>
                            <SectionHeader number="05" title="Rama Genealógica" icon={Users} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Abuelos Paternos</label>
                                    <textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] h-28 outline-none resize-none uppercase text-xs font-bold text-gray-600 shadow-inner focus:bg-white transition-all" placeholder="Ingrese nombres..." />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Abuelos Maternos</label>
                                    <textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] h-28 outline-none resize-none uppercase text-xs font-bold text-gray-600 shadow-inner focus:bg-white transition-all" placeholder="Ingrese nombres..." />
                                </div>
                            </div>
                        </section>

                        {/* 06. AUTORIDAD */}
                        <section>
                            <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sacerdote Celebrante</label>
                                    {/* EDITABLE: El sistema sugiere por fecha pero el usuario puede cambiarlo libremente */}
                                    <input name="ministro" required value={formData.ministro} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none uppercase font-black text-blue-900 border-l-8 border-l-[#4B7BA7] shadow-sm focus:bg-white transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Da Fe (Párroco)</label>
                                    <input name="daFe" required value={formData.daFe} onChange={handleChange} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none uppercase font-black text-gray-700 shadow-sm focus:bg-white transition-all" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Padrinos</label>
                                <input name="padrinos" value={formData.padrinos} onChange={handleChange} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none uppercase font-black text-gray-800 shadow-sm focus:bg-white transition-all" placeholder="NOMBRES SEPARADOS POR COMAS" />
                            </div>
                        </section>

                        <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                                Asentar Permanentemente
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismCelebratedPage;