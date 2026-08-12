import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, ArrowLeft, Calendar, User, Users, BookOpen, PenTool, 
    Loader2, ScrollText, MapPin, Hash 
} from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';

const BaptismCelebratedPage = () => {
    const { user } = useAuth(); 
    const { getMisDatosList, getCiudadesList, getParrocos, saveBaptismToSource, getBaptismParameters, saveBaptismParameters } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const parishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ciudades, setCiudades] = useState([]); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);

    // 📖 DICCIONARIO CANÓNICO EXACTO
    const [formData, setFormData] = useState({
        numeroRegistro: '---', Libro: '', folio: '', numero: '',
        fechaSacramento: '', horaSacramento: '10:00', lugarBautismo: nombreParroquia,
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', lugarNacimiento: '', 
        nuip: '', serialRegistro: '', oficinaRegistro: '', fechaExpedicionRegistro: '', 
        nombrePadre: '', cedulaPadre: '', nombreMadre: '', cedulaMadre: '', tipoUnionPadres: '', 
        abuelosPaternos: '', abuelosMaternos: '', direccion: '', 
        padrinos: '', ministro: '', daFe: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!parishId) return;

            const misDatos = getMisDatosList(parishId);
            if (misDatos?.length > 0) {
                setFormData(prev => ({ ...prev, lugarBautismo: (misDatos[0].nombre || nombreParroquia).toUpperCase() }));
            }

            const p = await getBaptismParameters(parishId);
            setFormData(prev => ({
                ...prev,
                Libro: String(p.ordinarioLibro || 1).padStart(4, '0'),
                folio: String(p.ordinarioFolio || 1).padStart(4, '0'),
                numero: String(p.ordinarioNumero || 1).padStart(4, '0')
            }));

            const listaCiudadesRaw = getCiudadesList(parishId) || [];
            setCiudades(listaCiudadesRaw.map(c => (c.nombre || '').toUpperCase()));
            
            const listaParrocos = getParrocos(parishId) || [];
            setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));
        };
        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getCiudadesList, getParrocos, getBaptismParameters]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'direccion', 'oficinaRegistro', 'padrinos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setFormData(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const res = await saveBaptismToSource(formData, parishId, 'seated');

            if (res.success) {
                // Incrementar Parámetros en BD
                const p = await getBaptismParameters(parishId);
                let nextNum = parseInt(formData.numero, 10) + 1;
                let nextFol = parseInt(formData.folio, 10);
                if (parseInt(formData.numero, 10) % (parseInt(p.ordinarioPartidas || 2, 10)) === 0) nextFol++;

                await saveBaptismParameters({
                    ...p,
                    ordinarioNumero: nextNum,
                    ordinarioFolio: nextFol,
                    ordinarioLibro: parseInt(formData.Libro, 10)
                }, parishId);

                toast({ title: "Asentamiento Exitoso", description: "Guardado directo en la base de datos permanente.", className: "bg-green-50 text-green-900 border-green-200" });
                navigate('/parroquia/bautismo/partidas');
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-[#4B7BA7] uppercase tracking-[0.2em] border-b border-gray-100 pb-3 mb-6 flex items-center gap-2 mt-8";

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto pb-24 pt-6">
                <datalist id="lista-parrocos">
                    {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                </datalist>

                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Bautismo Celebrado</h1>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Asentamiento Directo Permanente</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-gray-100 p-8 md:p-12 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>
                    
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 01. Archivo y Control</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div><label className={labelClass}>Libro</label><input type="text" name="Libro" required value={formData.Libro} onChange={handleChange} className={`${inputClass} text-[#4B7BA7]`} /></div>
                            <div><label className={labelClass}>Folio</label><input type="text" name="folio" required value={formData.folio} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Acta Nº</label><input type="text" name="numero" required value={formData.numero} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 02. Datos de la Celebración</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Hora</label><input type="time" name="horaSacramento" value={formData.horaSacramento} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Parroquia</label><input type="text" name="lugarBautismo" required value={formData.lugarBautismo} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 03. Identidad del Bautizado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} className={inputClass} /></div>
                            <div>
                                <label className={labelClass}>Sexo</label>
                                <select name="sexo" required value={formData.sexo} onChange={handleChange} className={inputClass}>
                                    <option value="">SELECCIONE...</option>
                                    <option value="MASCULINO">MASCULINO</option>
                                    <option value="FEMENINO">FEMENINO</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className={inputClass} /></div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Lugar de Nacimiento</label>
                                <CityAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 04. Registro Civil</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div><label className={labelClass}>NUIP / NIP</label><input type="text" name="nuip" value={formData.nuip} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Serial Acta</label><input type="text" name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Notaría/Oficina</label><input type="text" name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>F. Expedición</label><input type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 05. Filiación y Residencia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50 space-y-4">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Padre</p>
                                <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Padre</label><input type="text" name="cedulaPadre" value={formData.cedulaPadre} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="bg-pink-50/30 p-6 rounded-[2rem] border border-pink-100/50 space-y-4">
                                <p className="text-[9px] font-black text-pink-600 uppercase tracking-widest mb-2">Madre</p>
                                <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Cédula Madre</label><input type="text" name="cedulaMadre" value={formData.cedulaMadre} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Tipo de Unión de Padres</label>
                                <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className={inputClass}>
                                    <option value="">SELECCIONE...</option>
                                    <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                    <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                    <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                    <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Dirección de Residencia</label><input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 06. Genealogía y Testigos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className={labelClass}>Abuelos Paternos</label><textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className={`${inputClass} h-20 resize-none`} /></div>
                            <div><label className={labelClass}>Abuelos Maternos</label><textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className={`${inputClass} h-20 resize-none`} /></div>
                            <div className="md:col-span-2"><label className={labelClass}>Padrinos</label><textarea name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} h-16 resize-none`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </div>
                    </section>

                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 07. Ministros</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className={labelClass}>Sacerdote Celebrante</label><input type="text" name="ministro" value={formData.ministro} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                            <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" value={formData.daFe} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                        </div>
                    </section>

                    <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                        <Button type="button" variant="ghost" onClick={() => navigate('/parroquia/bautismo/partidas')} className="px-8 py-6 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all">
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Asentar Permanentemente
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismCelebratedPage;