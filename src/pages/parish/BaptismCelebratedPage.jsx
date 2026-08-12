import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, Calendar, User, Users, 
    BookOpen, PenTool, Loader2, Fingerprint,
    ShieldCheck, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import CityAutocomplete from '@/components/CityAutocomplete';

const BaptismCelebratedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const { 
        validateBaptismNumbers, 
        getMisDatosList, 
        getCiudadesList, 
        saveBaptismToSource, 
        getParrocos,
        getBaptismParameters,
        saveBaptismParameters
    } = useAppData();

    const parishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ciudades, setCiudades] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    // 📖 DICCIONARIO EXACTO A SU NATURALEZA ORIGINAL (Solo 20 campos)
    const [formData, setFormData] = useState({
        Libro: '', 
        folio: '', 
        numero: '',
        fechaSacramento: '', 
        lugarBautismo: nombreParroquia, 
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

    useEffect(() => {
        const loadInitialData = async () => {
            if (!parishId) return;

            const misDatos = getMisDatosList(parishId);
            const nombreOficial = misDatos[0]?.nombre || nombreParroquia;
            
            const p = await getBaptismParameters(parishId);

            setFormData(prev => ({ 
                ...prev, 
                lugarBautismo: nombreOficial.toUpperCase(),
                Libro: String(p.ordinarioLibro || 1).padStart(4, '0'),
                folio: String(p.ordinarioFolio || 1).padStart(4, '0'),
                numero: String(p.ordinarioNumero || 1).padStart(4, '0')
            }));

            const listaCruda = getCiudadesList(parishId) || [];
            setCiudades(listaCruda.map(c => (c.nombre || '').toUpperCase()));

            const parrocos = getParrocos(parishId) || [];
            setListaSacerdotes(parrocos);
            
            const actual = parrocos.find(p => String(p.estado) === '1');
            if (actual) {
                setFormData(prev => ({ 
                    ...prev, 
                    daFe: `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() 
                }));
            }
        };

        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getCiudadesList, getParrocos, getBaptismParameters]);

    useEffect(() => {
        if (!formData.fechaSacramento || listaSacerdotes.length === 0) return;

        const fechaSeleccionada = new Date(formData.fechaSacramento);
        const sacerdoteEncontrado = listaSacerdotes.find(s => {
            const inicio = new Date(s.fechaIngreso || s.fechaNombramiento);
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
        // 🚀 LIMPIEZA: Solo los campos exactos de este formulario
        const uppercaseFields = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'padrinos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setFormData(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const check = await validateBaptismNumbers(formData.Libro, formData.folio, formData.numero, parishId);
        if (!check.valid) {
            toast({ title: "Ubicación Ocupada", description: "Los números de Libro, Folio o Acta ya existen.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await saveBaptismToSource(formData, parishId, 'seated');

            if (res.success) {
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

                toast({ title: "Asentamiento Exitoso", description: "El registro histórico ha sido inyectado en la base de datos.", className: "bg-green-50 text-green-900 border-green-200" });
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

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto pb-20 pt-6">
                <datalist id="lista-parrocos">
                    {listaSacerdotes.map((s, idx) => <option key={idx} value={`${s.nombre} ${s.apellido || ''}`.trim().toUpperCase()} />)}
                </datalist>

                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Asiento de Bautismo</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Digitalización Directa de Libros Físicos</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 text-[#4B7BA7] px-5 py-3 rounded-2xl text-[10px] border border-blue-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" /> Base de Datos Permanente
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>

                    <div className="p-12 space-y-10">
                        {/* 01. UBICACIÓN FÍSICA */}
                        <section>
                            <SectionHeader number="01" title="Protocolo de Archivo" icon={BookOpen} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                <div><label className={labelClass}>Libro</label><input name="Libro" required value={formData.Libro} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                                <div><label className={labelClass}>Folio</label><input name="folio" required value={formData.folio} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                                <div><label className={labelClass}>Número (Acta)</label><input name="numero" required value={formData.numero} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                            </div>
                        </section>

                        {/* 02. CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Asiento del Sacramento" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar Bautismo</label><input name="lugarBautismo" required value={formData.lugarBautismo} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 03. EL BAUTIZADO */}
                        <section>
                            <SectionHeader number="03" title="Identidad del Sujeto" icon={User} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Apellidos</label><input name="apellidos" required value={formData.apellidos} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Nombres</label><input name="nombres" required value={formData.nombres} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div>
                                    <label className={labelClass}>Sexo</label>
                                    <select name="sexo" required value={formData.sexo} onChange={handleChange} className={inputClass}>
                                        <option value="">SELECCIONE...</option>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                    </select>
                                </div>
                                <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" required value={formData.fechaNacimiento} onChange={handleChange} className={inputClass} /></div>
                                <div>
                                    <label className={labelClass}>Lugar de Nacimiento</label>
                                    <CityAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 04. FILIACIÓN */}
                        <section>
                            <SectionHeader number="04" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="mb-8">
                                <label className={labelClass}>Tipo de Unión de Padres</label>
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
                                    <input name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className={inputClass} />
                                    <input name="cedulaPadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaPadre} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className={inputClass} />
                                    <input name="cedulaMadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaMadre} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 05. ABUELOS */}
                        <section>
                            <SectionHeader number="05" title="Rama Genealógica" icon={Users} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Abuelos Paternos</label><textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} placeholder="Ingrese nombres..." /></div>
                                <div><label className={labelClass}>Abuelos Maternos</label><textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} placeholder="Ingrese nombres..." /></div>
                            </div>
                        </section>

                        {/* 06. AUTORIDAD */}
                        <section>
                            <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" required value={formData.ministro} onChange={handleChange} list="lista-parrocos" className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} /></div>
                                <div><label className={labelClass}>Da Fe (Párroco)</label><input name="daFe" required value={formData.daFe} onChange={handleChange} list="lista-parrocos" className={inputClass} /></div>
                            </div>
                            <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </section>

                        <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Asentar Permanentemente
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismCelebratedPage;