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
    Calendar, User, Fingerprint, PenTool, Droplet, ShieldCheck, Hash
} from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';

const ConfirmationEditPage = () => {
    const { user } = useAuth();
    const { getParrocos, getCiudadesList } = useAppData(); 
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recordId = searchParams.get('id');

    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(null);
    const [rawOriginal, setRawOriginal] = useState({});
    
    const [ciudades, setCiudades] = useState([]); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);
    
    // 🚀 Lógica inteligente de sacerdotes (Máquina del Tiempo)
    const [listaSacerdotes, setListaSacerdotes] = useState([]);
    const [userChangedDate, setUserChangedDate] = useState(false);

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

                // Carga de Sacerdotes y Autocompletados
                const listaCiudadesRaw = getCiudadesList(parishId) || [];
                setCiudades(listaCiudadesRaw.map(c => (c.nombre || '').toUpperCase()));
                
                const listaParrocos = getParrocos(parishId) || [];
                setListaSacerdotes(listaParrocos);
                setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

                const parrocoActualObj = listaParrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
                const nombreParrocoActual = parrocoActualObj ? `${parrocoActualObj.nombre} ${parrocoActualObj.apellido || ''}`.trim().toUpperCase() : '';

                // 🚀 CARGA ESTRICTA HÍBRIDA (Mapeo Definitivo DBF + Supabase)
                setFormData({
                    id: dbRecord.id,
                    status: dbRecord.status || 'seated',
                    numeroRegistro: dbRecord.numero_registro || raw.NUMINSC || raw.numeroRegistro || raw.inscripcionNumero || '',
                    Libro: dbRecord.book_number || raw.LIBRO || raw.Libro || raw.libro || '',
                    folio: dbRecord.folio || raw.FOLIO || raw.folio || raw.page_number || '',
                    numero: dbRecord.number || raw.NUMERO || raw.numero || raw.entry_number || '',
                    fechaSacramento: dbRecord.celebration_date || raw.FECCON || raw.fechaSacramento || raw.fechaConfirmacion || '',
                    lugarSacramento: raw.LUGCON || raw.lugarSacramento || raw.lugar || raw.place || nombreParroquia,
                    apellidos: dbRecord.apellidos || raw.APELLIDOS || raw.apellidos || raw.lastName || '',
                    nombres: dbRecord.nombres || raw.NOMBRES || raw.nombres || raw.firstName || '',
                    sexo: dbRecord.sexo || raw.SEXO || raw.sexo || raw.sex || '',
                    fechaNacimiento: dbRecord.fecha_nacimiento || raw.FECNAC || raw.fechaNacimiento || raw.birthDate || '',
                    edad: raw.EDAD || raw.edad || raw.metadata?.ageAtConfirmation || '',
                    lugarNacimiento: dbRecord.lugar_nacimiento || raw.lugarNacimiento || '',
                    tipoUnionPadres: dbRecord.tipo_union_padres || raw.tipoUnionPadres || '',
                    nombrePadre: dbRecord.nombre_padre || raw.PADRE || raw.nombrePadre || raw.fatherName || '',
                    cedulaPadre: raw.cedulaPadre || '',
                    nombreMadre: dbRecord.nombre_madre || raw.MADRE || raw.nombreMadre || raw.motherName || '',
                    cedulaMadre: raw.cedulaMadre || '',
                    
                    // Datos de Bautismo
                    lugarBautismo: dbRecord.lugar_bautismo || raw.LUGBAU || raw.lugarBautismo || raw.baptismPlace || raw.baptismData?.place || '',
                    libroBautismo: raw.LIBBAU || raw.libroBautismo || raw.baptismBook || raw.baptismData?.book || '',
                    folioBautismo: raw.FOLBAU || raw.folioBautismo || raw.baptismFolio || raw.baptismData?.folio || '',
                    numeroBautismo: raw.NUMBAU || raw.numeroBautismo || raw.baptismNumber || raw.baptismData?.number || '',

                    padrinos: dbRecord.padrinos || raw.PADRI || raw.padrinos || raw.godparents || '',
                    ministro: dbRecord.ministro || raw.MINISTRO || raw.ministro || raw.minister || '',
                    daFe: dbRecord.da_fe || raw.DAFE || raw.daFe || raw.ministerFaith || nombreParrocoActual,
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
    }, [recordId, parishId, getCiudadesList, getParrocos, navigate, toast, nombreParroquia]);

    // 🚀 INTELIGENCIA 1: Re-calcula el Párroco (Da Fe) SOLAMENTE si el usuario cambia la fecha
    useEffect(() => {
        if (!userChangedDate || !formData?.fechaSacramento || listaSacerdotes.length === 0) return;

        const fechaSeleccionada = new Date(formData.fechaSacramento);
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

    // 🚀 INTELIGENCIA 2: Recalcular Edad Dinámicamente (solo si cambia la fecha y es posible calcularla)
    useEffect(() => {
        if (formData?.fechaNacimiento && formData?.fechaSacramento) {
            const birth = new Date(formData.fechaNacimiento);
            const conf = new Date(formData.fechaSacramento);
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
                // Actualizamos la edad calculada si es válida
                setFormData(prev => ({ ...prev, edad: age >= 0 ? age.toString() : '' }));
            }
        }
    }, [formData?.fechaNacimiento, formData?.fechaSacramento]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'fechaSacramento') setUserChangedDate(true);

        const uppercaseFields = [
            'nombres', 'apellidos', 'lugarNacimiento', 'lugarSacramento', 'lugarBautismo', 
            'padrinos', 'nombrePadre', 'nombreMadre', 'ministro', 'daFe', 'notaMarginal'
        ];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setFormData(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
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
                celebration_date: formData.fechaSacramento || null,
                lugar_bautismo: formData.lugarBautismo || null,
                apellidos: formData.apellidos || null,
                nombres: formData.nombres || null,
                sexo: formData.sexo || null,
                fecha_nacimiento: formData.fechaNacimiento || null,
                lugar_nacimiento: formData.lugarNacimiento || null,
                nombre_padre: formData.nombrePadre || null,
                nombre_madre: formData.nombreMadre || null,
                tipo_union_padres: formData.tipoUnionPadres || null,
                padrinos: formData.padrinos || null,
                ministro: formData.ministro || null,
                da_fe: formData.daFe || null,
                nota_marginal: formData.notaMarginal || null,
                raw_data: payloadToSave, // Aquí se empaca todo: EDAD, NUMINSC, etc.
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

    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-red-600 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 mb-6 flex items-center gap-2 mt-8";

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto px-4 pb-24 pt-6">
                <datalist id="lista-parrocos">
                    {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                </datalist>

                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none font-serif">Editar Partida</h1>
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Registro de Confirmación en la Nube</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] shadow-2xl shadow-red-900/5 border border-gray-100 p-8 md:p-12 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-[#D4AF37] to-red-600"></div>
                    
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 01. Localización Física</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div><label className={labelClass}>Nº Inscripción</label><input type="text" name="numeroRegistro" onChange={handleChange} className={`${inputClass} text-red-600 font-mono`} value={formData.numeroRegistro || ''} /></div>
                            <div><label className={labelClass}>Libro</label><input type="text" name="Libro" onChange={handleChange} className={`${inputClass} font-mono text-lg text-red-600`} value={formData.Libro || ''} required /></div>
                            <div><label className={labelClass}>Folio</label><input type="text" name="folio" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.folio || ''} required /></div>
                            <div><label className={labelClass}>Número (Acta)</label><input type="text" name="numero" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.numero || ''} required /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 02. Datos de la Celebración</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className={labelClass}>Fecha Confirmación</label><input type="date" name="fechaSacramento" required value={toInputDate(formData.fechaSacramento) || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Parroquia / Lugar</label><input type="text" name="lugarSacramento" required value={formData.lugarSacramento || ''} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 03. Identidad del Confirmado</h3>
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
                            <div>
                                <label className={labelClass}>Lugar de Nacimiento</label>
                                <CityAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento || ''} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 04. Filiación</h3>
                        <div className="mb-6">
                            <label className={labelClass}>Tipo de Unión de Padres</label>
                            <select name="tipoUnionPadres" value={formData.tipoUnionPadres || ''} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                <option value="">SELECCIONE...</option>
                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-4 shadow-sm">
                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Datos del Padre</p>
                                <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Padre</label><input type="text" name="cedulaPadre" value={formData.cedulaPadre || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-4 shadow-sm">
                                <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Datos de la Madre</p>
                                <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Madre</label><input type="text" name="cedulaMadre" value={formData.cedulaMadre || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 05. Registro de Bautismo Origen</h3>
                        <div className="space-y-6">
                            <div>
                                <label className={labelClass}>Lugar y Parroquia de Bautismo</label>
                                <ChurchLocationAutocomplete 
                                    value={formData.lugarBautismo || ''} 
                                    onChange={(val) => setFormData(prev => ({...prev, lugarBautismo: val}))}
                                    placeholder="Buscar iglesia y ciudad..."
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <div><label className={labelClass}>Libro Baut.</label><input name="libroBautismo" value={formData.libroBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                <div><label className={labelClass}>Folio Baut.</label><input name="folioBautismo" value={formData.folioBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                <div><label className={labelClass}>Acta Baut.</label><input name="numeroBautismo" value={formData.numeroBautismo || ''} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 06. Ministros y Testigos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-6">
                            <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><input type="text" name="ministro" required value={formData.ministro || ''} onChange={handleChange} className={`${inputClass} border-l-8 border-l-red-600`} /></div>
                            <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" required value={formData.daFe || ''} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                        </div>
                        <div>
                            <label className={labelClass}>Padrinos</label>
                            <input type="text" name="padrinos" value={formData.padrinos || ''} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" />
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 07. Observaciones</h3>
                        <div>
                            <label className={labelClass}>Nota Marginal / Observaciones</label>
                            <textarea name="notaMarginal" value={formData.notaMarginal || ''} onChange={handleChange} className={`${inputClass} h-24 resize-none font-mono text-xs`} />
                        </div>
                    </section>

                    <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                        <Button type="button" variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="px-8 py-6 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-800 text-white px-10 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all transform active:scale-95">
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default ConfirmationEditPage;