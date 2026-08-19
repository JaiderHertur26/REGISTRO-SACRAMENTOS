import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, ShieldCheck, BookOpen, Calendar, User, Fingerprint, PenTool, Loader2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete';

const NewDecreeReplacementPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, createNotification, getCiudadesList, getParrocos } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [targetDioceseId, setTargetDioceseId] = useState(null);
    const [conceptos, setConceptos] = useState([]);
    const [cloudParams, setCloudParams] = useState({});
    
    const [auxiliares, setAuxiliares] = useState({ ciudades: [], ministros: [] });
    const [parishesList, setParishesList] = useState([]);
    const [selectedSearchParish, setSelectedSearchParish] = useState('');

    const [decreeData, setDecreeData] = useState({ 
        parroquia: '', numeroDeDecreto: '', fechaEmision: new Date().toISOString().split('T')[0], conceptoAnulacionId: '' 
    });

    const [newPartida, setNewPartida] = useState({ 
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: 'MASCULINO', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: 'MATRIMONIO CATÓLICO', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: '', Libro: '', folio: '', numero: '',
        serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: ''
    });

    useEffect(() => {
        const initializeData = async () => {
            if (!user) return;
            try {
                let currentDioceseId = user.dioceseId || user.diocese_id;
                if (!currentDioceseId && (user.chanceryId || user.chancery_id)) {
                    const cId = user.chanceryId || user.chancery_id;
                    const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', cId).single();
                    if (chanData) currentDioceseId = chanData.diocese_id;
                }
                setTargetDioceseId(currentDioceseId);

                const entityId = user.chanceryId || user.id;
                const misDatosList = getMisDatosList(entityId);
                let entityLabel = '';
                if (misDatosList && misDatosList.length > 0) {
                    const dato = misDatosList[0];
                    const nombre = (dato.nombre || dato.nombreCancilleria || user.dioceseName || 'CANCILLERÍA').toUpperCase();
                    const ciudad = (dato.ciudad || user.city || 'BARRANQUILLA').toUpperCase();
                    entityLabel = `${nombre} - ${ciudad}, COLOMBIA`;
                } else {
                    entityLabel = `${(user.dioceseName || 'CANCILLERÍA').toUpperCase()} - BARRANQUILLA, COLOMBIA`;
                }
                setDecreeData(prev => ({ ...prev, parroquia: entityLabel }));

                if (currentDioceseId) {
                    const { data: conceptosData } = await supabase.from('conceptos_anulacion').select(`id, codigo, concepto, tipo, chancelleries!inner ( diocese_id )`).eq('chancelleries.diocese_id', currentDioceseId).ilike('tipo', 'porReposicion').order('codigo', { ascending: true });
                    if (conceptosData) setConceptos(conceptosData);

                    const { data: parroquiasData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (parroquiasData) setParishesList(parroquiasData);
                }
            } catch (error) { console.error("Error inicializando Cancillería:", error); }
        };
        initializeData();
    }, [user, getMisDatosList]);

    useEffect(() => {
        const loadParishSpecifics = async () => {
            if (!selectedSearchParish) {
                setCloudParams({});
                return;
            }
            
            const listaCiudadesCruda = getCiudadesList(selectedSearchParish) || [];
            const parrocosList = getParrocos(selectedSearchParish) || [];
            setAuxiliares({
                ciudades: listaCiudadesCruda.map(c => (c.nombre || '').toUpperCase()),
                ministros: parrocosList.map(s => `${s.nombre} ${s.apellido || ''}`.trim().toUpperCase())
            });

            const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();
            if (paramsData && paramsData.bautizos_params) {
                setCloudParams(paramsData.bautizos_params);
            } else {
                setCloudParams({ suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 });
            }

            let priestName = '';
            const { data: pData } = await supabase.from('parrocos').select('payload').eq('parish_id', selectedSearchParish);
            if (pData && pData.length > 0) {
                const active = pData.find(r => {
                    let p = r.payload;
                    if (typeof p === 'string') p = JSON.parse(p);
                    return String(p.estado) === '1' || String(p.Estado) === '1';
                });
                if (active) {
                    let p = active.payload;
                    if (typeof p === 'string') p = JSON.parse(p);
                    priestName = `${p.nombre || p.nombres || ''} ${p.apellido || p.apellidos || ''}`.trim().toUpperCase();
                }
            }
            setNewPartida(prev => ({ ...prev, ministerFaith: priestName, minister: priestName }));
        };
        
        loadParishSpecifics();
    }, [selectedSearchParish, getCiudadesList, getParrocos]);

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setDecreeData(prev => ({ ...prev, [name]: name === 'numeroDecreto' ? value.toUpperCase() : value }));
    };

    const handleNewPartidaChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'padrinos', 'ministro', 'daFe', 'lugarBautismo', 'oficinaRegistro'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setNewPartida(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setNewPartida(prev => ({ ...prev, lugarNacimiento: String(value).toUpperCase() }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedSearchParish) { toast({ title: "Falta Parroquia", description: "Seleccione la parroquia destino.", variant: "destructive" }); return; }
        if (!decreeData.numeroDeDecreto || !newPartida.nombres || !newPartida.apellidos || !decreeData.conceptoAnulacionId) {
            toast({ title: "Faltan Datos", description: "Complete los campos obligatorios.", variant: "destructive" }); return;
        }

        setIsSubmitting(true);
        try {
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'reposicion')
                .eq('parish_id', selectedSearchParish).contains('payload', { decreeNumber: decreeData.numeroDeDecreto }).maybeSingle();

            if (existingDecree) {
                setIsSubmitting(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${decreeData.numeroDeDecreto} ya existe.`, variant: "destructive" }); 
                return;
            }

            const supletorioLibro = String(cloudParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(cloudParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(cloudParams.suplementarioNumero || '1').padStart(4, '0');

            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const conceptoText = conceptoMatch?.concepto || 'REPOSICIÓN POR DETERIORO O PÉRDIDA';
            const fechaTexto = convertDateToSpanishText(decreeData.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
            
            const notaMarginalTecnica = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.numeroDeDecreto.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${conceptoText.toUpperCase()}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

            const partidaToSave = {
                ...newPartida,
                Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
                book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
                firstName: newPartida.nombres, lastName: newPartida.apellidos,
                fecbau: newPartida.fechaSacramento, fecnac: newPartida.fechaNacimiento,
                lugarn: newPartida.lugarNacimiento, sex: newPartida.sexo,
                padre: newPartida.nombrePadre, madre: newPartida.nombreMadre, tipohijo: newPartida.tipoUnionPadres,
                abuepat: newPartida.abuelosPaternos, abuemat: newPartida.abuelosMaternos,
                padrinos: newPartida.padrinos, ministro: newPartida.ministro, dafe: newPartida.daFe,
                anulado: false, status: 'seated', notaMarginal: notaMarginalTecnica
            };

            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto, numeroDecreto: decreeData.numeroDecreto,
                decreeDate: decreeData.fechaDecreto, conceptoAnulacionId: decreeData.conceptoAnulacionId,
                causa: conceptoText, targetName: `${newPartida.apellidos} ${newPartida.nombres}`.trim(),
                ...newPartida,
                datosNuevaPartida: { ...newPartida, book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero },
                newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, nombres: newPartida.nombres, apellidos: newPartida.apellidos }
            };

            const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
                parish_id: selectedSearchParish, book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
                celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos, sexo: newPartida.sexo,
                fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_nacimiento: newPartida.lugarNacimiento,
                nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre, tipo_union_padres: newPartida.tipoUnionPadres,
                abuelos_paternos: newPartida.abuelosPaternos, abuelos_maternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, da_fe: newPartida.daFe, status: 'seated', nota_marginal: notaMarginalTecnica,
                raw_data: partidaToSave
            }]).select('id').single();

            if (errBap) throw errBap;

            payloadDecree.newPartidaId = newBap.id;
            await supabase.from('decretos').insert([{ parish_id: selectedSearchParish, tipo: 'reposicion', payload: payloadDecree }]);

            const newParams = { ...cloudParams, suplementarioNumero: Number(supletorioNumero) + 1 };
            await supabase.from('parish_parameters').upsert({ parish_id: selectedSearchParish, bautizos_params: newParams }, { onConflict: 'parish_id' });

            await createNotification({ decree_id: generateUUID(), decree_type: 'reposicion', parish_id: selectedSearchParish, created_by: user.id, message: `La Cancillería emitió el Decreto de Reposición #${decreeData.numeroDeDecreto} a nombre de ${newPartida.nombres} ${newPartida.apellidos}.`, status: 'unread' });

            toast({ title: "Reposición Magistral Exitosa", description: "La partida supletoria ha sido inyectada remotamente en la parroquia.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decree-replacement/view');

        } catch (error) { toast({ title: "Error en Proceso", description: error.message, variant: "destructive" }); } 
        finally { setIsSubmitting(false); }
    };

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number, colorCls }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100 mt-10 first:mt-2">
            <div className={`w-8 h-8 rounded-2xl text-white flex items-center justify-center text-xs font-black shadow-lg ${colorCls}`}>{number}</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-amber-500" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <datalist id="ciudades-list">{auxiliares.ciudades?.map((c, i) => <option key={i} value={c} />)}</datalist>
            <datalist id="ministros-list">{auxiliares.ministros?.map((m, i) => <option key={i} value={m} />)}</datalist>

            <div className="max-w-[1400px] mx-auto pb-24 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-400" /></Button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight font-serif uppercase">Decreto de Reposición</h1>
                            <p className="text-gray-500 font-medium mt-2 uppercase text-[11px] tracking-widest">Inyección Remota en Libros Parroquiales</p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-2xl h-14 max-w-2xl mx-auto">
                        <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                        <TabsTrigger value="confirmacion" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Confirmaciones</TabsTrigger>
                        <TabsTrigger value="matrimonio" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Matrimonios</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bautismo" className="focus:outline-none max-w-5xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500"></div>

                            <div className="p-12 space-y-10">
                                <section>
                                    <SectionHeader number="01" title="Información del Decreto Oficial" icon={FileText} colorCls="bg-amber-600 shadow-amber-900/20" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="md:col-span-3"><label className={labelClass}>Entidad Emisora</label><input readOnly value={decreeData.parroquia} className={`${inputClass} bg-gray-100 text-gray-500 border-none shadow-none cursor-not-allowed`} /></div>
                                        <div><label className={labelClass}>Número de Decreto *</label><input required name="numeroDecreto" value={decreeData.numeroDecreto} onChange={handleDecreeChange} className={`${inputClass} border-amber-200 bg-amber-50/30 text-amber-700 placeholder-amber-300`} placeholder="EJ: 005-2025" /></div>
                                        <div><label className={labelClass}>Fecha de Emisión *</label><input type="date" required name="fechaDecreto" value={decreeData.fechaDecreto} onChange={handleDecreeChange} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Causa de Reposición *</label>
                                            <select required name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={handleDecreeChange} className={inputClass}>
                                                <option value="">SELECCIONE CONCEPTO...</option>
                                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100 shadow-sm mt-8">
                                        <h4 className="text-sm font-black text-amber-800 mb-6 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4" /> Parroquia Destino</h4>
                                        <div className="mb-2">
                                            <label className={labelClass}>Seleccione dónde se inyectará la partida *</label>
                                            <select value={selectedSearchParish} onChange={(e) => setSelectedSearchParish(e.target.value)} className={`${inputClass} border-amber-200 text-amber-900 bg-white`}>
                                                <option value="">-- SELECCIONE LA PARROQUIA --</option>
                                                {parishesList.map(p => <option key={p.id} value={p.id}>{p.name} - {p.city}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                <div className={`transition-all duration-500 ${!selectedSearchParish ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                    <section>
                                        <SectionHeader number="02" title="Protocolo de Archivo Supletorio (Remoto)" icon={BookOpen} colorCls="bg-[#4B7BA7] shadow-blue-900/20" />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                            <div><label className={labelClass}>Libro (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioLibro || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Folio (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioFolio || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                            <div><label className={labelClass}>Número / Acta (Nuevo)</label><input readOnly value={String(cloudParams.suplementarioNumero || '1').padStart(4, '0')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-gray-800 shadow-sm outline-none text-center" /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="03" title="Asiento del Sacramento" icon={Calendar} colorCls="bg-green-600 shadow-green-900/20" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="sacramentDate" value={newPartida.sacramentDate} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="04" title="Identidad del Bautizado" icon={User} colorCls="bg-green-600 shadow-green-900/20" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Apellidos Completos *</label><input name="apellidos" required value={newPartida.apellidos} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>Nombres Completos *</label><input name="nombres" required value={newPartida.nombres} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div>
                                                <label className={labelClass}>Sexo</label>
                                                <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChange} className={inputClass}>
                                                    <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                                                </select>
                                            </div>
                                            <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Lugar de Nacimiento</label>
                                                <CityAutocomplete name="placeOfBirth" value={newPartida.lugarNacimiento} onChange={handleCityChange} cities={auxiliares.ciudades} className={inputClass} />
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="05" title="Filiación y Rama Genealógica" icon={Fingerprint} colorCls="bg-slate-700 shadow-slate-900/20" />
                                        <div className="mb-8">
                                            <label className={labelClass}>Tipo de Unión de Padres</label>
                                            <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChange} className="w-full md:w-1/2 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option><option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option><option value="UNIÓN LIBRE">UNIÓN LIBRE</option><option value="MADRE SOLTERA">MADRE SOLTERA</option><option value="OTRO CASO">OTRO CASO</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Línea Paterna</p>
                                                <input name="nombrePadre" placeholder="NOMBRE DEL PADRE" value={newPartida.nombrePadre} onChange={handleNewPartidaChange} className={inputClass} />
                                                <textarea name="abuelosPaternos" placeholder="ABUELOS PATERNOS" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                            <div className="bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100/50 space-y-5 shadow-sm">
                                                <p className="text-[10px] font-black text-pink-800 uppercase tracking-widest">Línea Materna</p>
                                                <input name="nombreMadre" placeholder="NOMBRE DE LA MADRE" value={newPartida.nombreMadre} onChange={handleNewPartidaChange} className={inputClass} />
                                                <textarea name="abuelosMaternos" placeholder="ABUELOS MATERNOS" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChange} className={`${inputClass} h-20 py-3 resize-none`} />
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} colorCls="bg-slate-700 shadow-slate-900/20" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                            <div><label className={labelClass}>Sacerdote Celebrante</label><input name="ministro" list="ministros-list" value={newPartida.ministro} onChange={handleNewPartidaChange} className={`${inputClass} border-l-8 border-l-amber-500`} /></div>
                                            <div><label className={labelClass}>Firma (Da Fe) *</label><input name="daFe" required list="ministros-list" value={newPartida.daFe} onChange={handleNewPartidaChange} className={inputClass} /></div>
                                        </div>
                                        <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className={`${inputClass} py-5`} /></div>
                                    </section>

                                    <div className="flex justify-end gap-4 border-t border-gray-100 pt-12">
                                        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-gray-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Descartar</Button>
                                        <Button type="submit" disabled={isSubmitting || !selectedSearchParish} className="bg-gradient-to-r from-amber-500 to-amber-700 text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Emitir Decreto Remotamente
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeReplacementPage;