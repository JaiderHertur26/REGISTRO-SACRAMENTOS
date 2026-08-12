import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient'; 
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';

const BaptismEditPage = () => {
    const { user } = useAuth();
    const { getParrocos, getCiudadesList, purificarRegistroBautismo, saveBaptismToSource } = useAppData(); 
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recordId = searchParams.get('id');

    const parishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(null);
    const [ciudades, setCiudades] = useState([]); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);

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
            navigate('/parroquia/bautismo/partidas');
            return;
        }

        const loadRecord = async () => {
            setIsLoading(true);
            try {
                const { data: dbRecord, error } = await supabase
                    .from('baptisms')
                    .select('*')
                    .eq('id', recordId)
                    .single();

                if (error || !dbRecord) throw new Error("Registro no encontrado.");

                const raw = typeof dbRecord.raw_data === 'string' ? JSON.parse(dbRecord.raw_data) : (dbRecord.raw_data || {});
                
                const purificado = purificarRegistroBautismo({
                    ...raw,
                    id: dbRecord.id,
                    status: dbRecord.status,
                    marginNote: dbRecord.margin_note || raw.notaMarginal,
                    Libro: dbRecord.book_number || raw.Libro,
                    folio: dbRecord.page_number || raw.folio || raw.page_number,
                    numero: dbRecord.entry_number || raw.numero || raw.number
                });

                setFormData(purificado);

                const listaCiudadesRaw = getCiudadesList(parishId) || [];
                setCiudades(listaCiudadesRaw.map(c => (c.nombre || '').toUpperCase()));
                
                const listaParrocos = getParrocos(parishId) || [];
                setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

            } catch (error) {
                toast({ title: "Error", description: "No se pudo cargar el registro.", variant: "destructive" });
                navigate('/parroquia/bautismo/partidas');
            } finally {
                setIsLoading(false);
            }
        };

        loadRecord();
    }, [recordId, parishId, getCiudadesList, getParrocos, navigate, purificarRegistroBautismo, toast]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'direccion', 'oficinaRegistro', 'padrinos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe', 'notaMarginal'];
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
            const res = await saveBaptismToSource(formData, parishId, formData.status || 'seated');
            
            if (res.success) {
                toast({ title: "¡Actualizado!", description: "Sincronizado con la Base de Datos Central.", className: "bg-green-600 text-white" });
                navigate('/parroquia/bautismo/partidas');
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !formData) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mb-4" />
                <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Accediendo a la Nube...</p>
            </div>
        </DashboardLayout>
    );

    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-[#4B7BA7] uppercase tracking-[0.2em] border-b border-gray-100 pb-3 mb-6 flex items-center gap-2 mt-8";

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto px-4 pb-24 pt-6">
                <datalist id="lista-parrocos">
                    {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                </datalist>

                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/partidas')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Editar Partida</h1>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Registro en Base de Datos Permanente</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-gray-100 p-8 md:p-12 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>
                    
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 01. Localización Física</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div><label className={labelClass}>Libro</label><input type="text" name="Libro" onChange={handleChange} className={`${inputClass} font-mono text-lg text-[#4B7BA7]`} value={formData.Libro || ''} required /></div>
                            <div><label className={labelClass}>Folio</label><input type="text" name="folio" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.folio || ''} required /></div>
                            <div><label className={labelClass}>Número (Acta)</label><input type="text" name="numero" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.numero || ''} required /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 02. Datos de la Celebración</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" required value={toInputDate(formData.fechaSacramento) || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Hora</label><input type="time" name="horaSacramento" value={formData.horaSacramento || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Parroquia</label><input type="text" name="lugarBautismo" required value={formData.lugarBautismo || ''} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 03. Identidad del Bautizado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleChange} className={inputClass} /></div>
                            <div>
                                <label className={labelClass}>Sexo</label>
                                <select name="sexo" required value={formData.sexo || ''} onChange={handleChange} className={inputClass}>
                                    <option value="">SELECCIONE...</option>
                                    <option value="MASCULINO">MASCULINO</option>
                                    <option value="FEMENINO">FEMENINO</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={toInputDate(formData.fechaNacimiento) || ''} onChange={handleChange} className={inputClass} /></div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Lugar de Nacimiento</label>
                                <CityAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento || ''} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 04. Registro Civil</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div><label className={labelClass}>NUIP / NIP</label><input type="text" name="nuip" value={formData.nuip || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Serial Acta</label><input type="text" name="serialRegistro" value={formData.serialRegistro || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Notaría/Oficina</label><input type="text" name="oficinaRegistro" value={formData.oficinaRegistro || ''} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>F. Expedición</label><input type="date" name="fechaExpedicionRegistro" value={toInputDate(formData.fechaExpedicionRegistro) || ''} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 05. Filiación y Residencia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50 space-y-4">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Padre</p>
                                <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Padre</label><input type="text" name="cedulaPadre" value={formData.cedulaPadre || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="bg-pink-50/30 p-6 rounded-[2rem] border border-pink-100/50 space-y-4">
                                <p className="text-[9px] font-black text-pink-600 uppercase tracking-widest mb-2">Madre</p>
                                <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre || ''} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Madre</label><input type="text" name="cedulaMadre" value={formData.cedulaMadre || ''} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Tipo de Unión de Padres</label>
                                <select name="tipoUnionPadres" value={formData.tipoUnionPadres || ''} onChange={handleChange} className={inputClass}>
                                    <option value="">SELECCIONE...</option>
                                    <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                    <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                    <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                    <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                    <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Dirección de Residencia</label><input type="text" name="direccion" value={formData.direccion || ''} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 06. Genealogía y Testigos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className={labelClass}>Abuelos Paternos</label><textarea name="abuelosPaternos" value={formData.abuelosPaternos || ''} onChange={handleChange} className={`${inputClass} h-20 resize-none`} /></div>
                            <div><label className={labelClass}>Abuelos Maternos</label><textarea name="abuelosMaternos" value={formData.abuelosMaternos || ''} onChange={handleChange} className={`${inputClass} h-20 resize-none`} /></div>
                            <div className="md:col-span-2"><label className={labelClass}>Padrinos</label><textarea name="padrinos" value={formData.padrinos || ''} onChange={handleChange} className={`${inputClass} h-16 resize-none`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 07. Ministros y Notas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div><label className={labelClass}>Sacerdote Celebrante</label><input type="text" name="ministro" value={formData.ministro || ''} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                            <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" value={formData.daFe || ''} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                        </div>
                        <div>
                            <label className={labelClass}>Nota Marginal / Observaciones</label>
                            <textarea name="notaMarginal" value={formData.notaMarginal || ''} onChange={handleChange} className={`${inputClass} h-24 resize-none font-mono text-xs`} />
                        </div>
                    </section>

                    <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                        <Button type="button" variant="ghost" onClick={() => navigate('/parroquia/bautismo/partidas')} className="px-8 py-6 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all transform active:scale-95">
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Actualizar Registro
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismEditPage;