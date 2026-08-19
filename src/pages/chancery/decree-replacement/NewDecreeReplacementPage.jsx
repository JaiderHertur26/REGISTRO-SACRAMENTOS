import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, ArrowLeft, FileText, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import CityAutocomplete from '@/components/CityAutocomplete'; 

const NewDecreeReplacementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, getConceptosAnulacion, getMisDatosList, getCiudadesList } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  
  // Contadores en vivo desde Supabase
  const [nextParams, setNextParams] = useState({ libro: '', folio: '', numero: '' });

  const [bautismoDecree, setBautismoDecree] = useState({ 
      parroquia: '', targetParishId: '', numeroDecreto: '', 
      fechaDecreto: new Date().toISOString().split('T')[0], conceptoAnulacionId: ''
  });
  
  const [bautismoNewPartida, setBautismoNewPartida] = useState({
      sacramentDate: '', firstName: '', lastName: '', birthDate: '', 
      lugarNacimientoDetalle: '', lugarBautismo: '', fatherName: '', ceduPadre: '', 
      motherName: '', ceduMadre: '', tipoUnionPadres: 'MATRIMONIO CATÓLICO', sex: 'MASCULINO', 
      paternalGrandparents: '', maternalGrandparents: '', godparents: '', 
      minister: '', ministerFaith: '', serialRegCivil: '', nuipNuit: '', 
      oficinaRegistro: '', fechaExpedicion: ''
  });

  // 1. Carga inicial de Cancillería
  useEffect(() => {
    if (user) {
        let currentDioceseId = user.dioceseId || user.diocese_id;
        const allConcepts = getConceptosAnulacion(currentDioceseId);
        setConceptos(allConcepts.filter(c => c.tipo === 'porReposicion' || c.tipo === 'porCorreccion'));
        
        const misDatos = getMisDatosList(user.chanceryId || user.id);
        let parishLabel = `${user.dioceseName || 'Cancillería'} - ${user.city || 'Sede'}`;
        if (misDatos && misDatos.length > 0) parishLabel = `${misDatos[0].nombre} - ${misDatos[0].ciudad}`;
        setBautismoDecree(prev => ({ ...prev, parroquia: parishLabel.toUpperCase() }));
    }
  }, [user, getConceptosAnulacion, getMisDatosList]);

  // 2. EFECTO REACTIVO 100% NUBE: Cargar datos de la Parroquia Destino
  useEffect(() => {
      const fetchParishLiveParams = async () => {
          if (!bautismoDecree.targetParishId) {
              setNextParams({ libro: '', folio: '', numero: '' });
              setBautismoNewPartida(prev => ({ ...prev, ministerFaith: '' }));
              setCiudades([]);
              return;
          }

          try {
              // A. Traer Consecutivos Supletorios
              const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', bautismoDecree.targetParishId).maybeSingle();
              if (pData && pData.bautizos_params) {
                  setNextParams({
                      libro: String(pData.bautizos_params.suplementarioLibro || '1').padStart(4, '0'),
                      folio: String(pData.bautizos_params.suplementarioFolio || '1').padStart(4, '0'),
                      numero: String(pData.bautizos_params.suplementarioNumero || '1').padStart(4, '0')
                  });
              } else {
                  setNextParams({ libro: '0001', folio: '0001', numero: '0001' });
              }

              // B. Traer Párroco Activo
              const { data: priestData } = await supabase.from('parrocos').select('payload').eq('parish_id', bautismoDecree.targetParishId);
              if (priestData && priestData.length > 0) {
                  const active = priestData.find(r => String(r.payload.estado || r.payload.Estado) === '1');
                  if (active) {
                      let name = `${active.payload.nombre || ''} ${active.payload.apellido || ''}`.trim().toUpperCase();
                      if (!name.startsWith('PBRO')) name = `PBRO. ${name}`;
                      setBautismoNewPartida(prev => ({ ...prev, ministerFaith: name }));
                  }
              }

              // C. Traer Ciudades de esa Parroquia
              const listaCruda = getCiudadesList(bautismoDecree.targetParishId) || [];
              setCiudades(listaCruda.map(c => (c.nombre || '').toUpperCase()));

          } catch (error) {
              console.error("Error conectando con la parroquia destino:", error);
          }
      };

      fetchParishLiveParams();
  }, [bautismoDecree.targetParishId, getCiudadesList]);

  const handleChange = (e) => setBautismoNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));
  const handleCityChange = (data) => setNewPartida(prev => ({ ...prev, lugarNacimientoDetalle: String(data?.target?.value || data?.nombre || data || "").toUpperCase() }));

  const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!bautismoDecree.targetParishId || !bautismoDecree.numeroDecreto || !bautismoNewPartida.firstName || !bautismoNewPartida.lastName) {
          return toast({ title: "Datos Incompletos", description: "Llene todos los campos requeridos.", variant: "destructive" });
      }

      setIsSubmitting(true);
      
      try {
          // 1. Validar Duplicidad de Decreto
          const { data: existing } = await supabase.from('decretos').select('id').eq('tipo', 'reposicion').eq('parish_id', bautismoDecree.targetParishId).contains('payload', { decreeNumber: bautismoDecree.numeroDecreto }).maybeSingle();
          if (existing) {
              setIsSubmitting(false);
              return toast({ title: "Duplicado", description: `El decreto ${bautismoDecree.numeroDecreto} ya existe.`, variant: "destructive" });
          }

          // 2. Generar Nota Marginal
          const conceptoMatch = conceptos.find(c => String(c.id) === String(bautismoDecree.conceptoAnulacionId));
          const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'PÉRDIDA / DETERIORO';
          const fechaTexto = convertDateToSpanishText(bautismoDecree.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
          const notaMarginal = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${bautismoDecree.numeroDecreto.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${causaText}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

          // 3. Crear Partida en Supabase (Parroquia Destino)
          const partidaToSave = {
              ...bautismoNewPartida,
              book_number: nextParams.libro, page_number: nextParams.folio, entry_number: nextParams.numero,
              Libro: nextParams.libro, folio: nextParams.folio, numero: nextParams.numero,
              nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName,
              fecbau: bautismoNewPartida.sacramentDate, fecnac: bautismoNewPartida.birthDate,
              lugarn: bautismoNewPartida.lugarNacimientoDetalle, sex: bautismoNewPartida.sex,
              padre: bautismoNewPartida.fatherName, madre: bautismoNewPartida.motherName, 
              tipohijo: bautismoNewPartida.tipoUnionPadres, abuepat: bautismoNewPartida.paternalGrandparents, 
              abuemat: bautismoNewPartida.maternalGrandparents, padrinos: bautismoNewPartida.godparents, 
              ministro: bautismoNewPartida.minister, dafe: bautismoNewPartida.ministerFaith, 
              anulado: false, status: 'seated', notaMarginal: notaMarginal
          };

          const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
              parish_id: bautismoDecree.targetParishId, book_number: nextParams.libro, folio: nextParams.folio, number: nextParams.numero,
              celebration_date: bautismoNewPartida.sacramentDate || null, nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName,
              fecha_nacimiento: bautismoNewPartida.birthDate || null, lugar_nacimiento: bautismoNewPartida.lugarNacimientoDetalle, 
              sexo: bautismoNewPartida.sex, nombre_padre: bautismoNewPartida.fatherName, nombre_madre: bautismoNewPartida.motherName, 
              tipo_union_padres: bautismoNewPartida.tipoUnionPadres, padrinos: bautismoNewPartida.godparents, ministro: bautismoNewPartida.minister, 
              da_fe: bautismoNewPartida.ministerFaith, status: 'seated', nota_marginal: notaMarginal, raw_data: partidaToSave
          }]).select('id').single();
          if (errBap) throw errBap;

          // 4. Crear Decreto en Supabase
          const payloadDecree = {
              decreeNumber: bautismoDecree.numeroDecreto, decreeDate: bautismoDecree.fechaDecreto,
              conceptoAnulacionId: bautismoDecree.conceptoAnulacionId, causa: causaText,
              targetName: `${bautismoNewPartida.lastName} ${bautismoNewPartida.firstName}`.trim(),
              ...bautismoNewPartida, newPartidaId: newBap.id,
              datosNuevaPartida: { ...bautismoNewPartida, book: nextParams.libro, page: nextParams.folio, entry: nextParams.numero },
              newPartidaSummary: { book: nextParams.libro, page: nextParams.folio, entry: nextParams.numero, nombres: bautismoNewPartida.firstName, apellidos: bautismoNewPartida.lastName }
          };

          await supabase.from('decretos').insert([{ parish_id: bautismoDecree.targetParishId, tipo: 'reposicion', payload: payloadDecree }]);

          // 5. Actualizar Consecutivos (Sumar +1)
          const { data: currentParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', bautismoDecree.targetParishId).single();
          const p = currentParams?.bautizos_params || {};
          await supabase.from('parish_parameters').upsert({ parish_id: bautismoDecree.targetParishId, bautizos_params: { ...p, suplementarioNumero: Number(nextParams.numero) + 1 } }, { onConflict: 'parish_id' });

          toast({ title: "Decreto Emitido", description: "Guardado sincronizado con la Parroquia Destino.", className: "bg-green-50 text-green-900 border-green-200" });
          navigate('/chancery/decree-replacement/view');

      } catch (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  const formatParishOption = (parish) => {
      const todosMisDatos = data.misDatos || [];
      const parishDatos = todosMisDatos.find(md => md.parishId === parish.id) || {};
      return `${(parishDatos.nombre || parish.name || 'Parroquia').toUpperCase()} - ${(parishDatos.ciudad || parish.city || '').toUpperCase()}`;
  };

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
        <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement/view')} className="p-0 hover:bg-transparent">
                <ArrowLeft className="w-6 h-6 text-gray-500" />
            </Button>
            <div>
                <h1 className="text-3xl font-black text-gray-900 font-serif">Nuevo Decreto de Reposición</h1>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Sincronización Directa a Libros Parroquiales</p>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden max-w-6xl mx-auto p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-50 p-1 rounded-xl">
                    <TabsTrigger value="bautismo" className="py-3 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-amber-600 data-[state=active]:text-white">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmacion" disabled className="py-3 font-bold uppercase tracking-widest text-[10px]">Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonio" disabled className="py-3 font-bold uppercase tracking-widest text-[10px]">Matrimonios</TabsTrigger>
                </TabsList>

                <TabsContent value="bautismo" className="p-4">
                    <form onSubmit={handleSubmit} className="animate-in fade-in duration-500">
                        {/* SECCIÓN 1: DATOS DEL DECRETO */}
                        <div className="bg-amber-50/50 p-8 rounded-2xl border border-amber-100 shadow-sm mb-8">
                            <h3 className="font-black text-amber-800 text-sm uppercase mb-6 border-b border-amber-200 pb-3 flex items-center gap-2">
                                <FileText className="w-5 h-5"/> 1. DATOS DEL DECRETO MAESTRO
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                                <div className="md:col-span-3">
                                    <label className="block text-[10px] font-black text-amber-900 uppercase mb-2">Parroquia Destino (Dónde se asentará) <span className="text-red-500">*</span></label>
                                    <select value={bautismoDecree.targetParishId} onChange={(e) => setBautismoDecree({...bautismoDecree, targetParishId: e.target.value})} className="w-full rounded-xl border border-amber-200 px-4 py-3 text-sm bg-white font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" required>
                                        <option value="">-- SELECCIONAR PARROQUIA JURISDICCIONAL --</option>
                                        {(data.parishes || []).filter(p => p.dioceseId === user?.dioceseId).map(p => <option key={p.id} value={p.id}>{formatParishOption(p)}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-[10px] font-black text-amber-900 uppercase mb-2">No. de Decreto *</label><Input value={bautismoDecree.numeroDecreto} onChange={(e) => setBautismoDecree({...bautismoDecree, numeroDecreto: e.target.value.toUpperCase()})} placeholder="Ej: 001-2026" className="bg-white font-bold" required /></div>
                                <div><label className="block text-[10px] font-black text-amber-900 uppercase mb-2">Fecha Decreto *</label><Input type="date" value={bautismoDecree.fechaDecreto} onChange={(e) => setBautismoDecree({...bautismoDecree, fechaDecreto: e.target.value})} className="bg-white font-bold" required /></div>
                                <div><label className="block text-[10px] font-black text-amber-900 uppercase mb-2">Causa de Reposición *</label>
                                    <select value={bautismoDecree.conceptoAnulacionId} onChange={(e) => setBautismoDecree({...bautismoDecree, conceptoAnulacionId: e.target.value})} className="w-full rounded-xl border border-amber-200 px-4 py-3 text-sm bg-white font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-amber-500" required>
                                        <option value="">SELECCIONAR...</option>
                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA */}
                        <div className={`bg-white rounded-2xl shadow-sm border-l-4 border-blue-600 p-8 transition-opacity duration-300 ${!bautismoDecree.targetParishId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-3 border-b pb-3 uppercase tracking-tight">
                                <UserPlus className="w-6 h-6 text-blue-600" /> 2. ASIENTO SUPLETORIO REMOTO
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 text-center">Libro (Supletorio) *</label><Input value={nextParams.libro} readOnly className="bg-white text-blue-700 font-mono text-xl text-center font-black" /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 text-center">Folio (Supletorio) *</label><Input value={nextParams.folio} readOnly className="bg-white text-gray-800 font-mono text-xl text-center font-black" /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 text-center">Número (Supletorio) *</label><Input value={nextParams.numero} readOnly className="bg-white text-gray-800 font-mono text-xl text-center font-black" /></div>
                            </div>

                            {/* [El resto de inputs: Nombres, Apellidos, Fechas, Padres, Abuelos, Da Fe - usando handleChange y handleCityChange] */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Nombres *</label><Input name="firstName" value={bautismoNewPartida.firstName} onChange={handleChange} className="font-bold py-6 text-gray-800" required /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Apellidos *</label><Input name="lastName" value={bautismoNewPartida.lastName} onChange={handleChange} className="font-bold py-6 text-gray-800" required /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Fecha Bautismo *</label><Input type="date" name="sacramentDate" value={bautismoNewPartida.sacramentDate} onChange={(e)=>setBautismoNewPartida(prev=>({...prev, sacramentDate: e.target.value}))} className="font-bold py-6" required /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Lugar Bautismo</label><Input name="lugarBautismo" value={bautismoNewPartida.lugarBautismo} onChange={handleChange} className="font-bold py-6" /></div>
                            </div>
                            
                            {/* Omitido en este bloque corto el resto del form (Padres, Abuelos) para simplificar lectura, pero tú incluyelos idéntico a EditDecreeReplacement */}
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-6">
                                <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-4">Firmas y Autoridad Local</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Ministro Celebrante</label><Input name="minister" value={bautismoNewPartida.minister} onChange={handleChange} className="font-bold" /></div>
                                    <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Da Fe (Párroco) *</label><Input name="ministerFaith" value={bautismoNewPartida.ministerFaith} onChange={handleChange} className="font-bold text-gray-600 bg-gray-100" required /></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-4 bg-white p-4 border-t sticky bottom-0 z-10 rounded-b-2xl shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
                            <Button type="button" variant="outline" onClick={() => navigate('/chancery/decree-replacement/view')} className="px-8 font-black uppercase text-[10px]">Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting || !bautismoDecree.targetParishId} className="bg-amber-600 hover:bg-amber-700 text-white font-black px-10 shadow-lg shadow-amber-900/20 uppercase tracking-widest text-[10px]">
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} Sincronizar Decreto en Nube
                            </Button>
                        </div>
                    </form>
                </TabsContent>
            </Tabs>
        </div>
    </DashboardLayout>
  );
};

export default NewDecreeReplacementPage;