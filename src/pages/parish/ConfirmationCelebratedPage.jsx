import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, Calendar, User, Users, 
    BookOpen, PenTool, Loader2, Fingerprint,
    ShieldCheck, ArrowLeft, Search, Droplet, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import { motion } from 'framer-motion';

const ConfirmationCelebratedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const { 
        validateConfirmationNumbers, 
        getMisDatosList, 
        getParrocos
    } = useAppData();

    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);
    const [cloudParams, setCloudParams] = useState({});
    
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    // 🚀 ESTADO ACTUALIZADO (Con notas marginales incluidas)
    const [formData, setFormData] = useState({
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
        nombrePadre: '', 
        nombreMadre: '', 
        lugarBautismo: '',
        padrinos: '', 
        ministro: '', 
        daFe: '',
        notaMarginal: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!parishId) return;

            const misDatos = getMisDatosList(parishId);
            const nombreOficial = misDatos && misDatos.length > 0 ? misDatos[0]?.nombre : nombreParroquia;
            
            const { data: paramData } = await supabase.from('parish_parameters').select('confirmaciones_params').eq('parish_id', parishId).maybeSingle();
            const p = paramData?.confirmaciones_params || {};
            setCloudParams(p);

            setFormData(prev => ({ 
                ...prev, 
                lugarSacramento: (nombreOficial || '').toUpperCase(),
                Libro: String(p.ordinarioLibro || 1).padStart(4, '0'),
                folio: String(p.ordinarioFolio || 1).padStart(4, '0'),
                numero: String(p.ordinarioNumero || 1).padStart(4, '0')
            }));

            const parrocos = getParrocos(parishId) || [];
            setListaSacerdotes(parrocos);
            
            const actual = parrocos.find(p => String(p.estado || p.Estado) === '1');
            if (actual) {
                setFormData(prev => ({ 
                    ...prev, 
                    daFe: `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() 
                }));
            }
        };

        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getParrocos]);

    useEffect(() => {
        if (formData.fechaSacramento && listaSacerdotes.length > 0) {
            const fechaSeleccionada = new Date(formData.fechaSacramento.includes('T') ? formData.fechaSacramento : `${formData.fechaSacramento}T12:00:00`);
            const sacerdoteEncontrado = listaSacerdotes.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const inicio = new Date((s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaSeleccionada >= inicio && fechaSeleccionada <= fin;
            });

            if (sacerdoteEncontrado) {
                const nombreSacerdoteHistorico = `${sacerdoteEncontrado.nombre} ${sacerdoteEncontrado.apellido || ''}`.trim().toUpperCase();
                setFormData(prev => ({ ...prev, daFe: nombreSacerdoteHistorico }));
            }
        }

        if (formData.fechaNacimiento && formData.fechaSacramento) {
            const birthStr = formData.fechaNacimiento.includes('T') ? formData.fechaNacimiento : `${formData.fechaNacimiento}T12:00:00`;
            const confStr = formData.fechaSacramento.includes('T') ? formData.fechaSacramento : `${formData.fechaSacramento}T12:00:00`;
            const birth = new Date(birthStr);
            const conf = new Date(confStr);
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) {
                    age--;
                }
                if (age >= 0 && formData.edad !== age.toString()) {
                    setFormData(prev => ({ ...prev, edad: age.toString() }));
                }
            }
        }
    }, [formData.fechaSacramento, formData.fechaNacimiento, listaSacerdotes]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarSacramento', 'lugarBautismo', 'padrinos', 'nombrePadre', 'nombreMadre', 'ministro', 'daFe', 'notaMarginal'];
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

        setFormData(prev => ({
            ...prev,
            nombres: partida.nombres || partida.firstName || raw.nombres || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || raw.apellidos || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || raw.fechaNacimiento || prev.fechaNacimiento,
            sexo: normalizedSex || prev.sexo,
            nombrePadre: partida.nombrePadre || partida.fatherName || raw.nombrePadre || raw.PADRE || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || raw.nombreMadre || raw.MADRE || prev.nombreMadre,
            lugarBautismo: partida.lugarBautismo || partida.baptismPlace || raw.lugarBautismo || raw.LUGBAU || prev.lugarBautismo
        }));
        
        toast({ title: "Datos Importados", description: `Se han cargado los datos de la partida origen.`, className: "bg-red-50 border-red-200 text-red-900" });
        setIsSearchModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (typeof validateConfirmationNumbers === 'function') {
            const check = await validateConfirmationNumbers(formData.Libro, formData.folio, formData.numero, parishId);
            if (!check.valid) {
                toast({ title: "Ubicación Ocupada", description: "Los números de Libro, Folio o Acta ya existen en Confirmaciones.", variant: "destructive" });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // 🚀 ESTA ES LA REPARACIÓN CLAVE: Las llaves deben ser exactas a como las mapea 
            // el componente de Importación para que el PDF las detecte correctamente.
            const finalRawData = {
                Libro: String(formData.Libro).padStart(4, '0'),
                folio: String(formData.folio).padStart(4, '0'),
                numero: String(formData.numero).padStart(4, '0'),
                fechaSacramento: formData.fechaSacramento || '',
                lugarSacramento: formData.lugarSacramento || '',
                apellidos: formData.apellidos || '',
                nombres: formData.nombres || '',
                fechaNacimiento: formData.fechaNacimiento || '',
                edad: formData.edad || '',
                lugarBautismo: formData.lugarBautismo || '',
                sexo: formData.sexo || '',
                nombrePadre: formData.nombrePadre || '',
                nombreMadre: formData.nombreMadre || '',
                padrinos: formData.padrinos || '',
                ministro: formData.ministro || '',
                daFe: formData.daFe || '',
                notaMarginal: formData.notaMarginal || ''
            };

            const cleanDate = (d) => (d && String(d).trim() !== '') ? d : null;

            const { error: errConf } = await supabase.from('confirmations').insert([{
                parish_id: parishId,
                book_number: formData.Libro,
                folio: formData.folio,
                number: formData.numero,
                status: 'seated', 
                celebration_date: formData.fechaSacramento || null,
                lugar_bautismo: formData.lugarBautismo || null,
                apellidos: formData.apellidos || null,
                nombres: formData.nombres || null,
                sexo: formData.sexo || null,
                fecha_nacimiento: cleanDate(formData.fechaNacimiento),
                nombre_padre: formData.nombrePadre || null,
                nombre_madre: formData.nombreMadre || null,
                padrinos: formData.padrinos || null,
                ministro: formData.ministro || null,
                da_fe: formData.daFe || null,
                nota_marginal: formData.notaMarginal || null,
                raw_data: finalRawData, // El JSON ahora coincide 100% con la plantilla del PDF
                created_at: new Date().toISOString()
            }]);

            if (errConf) throw errConf;

            // Actualizar consecutivo
            let nextNum = parseInt(formData.numero, 10) + 1;
            let nextFol = parseInt(formData.folio, 10);
            if (parseInt(formData.numero, 10) % (parseInt(cloudParams.ordinarioPartidas || 2, 10)) === 0) nextFol++;

            await supabase.from('parish_parameters').upsert({
                parish_id: parishId,
                confirmaciones_params: {
                    ...cloudParams,
                    ordinarioNumero: nextNum,
                    ordinarioFolio: nextFol,
                    ordinarioLibro: parseInt(formData.Libro, 10)
                }
            }, { onConflict: 'parish_id' });

            toast({ title: "Asentamiento Exitoso", description: "La confirmación ha sido inyectada en la base de datos.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/confirmacion/partidas');

        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

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
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className="max-w-5xl mx-auto pb-20 pt-6"
            >
                <datalist id="lista-parrocos">
                    {listaSacerdotes.map((s, idx) => <option key={idx} value={`${s.nombre} ${s.apellido || ''}`.trim().toUpperCase()} />)}
                </datalist>

                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Asiento de Confirmación</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Digitalización Directa de Libros Físicos</p>
                        </div>
                    </div>
                    <div className="bg-red-50 text-red-600 px-5 py-3 rounded-2xl text-[10px] border border-red-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" /> Base de Datos Permanente
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-[#D4AF37] to-red-600"></div>

                    <div className="p-12 space-y-10">
                        {/* 01. UBICACIÓN FÍSICA */}
                        <section>
                            <SectionHeader number="01" title="Protocolo de Archivo" icon={BookOpen} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                <div><label className={labelClass}>Libro</label><input name="Libro" required value={formData.Libro} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-red-600 shadow-sm outline-none focus:ring-4 focus:ring-red-600/10 transition-all" /></div>
                                <div><label className={labelClass}>Folio</label><input name="folio" required value={formData.folio} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-red-600/10 transition-all" /></div>
                                <div><label className={labelClass}>Número (Acta)</label><input name="numero" required value={formData.numero} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none focus:ring-4 focus:ring-red-600/10 transition-all" /></div>
                            </div>
                        </section>

                        {/* 02. CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Asiento del Sacramento" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Fecha Confirmación</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar Celebración</label><input name="lugarSacramento" required value={formData.lugarSacramento} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 03. EL CONFIRMADO */}
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
                                    <label className={labelClass}>Edad Conf.</label>
                                    <div className="relative">
                                        <input type="number" name="edad" value={formData.edad} onChange={handleChange} className={`${inputClass} pr-12`} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">AÑOS</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 04. FILIACIÓN */}
                        <section>
                            <SectionHeader number="04" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Padre</p>
                                    <input name="nombrePadre" required placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" required placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 05. REGISTRO BAUTISMAL */}
                        <section>
                            <SectionHeader number="05" title="Registro de Bautismo Origen" icon={Droplet} />
                            <div className="space-y-6">
                                <div><label className={labelClass}>Lugar y Parroquia de Bautismo</label><input name="lugarBautismo" required value={formData.lugarBautismo} onChange={handleChange} className={inputClass} placeholder="EJ: PARROQUIA SAN JUAN BAUTISTA" /></div>
                            </div>
                        </section>

                        {/* 06. AUTORIDAD */}
                        <section>
                            <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><input name="ministro" required value={formData.ministro} onChange={handleChange} className={`${inputClass} border-l-8 border-l-red-600`} placeholder="EXCMO. MONS..." /></div>
                                <div><label className={labelClass}>Da Fe (Párroco)</label><input name="daFe" required value={formData.daFe} onChange={handleChange} list="lista-parrocos" className={inputClass} /></div>
                            </div>
                            <div><label className={labelClass}>Padrinos</label><input name="padrinos" required value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </section>

                        {/* 07. NOTAS MARGINALES */}
                        <section>
                            <SectionHeader number="07" title="Notas Marginales" icon={FileText} />
                            <div>
                                <label className={labelClass}>Anotaciones (Opcional)</label>
                                <textarea 
                                    name="notaMarginal" 
                                    value={formData.notaMarginal} 
                                    onChange={handleChange} 
                                    className={`${inputClass} min-h-[100px] py-4 resize-y`} 
                                    placeholder="REGISTRE CUALQUIER ANOTACIÓN ADICIONAL AQUÍ..." 
                                />
                            </div>
                        </section>

                        <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-red-600 to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Asentar Permanentemente
                            </Button>
                        </div>
                    </div>
                </form>
            </motion.div>

            {/* Modal Buscador de Partidas */}
            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onSelectPartida={handleSelectBaptismPartida}
            />
        </DashboardLayout>
    );
};

export default ConfirmationCelebratedPage;