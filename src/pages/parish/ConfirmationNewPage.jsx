import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, X, Calendar, User, Users, BookOpen, PenTool, 
    CheckCircle2, Loader2, MapPin, Hash, AlertCircle, Search, Droplet 
} from 'lucide-react';
import ConfirmationTicket from '@/components/ConfirmationTicket';
import CityAutocomplete from '@/components/CityAutocomplete';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import { calculateNextRegistro } from '@/services/sacramentParametersService';
import { supabase } from '@/lib/supabaseClient'; 

const ConfirmationNewPage = () => {
    const { user } = useAuth(); 
    const { getMisDatosList, getCiudadesList, getParrocos, saveConfirmationToSource, getConfirmationParameters } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    
    const [ticketData, setTicketData] = useState(null);
    const [parishInfo, setParishInfo] = useState(null); 
    const [ciudades, setCiudades] = useState([]); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]); 
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [formData, setFormData] = useState({
        numeroRegistro: '', Libro: '---', folio: '---', numero: '---',
        fechaSacramento: '', lugarSacramento: nombreParroquia,
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', edad: '', lugarNacimiento: '', 
        tipoUnionPadres: '', nombrePadre: '', cedulaPadre: '', nombreMadre: '', cedulaMadre: '', 
        lugarBautismo: '', libroBautismo: '', folioBautismo: '', numeroBautismo: '',
        padrinos: '', ministro: '', daFe: '', notaMarginal: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!parishId) return;

            const misDatos = getMisDatosList(parishId);
            if (misDatos?.length > 0) {
                setParishInfo(misDatos[0]);
                setFormData(prev => ({ ...prev, lugarSacramento: (misDatos[0].nombre || nombreParroquia).toUpperCase() }));
            }

            const listaCiudadesRaw = getCiudadesList(parishId) || [];
            setCiudades(listaCiudadesRaw.map(c => (c.nombre || '').toUpperCase()));
            
            const listaParrocos = getParrocos(parishId) || [];
            setListaSacerdotes(listaParrocos); 
            setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

            // 🚀 Auto-asignar el Párroco Actual a "Da Fe" al cargar
            const parrocoActual = listaParrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
            if (parrocoActual) {
                const nombreCompletoActual = `${parrocoActual.nombre} ${parrocoActual.apellido || ''}`.trim().toUpperCase();
                setFormData(prev => ({ 
                    ...prev, 
                    daFe: nombreCompletoActual
                }));
            }

            const p = await getConfirmationParameters(parishId);
            if (p) {
                setFullParamsCache(p);
                setFormData(prev => ({ ...prev, numeroRegistro: p.numeroRegistroActual || '' }));
            }
        };
        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getCiudadesList, getParrocos, getConfirmationParameters]);

    // 🚀 INTELIGENCIA: Máquina del tiempo para el Párroco que Da Fe
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
                daFe: `${sacerdoteEncontrado.nombre} ${sacerdoteEncontrado.apellido || ''}`.trim().toUpperCase() 
            }));
        }
    }, [formData.fechaSacramento, listaSacerdotes]);

    // 🚀 INTELIGENCIA: Cálculo Dinámico de Edad
    useEffect(() => {
        if (formData.fechaNacimiento && formData.fechaSacramento) {
            const birth = new Date(formData.fechaNacimiento);
            const conf = new Date(formData.fechaSacramento);
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
                setFormData(prev => ({ ...prev, edad: age >= 0 ? age.toString() : '' }));
            }
        }
    }, [formData.fechaNacimiento, formData.fechaSacramento]);

    const handleChange = (e) => {
        const { name, value } = e.target;
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

    const handleSelectBaptismPartida = (partida) => {
        let normalizedSex = '';
        if (partida.sex || partida.sexo) {
            const rawSex = String(partida.sex || partida.sexo).toUpperCase();
            if (rawSex.startsWith('M')) normalizedSex = 'MASCULINO';
            else if (rawSex.startsWith('F')) normalizedSex = 'FEMENINO';
        }

        setFormData(prev => ({
            ...prev,
            nombres: partida.nombres || partida.firstName || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || prev.fechaNacimiento,
            sexo: normalizedSex || prev.sexo,
            nombrePadre: partida.nombrePadre || partida.fatherName || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || prev.nombreMadre,
            lugarBautismo: partida.lugarBautismo || partida.baptismPlace || prev.lugarBautismo,
            libroBautismo: partida.book_number || partida.libro || partida.baptismBook || prev.libroBautismo,
            folioBautismo: partida.page_number || partida.folio || partida.baptismFolio || prev.folioBautismo,
            numeroBautismo: partida.entry_number || partida.numero || partida.baptismNumber || prev.numeroBautismo
        }));
        
        toast({ title: "Datos Importados", description: `Se han cargado los datos de ${partida.nombres} ${partida.apellidos}.`, className: "bg-red-50 border-red-200 text-red-900" });
        setIsSearchModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            // 🚀 Calcular el Número de Registro Matemáticamente
            const currentRegistro = fullParamsCache?.numeroRegistroActual || "000000";
            const nextReg = calculateNextRegistro(currentRegistro);
            
            const dataToSave = { ...formData, numeroRegistro: nextReg };

            // Usamos saveConfirmationToSource
            const res = await saveConfirmationToSource(dataToSave, parishId, 'pending');

            if (res.success) {
                // 🚀 ACTUALIZAR LA NUBE: Guardar el nuevo Número de Registro
                if (fullParamsCache) {
                    const updatedParams = { ...fullParamsCache, numeroRegistroActual: nextReg };
                    await supabase.from('parish_parameters').upsert({
                        parish_id: parishId,
                        confirmaciones_params: updatedParams
                    }, { onConflict: 'parish_id' });
                }

                setTicketData(dataToSave);
                setIsSuccess(true);
                toast({ title: "Guardado Exitoso", description: "Borrador de confirmación enviado a la nube.", className: "bg-green-50 text-green-900 border-green-200" });
                setTimeout(() => window.print(), 500);
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <DashboardLayout entityName={nombreParroquia}>
                <div className="print:hidden max-w-xl mx-auto bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100 text-center mt-12 animate-in fade-in duration-500">
                    <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-green-100"><CheckCircle2 className="w-12 h-12 text-green-500" /></div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter uppercase">Borrador Creado</h2>
                    <p className="text-gray-500 mb-10 text-sm font-medium leading-relaxed">El registro de confirmación está en la nube listo para ser asentado oficialmente.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => window.location.reload()} variant="outline" className="py-7 rounded-2xl border-gray-200 text-slate-700 font-black uppercase text-[10px] hover:bg-slate-50">Nueva Inscripción</Button>
                        <Button onClick={() => navigate('/parroquia/confirmacion/sentar-registros')} className="py-7 rounded-2xl bg-red-600 text-white font-black uppercase text-[10px] shadow-xl shadow-red-900/20 hover:bg-red-800">Sentar Libros</Button>
                    </div>
                </div>
                <div className="hidden print:block bg-white">
                     {ticketData && <ConfirmationTicket confirmationData={ticketData} parishInfo={parishInfo} />}
                </div>
            </DashboardLayout>
        );
    }

    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-red-600 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 mb-6 flex items-center gap-2 mt-10 first:mt-2";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-red-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-red-900/20">{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <div className="print:hidden bg-gray-50 min-h-screen">
            <DashboardLayout entityName={nombreParroquia}>
                <div className="max-w-5xl mx-auto pb-20 pt-6">
                    <datalist id="lista-parrocos">
                        {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                    </datalist>

                    <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full w-12 h-12 p-0 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-100 shadow-sm transition-all"><X className="w-5 h-5"/></Button>
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Inscripción Previa (Confirmación)</h1>
                                <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Borrador Seguro con Auto-Sincronización</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl shadow-red-900/5 border border-gray-100 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] to-red-600"></div>
                        <div className="p-12 space-y-10">
                            
                            <section>
                                <SectionHeader number="01" title="Archivo y Control (Automático)" icon={Hash} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <div><label className={labelClass}>Nº Registro Previo</label><input type="text" name="numeroRegistro" value={formData.numeroRegistro} disabled className={`${inputClass} text-center cursor-not-allowed opacity-80 text-red-600`} /></div>
                                    <div className="md:col-span-2 flex items-center px-4">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed"><AlertCircle className="w-4 h-4 inline-block mr-2 mb-0.5 text-amber-500" /> Libro, Folio y Acta se asignarán al asentar oficialmente.</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="02" title="Datos de la Celebración" icon={Calendar} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div><label className={labelClass}>Fecha y Hora Sacramento</label><input type="datetime-local" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Parroquia / Lugar</label><input type="text" name="lugarSacramento" required value={formData.lugarSacramento} onChange={handleChange} className={inputClass} /></div>
                                </div>
                            </section>

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
                                    <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                    <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                                    <div>
                                        <label className={labelClass}>Lugar de Nacimiento</label>
                                        <CityAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="04" title="Filiación e Identidad" icon={Users} />
                                <div className="mb-6">
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
                                    <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5">
                                        <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Datos del Padre</p>
                                        <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Cédula Padre</label><input type="text" name="cedulaPadre" value={formData.cedulaPadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5">
                                        <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Datos de la Madre</p>
                                        <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Cédula Madre</label><input type="text" name="cedulaMadre" value={formData.cedulaMadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="05" title="Registro de Bautismo Origen" icon={Droplet} />
                                <div className="space-y-6">
                                    <div>
                                        <label className={labelClass}>Lugar y Parroquia de Bautismo</label>
                                        <ChurchLocationAutocomplete 
                                            value={formData.lugarBautismo} 
                                            onChange={(val) => setFormData(prev => ({...prev, lugarBautismo: val}))}
                                            placeholder="Buscar iglesia y ciudad..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <div><label className={labelClass}>Libro Baut.</label><input name="libroBautismo" value={formData.libroBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                        <div><label className={labelClass}>Folio Baut.</label><input name="folioBautismo" value={formData.folioBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                        <div><label className={labelClass}>Acta Baut.</label><input name="numeroBautismo" value={formData.numeroBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="06" title="Ministros y Testigos" icon={PenTool} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-6">
                                    <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><input type="text" name="ministro" required value={formData.ministro} onChange={handleChange} className={`${inputClass} border-l-8 border-l-red-600`} placeholder="EXCMO. MONS..." /></div>
                                    <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" required value={formData.daFe} onChange={handleChange} className={inputClass} list="lista-parrocos" /></div>
                                </div>
                                <div><label className={labelClass}>Padrinos</label><input type="text" name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                            </section>

                            <section>
                                <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 07. Observaciones</h3>
                                <div>
                                    <label className={labelClass}>Nota Marginal / Observaciones</label>
                                    <textarea name="notaMarginal" value={formData.notaMarginal} onChange={handleChange} className={`${inputClass} h-24 resize-none font-mono text-xs`} />
                                </div>
                            </section>

                            <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-red-600 to-[#8b0000] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all transform active:scale-95">
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Generar Borrador
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
            
            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onSelectPartida={handleSelectBaptismPartida}
            />
        </div>
    );
};

export default ConfirmationNewPage;