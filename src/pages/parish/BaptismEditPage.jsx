import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient'; 
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, ArrowLeft, Loader2, Info, 
    CheckCircle, XCircle, AlertCircle, BookOpen, X 
} from 'lucide-react';

const BaptismEditPage = () => {
    const { user } = useAuth();
    const { getParrocos } = useAppData(); 
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recordId = searchParams.get('id');

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState(null);
    const [errors, setErrors] = useState({});
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);
    const [nombreParrocoActual, setNombreParrocoActual] = useState('');

    // --- FUNCIONES DE FORMATEO DE FECHA ---
    const toInputDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.split('T')[0];
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [d, m, y] = dateStr.split('/');
            return `${y}-${m}-${d}`;
        }
        return '';
    };

    const toStorageDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${y}-${m}-${d}`;
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateStr;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [y, m, d] = dateStr.split('T')[0].split('-');
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    };

    // --- EFECTO INICIAL: CARGA DE CATÁLOGOS ---
    useEffect(() => {
        if (!user || !recordId) return;
        
        // 🚀 Cargar Párrocos y detectar el ACTUAL para daFe
        const listaParrocos = getParrocos(user.parishId) || [];
        const nombresMap = listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase());
        setParrocosSugeridos(nombresMap);

        const actual = listaParrocos.find(p => String(p.estado) === '1');
        if (actual) {
            setNombreParrocoActual(`${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase());
        }

        loadRecord();
    }, [user, recordId]);

    const loadRecord = async () => {
        setIsLoading(true);
        try {
            const { data: dbRecord, error } = await supabase
                .from('baptisms')
                .select('id, status, raw_data')
                .eq('id', recordId)
                .single();

            if (error || !dbRecord) throw new Error("Registro no encontrado.");

            const record = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };

            // Normalización de Sexo
            let standardizedSex = '';
            const rawSex = String(record.sexo || record.sex || '').toUpperCase().trim();
            if (rawSex === '1' || rawSex.includes('MASC')) standardizedSex = 'MASCULINO';
            else if (rawSex === '2' || rawSex.includes('FEM')) standardizedSex = 'FEMENINO';

            // Normalización de Unión
            let standardizedUnion = record.tipoUnionPadres || '';
            if (String(standardizedUnion) === '1') standardizedUnion = 'MATRIMONIO CATÓLICO';
            else if (String(standardizedUnion) === '2') standardizedUnion = 'MATRIMONIO CIVIL';
            else if (String(standardizedUnion) === '3') standardizedUnion = 'UNIÓN LIBRE';
            else if (String(standardizedUnion) === '4') standardizedUnion = 'MADRE SOLTERA';

            setFormData({
                ...record,
                // 🚀 CAMBIO: Nombre de campo corregido a 'Libro'
                Libro: record.Libro || record.libro || record.book_number || '',
                folio: record.folio || record.page_number || '',
                numero: record.numero || record.entry_number || '',
                apellidos: (record.apellidos || record.lastName || '').toUpperCase(),
                nombres: (record.nombres || record.firstName || '').toUpperCase(),
                sexo: standardizedSex,
                fechaNacimiento: record.fechaNacimiento || record.birthDate || '',
                lugarNacimiento: (record.lugarNacimiento || record.birthPlace || '').toUpperCase(),
                fechaSacramento: record.fechaSacramento || record.sacramentDate || '',
                lugarBautismo: (record.lugarBautismo || record.sacramentPlace || '').toUpperCase(),
                nombrePadre: (record.nombrePadre || record.fatherName || '').toUpperCase(),
                cedulaPadre: record.cedulaPadre || record.fatherId || '',
                nombreMadre: (record.nombreMadre || record.motherName || '').toUpperCase(),
                cedulaMadre: record.cedulaMadre || record.motherId || '',
                tipoUnionPadres: standardizedUnion,
                abuelosPaternos: (record.abuelosPaternos || record.paternalGrandparents || '').toUpperCase(),
                abuelosMaternos: (record.abuelosMaternos || record.maternalGrandparents || '').toUpperCase(),
                padrinos: (record.padrinos || record.godparents || '').toUpperCase(),
                ministro: (record.ministro || record.minister || '').toUpperCase(),
                // 🚀 ASIGNACIÓN: Párroco Actual en 'daFe'
                daFe: record.daFe || nombreParrocoActual || '',
                serialRegistro: record.serialRegistro || '',
                nuip: record.nuip || '',
                oficinaRegistro: record.oficinaRegistro || '',
                fechaExpedicionRegistro: record.fechaExpedicionRegistro || ''
            });

        } catch (error) {
            toast({ title: "Error", description: "No se pudo cargar el registro de la nube.", variant: "destructive" });
            navigate('/parroquia/bautismo/base-datos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        let finalValue = value;
        if (type === 'date') finalValue = toStorageDate(value);
        
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSave = async () => {
        if (!formData) return;

        // Validaciones rápidas
        if (!formData.nombres.trim() || !formData.apellidos.trim()) {
            toast({ title: "Atención", description: "Nombres y Apellidos son obligatorios.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const cleanDate = (d) => (d && typeof d === 'string' && d.trim() !== '') ? d : null;

            // Sincronización de la cápsula JSON
            const updatedRawData = {
                ...formData,
                nombres: formData.nombres.toUpperCase(),
                apellidos: formData.apellidos.toUpperCase(),
                updatedAt: new Date().toISOString()
            };

            // Sincronización de columnas físicas en Supabase
            const dbUpdatePayload = {
                book_number: String(formData.Libro || '').padStart(4, '0'),
                page_number: String(formData.folio || '').padStart(4, '0'),
                entry_number: String(formData.numero || '').padStart(4, '0'),
                first_name: String(formData.nombres).toUpperCase(),
                last_name: String(formData.apellidos).toUpperCase(),
                gender: String(formData.sexo),
                birth_date: cleanDate(formData.fechaNacimiento),
                sacrament_date: cleanDate(formData.fechaSacramento),
                minister: String(formData.ministro).toUpperCase(),
                father_name: String(formData.nombrePadre).toUpperCase(),
                mother_name: String(formData.nombreMadre).toUpperCase(),
                raw_data: updatedRawData
            };

            const { error } = await supabase
                .from('baptisms')
                .update(dbUpdatePayload)
                .eq('id', recordId);

            if (error) throw error;

            window.dispatchEvent(new Event('storage'));
            toast({ title: "¡Actualizado!", description: "Sincronizado con la Base de Datos Central.", className: "bg-green-600 text-white" });
            navigate('/parroquia/bautismo/base-datos');

        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !formData) return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mb-4" />
                <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Accediendo a la Nube...</p>
            </div>
        </DashboardLayout>
    );

    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-[#4B7BA7] uppercase tracking-[0.2em] border-b border-gray-100 pb-3 mb-6 flex items-center gap-2";

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-5xl mx-auto px-4 pb-24 pt-6">

                <datalist id="lista-parrocos">
                    {parrocosSugeridos.map((nombre, index) => <option key={index} value={nombre} />)}
                </datalist>

                {/* HEADER */}
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/base-datos')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-400" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Editar Partida</h1>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                                <BookOpen className="w-3 h-3" /> Registro en Base de Datos Permanente
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-gray-100 p-8 md:p-12 space-y-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>
                    
                    {/* SECCIÓN 1: ARCHIVO */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 01. Localización Física</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div>
                                <label className={labelClass}>Libro</label>
                                <input type="text" name="Libro" onChange={handleChange} className={`${inputClass} font-mono text-lg text-[#4B7BA7]`} value={formData.Libro || ''} />
                            </div>
                            <div>
                                <label className={labelClass}>Folio</label>
                                <input type="text" name="folio" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.folio || ''} />
                            </div>
                            <div>
                                <label className={labelClass}>Número (Acta)</label>
                                <input type="text" name="numero" onChange={handleChange} className={`${inputClass} font-mono text-lg`} value={formData.numero || ''} />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 2: IDENTIDAD */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 02. Identidad del Bautizado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className={labelClass}>Apellidos</label>
                                <input type="text" name="apellidos" value={formData.apellidos || ''} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Nombres</label>
                                <input type="text" name="nombres" value={formData.nombres || ''} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Sexo</label>
                                <select name="sexo" value={formData.sexo || ''} onChange={handleChange} className={inputClass}>
                                    <option value="">SELECCIONE...</option>
                                    <option value="MASCULINO">MASCULINO</option>
                                    <option value="FEMENINO">FEMENINO</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Fecha de Nacimiento</label>
                                <input type="date" name="fechaNacimiento" value={toInputDate(formData.fechaNacimiento)} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Lugar de Nacimiento</label>
                                <input type="text" name="lugarNacimiento" value={formData.lugarNacimiento || ''} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 3: SACRAMENTO */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 03. Datos del Sacramento</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Fecha de Bautismo</label>
                                <input type="date" name="fechaSacramento" value={toInputDate(formData.fechaSacramento)} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Parroquia del Sacramento</label>
                                <input type="text" name="lugarBautismo" value={formData.lugarBautismo || ''} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 4: PADRES */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 04. Filiación y Padres</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50 space-y-4">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Padre</p>
                                <input type="text" name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre || ''} onChange={handleChange} className={inputClass} />
                                <input type="text" name="cedulaPadre" placeholder="CÉDULA" value={formData.cedulaPadre || ''} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="bg-pink-50/30 p-6 rounded-[2rem] border border-pink-100/50 space-y-4">
                                <p className="text-[9px] font-black text-pink-600 uppercase tracking-widest mb-2">Madre</p>
                                <input type="text" name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre || ''} onChange={handleChange} className={inputClass} />
                                <input type="text" name="cedulaMadre" placeholder="CÉDULA" value={formData.cedulaMadre || ''} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Tipo de Unión de Padres</label>
                            <select name="tipoUnionPadres" value={formData.tipoUnionPadres || ''} onChange={handleChange} className={inputClass}>
                                <option value="">SELECCIONE...</option>
                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                            </select>
                        </div>
                    </section>

                    {/* SECCIÓN 5: ABUELOS Y PADRINOS */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 05. Abuelos y Padrinos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Abuelos Paternos</label>
                                <textarea name="abuelosPaternos" value={formData.abuelosPaternos || ''} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none shadow-inner`} />
                            </div>
                            <div>
                                <label className={labelClass}>Abuelos Maternos</label>
                                <textarea name="abuelosMaternos" value={formData.abuelosMaternos || ''} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none shadow-inner`} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Padrinos Registrados</label>
                                <textarea name="padrinos" value={formData.padrinos || ''} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none shadow-inner`} />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 6: FIRMAS */}
                    <section>
                        <h3 className={sectionHeaderClass}><div className="w-2 h-2 bg-[#D4AF37] rounded-full" /> 06. Autoridad y Firma</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Sacerdote Celebrante</label>
                                <input type="text" name="ministro" value={formData.ministro || ''} onChange={handleChange} className={inputClass} list="lista-parrocos" />
                            </div>
                            <div>
                                <label className={labelClass}>Párroco que Da Fe (Actual)</label>
                                <input type="text" name="daFe" value={formData.daFe || ''} onChange={handleChange} className={`${inputClass} border-l-4 border-l-[#4B7BA7]`} list="lista-parrocos" />
                            </div>
                        </div>
                    </section>

                    {/* BOTONES */}
                    <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/base-datos')} className="px-8 py-6 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">
                            Descartar
                        </Button>
                        <Button onClick={handleSave} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 transition-all transform active:scale-95">
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Actualizar Registro
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BaptismEditPage;