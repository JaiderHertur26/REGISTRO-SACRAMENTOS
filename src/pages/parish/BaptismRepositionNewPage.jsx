import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, Loader2, ShieldCheck, BookOpen, Calendar, User, Fingerprint, Users, PenTool, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete'; 
import { calculateNextConsecutive } from '@/services/sacramentParametersService';

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const BaptismRepositionNewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    // 🚀 Extraemos getParrocos para la máquina del tiempo
    const { getParrocoActual, getMisDatosList, getCiudadesList, getParrocos } = useAppData();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [cloudParams, setCloudParams] = useState({});
    
    const [ciudades, setCiudades] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);
    const [sacerdotePorDefecto, setSacerdotePorDefecto] = useState('');
    
    const [decreeData, setDecreeData] = useState({ 
        numeroDecreto: '', 
        fechaDecreto: new Date().toISOString().split('T')[0], 
        conceptoAnulacionId: '' 
    });
    
    const [formData, setFormData] = useState({
        sacramentDate: '', firstName: '', lastName: '', sex: 'MASCULINO',
        birthDate: '', placeOfBirth: '', fatherName: '', motherName: '', 
        tipoUnionPadres: 'MATRIMONIO CATÓLICO', paternalGrandparents: '', 
        maternalGrandparents: '', godparents: '', ministro: '', daFe: '', // Estandarizado
        serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user?.parishId) return;

            try {
                const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', user.parishId).maybeSingle();
                if (paramsData && paramsData.bautizos_params) setCloudParams(paramsData.bautizos_params);

                let targetDioceseId = user.dioceseId || user.diocese_id;
                if (!targetDioceseId) {
                    const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                    if (pData) targetDioceseId = pData.diocese_id;
                }

                if (targetDioceseId) {
                    const { data } = await supabase.from('conceptos_anulacion').select('*').eq('diocese_id', targetDioceseId).order('codigo', { ascending: true });
                    if (data) setConceptos(data.filter(c => c.tipo === 'porReposicion' || c.concepto?.toLowerCase().includes('reposici')));
                }

                const listaCruda = getCiudadesList(user.parishId) || [];
                setCiudades(listaCruda.map(c => (c.nombre || '').toUpperCase()));

                // 🚀 CARGAMOS LA LISTA HISTÓRICA
                const parrocos = getParrocos(user.parishId) || [];
                setListaSacerdotes(parrocos);

                const priest = getParrocoActual(user.parishId);
                if (priest) {
                    const defName = `${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase();
                    setSacerdotePorDefecto(defName);
                    setFormData(prev => ({ ...prev, daFe: defName })); 
                }

            } catch (error) {
                console.error("Error inicializando datos:", error);
            }
        };

        loadInitialData();
    }, [user, getParrocoActual, getCiudadesList, getParrocos]);

    // 🚀 MÁQUINA DEL TIEMPO: SINCRONIZA MINISTRO Y DA FE CON LA FECHA DEL BAUTISMO
    useEffect(() => {
        if (!formData.sacramentDate || listaSacerdotes.length === 0) return;

        const fechaSeleccionada = new Date(formData.sacramentDate.includes('T') ? formData.sacramentDate : `${formData.sacramentDate}T12:00:00`);
        
        const sacerdoteEpoca = listaSacerdotes.find(s => {
            if (!s.fechaIngreso && !s.fechaNombramiento) return false;
            const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
            const inicio = new Date(iStr);
            const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
            return fechaSeleccionada >= inicio && fechaSeleccionada <= fin;
        });

        if (sacerdoteEpoca) {
            const histPriest = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
            setFormData(prev => ({ 
                ...prev, 
                ministro: histPriest,
                daFe: histPriest // Se sincroniza automáticamente
            }));
        } else {
            // Si no encuentra, restaura el actual
            setFormData(prev => ({ ...prev, daFe: sacerdotePorDefecto }));
        }
    }, [formData.sacramentDate, listaSacerdotes, sacerdotePorDefecto]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['firstName', 'lastName', 'fatherName', 'motherName', 'paternalGrandparents', 'maternalGrandparents', 'godparents', 'ministro', 'daFe', 'oficinaRegistro'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setFormData(prev => ({ ...prev, placeOfBirth: String(value).toUpperCase() }));
    };

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: name === 'numeroDecreto' ? value.toUpperCase() : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!decreeData.numeroDecreto || !formData.firstName || !formData.lastName || !decreeData.conceptoAnulacionId) {
            toast({ title: "Faltan Datos", description: "Complete los campos obligatorios.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'reposicion')
                .eq('parish_id', user.parishId).contains('payload', { decreeNumber: decreeData.numeroDecreto }).maybeSingle();

            if (existingDecree) {
                setIsSubmitting(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${decreeData.numeroDecreto} ya existe.`, variant: "destructive" }); 
                return;
            }

            const supletorioLibro = String(cloudParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(cloudParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(cloudParams.suplementarioNumero || '1').padStart(4, '0');

            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const conceptoText = conceptoMatch?.concepto || 'REPOSICIÓN POR DETERIORO O PÉRDIDA';
            const fechaTexto = convertDateToSpanishText(decreeData.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
            
            // 🚀 LIMPIEZA DE FIRMAS Y EMPAQUE SEGURO
            let finalMin = cleanTitle(formData.ministro);
            finalMin = finalMin !== 'EL PÁRROCO' && finalMin ? `PBRO. ${finalMin}` : finalMin;
            
            let finalDaFe = cleanTitle(formData.daFe);
            finalDaFe = finalDaFe !== 'EL PÁRROCO' && finalDaFe ? `PBRO. ${finalDaFe}` : finalDaFe;

            // Inyectamos el Sacerdote Histórico a la nota de reposición
            const notaMarginalTecnica = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.numeroDecreto.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${conceptoText.toUpperCase()}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO. DA FE: ${finalDaFe}.`;

            const partidaToSave = {
                ...formData,
                Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
                book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
                nombres: formData.firstName, apellidos: formData.lastName,
                fecbau: formData.sacramentDate, fecnac: formData.birthDate,
                lugarn: formData.placeOfBirth, sex: formData.sex,
                padre: formData.fatherName, madre: formData.motherName, tipohijo: formData.tipoUnionPadres,
                abuepat: formData.paternalGrandparents, abuemat: formData.maternalGrandparents,
                padrinos: formData.godparents, 
                ministro: finalMin, dafe: finalDaFe, daFe: finalDaFe, // Multillave purificada
                anulado: false, status: 'seated', notaMarginal: notaMarginalTecnica
            };

            const payloadDecree = {
                decreeNumber: decreeData.numeroDecreto, numeroDecreto: decreeData.numeroDecreto,
                decreeDate: decreeData.fechaDecreto, conceptoAnulacionId: decreeData.conceptoAnulacionId,
                causa: conceptoText, targetName: `${formData.lastName} ${formData.firstName}`.trim(),
                ...formData,
                ministro: finalMin, daFe: finalDaFe, dafe: finalDaFe, ministerFaith: finalDaFe, // Multillave purificada
                datosNuevaPartida: { ...formData, book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero, daFe: finalDaFe },
                newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, nombres: formData.firstName, apellidos: formData.lastName, daFe: finalDaFe }
            };

            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: user.parishId, book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
                celebration_date: formData.sacramentDate || null, nombres: formData.firstName, apellidos: formData.lastName, sexo: formData.sex,
                fecha_nacimiento: formData.birthDate || null, lugar_nacimiento: formData.placeOfBirth,
                nombre_padre: formData.fatherName, nombre_madre: formData.motherName, tipo_union_padres: formData.tipoUnionPadres,
                abuelos_paternos: formData.paternalGrandparents, abuelos_maternos: formData.maternalGrandparents, padrinos: formData.godparents,
                ministro: finalMin, da_fe: finalDaFe, status: 'seated', nota_marginal: notaMarginalTecnica,
                raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            payloadDecree.newPartidaId = newBap.id;
            await supabase.from('decretos').insert([{ parish_id: user.parishId, tipo: 'reposicion', payload: payloadDecree }]);

            const siguientesSupletorios = calculateNextConsecutive(
                cloudParams.suplementarioNumero,
                cloudParams.suplementarioFolio,
                cloudParams.suplementarioLibro,
                cloudParams.suplementarioPartidas || 2,
                cloudParams.suplementarioReiniciar || false
            );

            const newParams = { 
                ...cloudParams, 
                suplementarioNumero: siguientesSupletorios.numero,
                suplementarioFolio: siguientesSupletorios.folio,
                suplementarioLibro: siguientesSupletorios.libro
            };

            await supabase.from('parish_parameters').upsert({ 
                parish_id: user.parishId, 
                bautizos_params: newParams 
            }, { onConflict: 'parish_id' });

            toast({ title: "Reposición Exitosa", description: "La partida supletoria ha sido creada en la Nube.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/decretos/reposicion');

        } catch (error) { toast({ title: "Error en Proceso", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
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
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <datalist id="lista-parrocos">
                {listaSacerdotes.map((s, idx) => <option key={idx} value={`${s.nombre} ${s.apellido || ''}`.trim().toUpperCase()} />)}
            </datalist>

            <div className="max-w-5xl mx-auto pb-20 pt-6">
                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Decreto de Reposición</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Generación de Partidas Supletorias en la Nube</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 text-[#4B7BA7] px-5 py-3 rounded-2xl text-[10px] border border-blue-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" /> Base de Datos Permanente
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-2xl h-14">
                        <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmacion" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonio" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Matrimonios</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautismo" className="focus:outline-none">
                        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>

                            <div className="p-12 space-y-10">
                                {/* 01. DECRETO MAESTRO */}
                                <section>
                                    <SectionHeader number="01" title="Información del Decreto" icon={FileText} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div><label className={labelClass}>Número de Decreto *</label><input required name="numeroDecreto" value={decreeData.numeroDecreto} onChange={handleDecreeChange} className={`${inputClass} border-blue-200 bg-blue-50/30 text-[#4B7BA7] placeholder-blue-300`} placeholder="EJ: 005-2025" /></div>
                                        <div><label className={labelClass}>Fecha de Emisión *</label><input type="date" required name="fechaDecreto" value={decreeData.fechaDecreto} onChange={handleDecreeChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Causa de la Reposición *</label>
                                            <select required name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className={inputClass}>
                                                <option value="">SELECCIONE CONCEPTO...</option>
                                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* 02. UBICACIÓN SUPLETORIA */}
                                <section>
                                    <SectionHeader number="02" title="Protocolo de Archivo Supletorio" icon={BookOpen} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                        <div><label className={labelClass}>Libro (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioLibro || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none text-center" /></div>
                                        <div><label className={labelClass}>Folio (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioFolio || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        <div><label className={labelClass}>Número / Acta (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioNumero || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                    </div>
                                </section>

                                {/* 03. ASIGNACIÓN DEL SACRAMENTO */}
                                <section>
                                    <SectionHeader number="03" title="Asiento del Sacramento" icon={Calendar} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="sacramentDate" value={formData.sacramentDate} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                </section>

                                {/* 04. IDENTIDAD DEL SUJETO */}
                                <section>
                                    <SectionHeader number="04" title="Identidad del Bautizado" icon={User} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                        <div><label className={labelClass}>Apellidos Completos *</label><input name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Nombres Completos *</label><input name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div>
                                            <label className={labelClass}>Sexo</label>
                                            <select name="sex" value={formData.sex} onChange={handleChange} className={inputClass}>
                                                <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                            </select>
                                        </div>
                                        <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Lugar de Nacimiento</label>
                                            <CityAutocomplete name="placeOfBirth" value={formData.placeOfBirth} onChange={handleCityChange} cities={ciudades} className={inputClass} />
                                        </div>
                                    </div>
                                </section>

                                {/* 05. FILIACIÓN */}
                                <section>
                                    <SectionHeader number="05" title="Filiación y Rama Genealógica" icon={Fingerprint} />
                                    <div className="mb-8">
                                        <label className={labelClass}>Tipo de Unión de Padres</label>
                                        <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                            <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                        <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                            <input name="fatherName" placeholder="NOMBRE DEL PADRE" value={formData.fatherName} onChange={handleChange} className={inputClass} />
                                            <textarea name="paternalGrandparents" placeholder="ABUELOS PATERNOS" value={formData.paternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                        </div>
                                        <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                            <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                            <input name="motherName" placeholder="NOMBRE DE LA MADRE" value={formData.motherName} onChange={handleChange} className={inputClass} />
                                            <textarea name="maternalGrandparents" placeholder="ABUELOS MATERNOS" value={formData.maternalGrandparents} onChange={handleChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                        </div>
                                    </div>
                                </section>

                                {/* 06. AUTORIDAD */}
                                <section>
                                    <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                        <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" list="lista-parrocos" value={formData.ministro} onChange={handleChange} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} /></div>
                                        <div><label className={labelClass}>Firma (Da Fe) *</label><input name="daFe" required list="lista-parrocos" value={formData.daFe} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div><label className={labelClass}>Padrinos</label><input name="godparents" value={formData.godparents} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                </section>

                                <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                    <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Emitir Decreto Permanente
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default BaptismRepositionNewPage;