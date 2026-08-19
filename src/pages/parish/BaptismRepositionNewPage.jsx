import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, FileText, UserPlus, CheckCircle, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';

const BaptismRepositionNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { getParrocoActual } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  const [cloudParams, setCloudParams] = useState({});
  
  // 🚀 ESTADO PARA TABLA DE AUXILIARES
  const [auxiliares, setAuxiliares] = useState({ ciudades: [], ministros: [] });
  
  const [decreeData, setDecreeData] = useState({ 
      numeroDecreto: '', 
      fechaDecreto: new Date().toISOString().split('T')[0], 
      conceptoAnulacionId: '' 
  });
  
  const [formData, setFormData] = useState({
      sacramentDate: '', firstName: '', lastName: '', sex: 'MASCULINO',
      birthDate: '', placeOfBirth: '', fatherName: '', motherName: '', 
      tipoUnionPadres: 'MATRIMONIO CATÓLICO', paternalGrandparents: '', 
      maternalGrandparents: '', godparents: '', minister: '', ministerFaith: '',
      serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: ''
  });

  // --- 1. CARGA INICIAL DESDE LA NUBE ---
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

              // 🚀 CARGAR DATOS DE LA TABLA AUXILIARES
              const { data: auxData } = await supabase.from('auxiliares').select('tipo, nombre');
              if (auxData) {
                  setAuxiliares({
                      ciudades: [...new Set(auxData.filter(a => ['ciudad', 'municipio', 'lugar'].includes(a.tipo?.toLowerCase())).map(a => a.nombre.toUpperCase()))],
                      ministros: [...new Set(auxData.filter(a => ['ministro', 'sacerdote', 'diacono'].includes(a.tipo?.toLowerCase())).map(a => a.nombre.toUpperCase()))]
                  });
              }

              // 🚀 PÁRROCO ACTUAL (Se asigna a ambos campos automáticamente)
              const priest = getParrocoActual(user.parishId);
              if (priest) {
                  const name = `${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase();
                  setFormData(prev => ({ 
                      ...prev, 
                      ministerFaith: name, 
                      minister: name // Asigna también al Sacerdote Celebrante por defecto
                  }));
              }
          } catch (error) {
              console.error("Error inicializando datos:", error);
          }
      };

      loadInitialData();
  }, [user, getParrocoActual]);

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  // --- 2. PROCESAMIENTO Y GUARDADO ---
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
          
          const notaMarginalTecnica = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.numeroDecreto.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${conceptoText.toUpperCase()}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

          const partidaToSave = {
              ...formData,
              Libro: supletorioLibro, folio: supletorioFolio, numero: supletorioNumero,
              book_number: supletorioLibro, page_number: supletorioFolio, entry_number: supletorioNumero,
              nombres: formData.firstName, apellidos: formData.lastName,
              fecbau: formData.sacramentDate, fecnac: formData.birthDate,
              lugarn: formData.placeOfBirth, sex: formData.sex,
              padre: formData.fatherName, madre: formData.motherName, tipohijo: formData.tipoUnionPadres,
              abuepat: formData.paternalGrandparents, abuemat: formData.maternalGrandparents,
              padrinos: formData.godparents, ministro: formData.minister, dafe: formData.ministerFaith,
              anulado: false, status: 'seated', notaMarginal: notaMarginalTecnica
          };

          const payloadDecree = {
              decreeNumber: decreeData.numeroDecreto,
              numeroDecreto: decreeData.numeroDecreto,
              decreeDate: decreeData.fechaDecreto,
              conceptoAnulacionId: decreeData.conceptoAnulacionId,
              causa: conceptoText,
              targetName: `${formData.lastName} ${formData.firstName}`.trim(),
              ...formData,
              datosNuevaPartida: {
                  ...formData,
                  book: supletorioLibro,
                  page: supletorioFolio,
                  entry: supletorioNumero,
                  book_number: supletorioLibro,
                  page_number: supletorioFolio,
                  entry_number: supletorioNumero,
              },
              newPartidaSummary: { book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero, nombres: formData.firstName, apellidos: formData.lastName }
          };

          const { data: newBap, error: errBap } = await supabase.from('baptisms').insert([{
              parish_id: user.parishId,
              book_number: supletorioLibro, folio: supletorioFolio, number: supletorioNumero,
              celebration_date: formData.sacramentDate || null, nombres: formData.firstName, apellidos: formData.lastName, sexo: formData.sex,
              fecha_nacimiento: formData.birthDate || null, lugar_nacimiento: formData.placeOfBirth,
              nombre_padre: formData.fatherName, nombre_madre: formData.motherName, tipo_union_padres: formData.tipoUnionPadres,
              abuelos_paternos: formData.paternalGrandparents, abuelos_maternos: formData.maternalGrandparents, padrinos: formData.godparents,
              ministro: formData.minister, da_fe: formData.ministerFaith, status: 'seated', nota_marginal: notaMarginalTecnica,
              raw_data: partidaToSave
          }]).select('id').single();

          if (errBap) throw errBap;

          payloadDecree.newPartidaId = newBap.id;
          await supabase.from('decretos').insert([{ parish_id: user.parishId, tipo: 'reposicion', payload: payloadDecree }]);

          const newParams = { ...cloudParams, suplementarioNumero: Number(supletorioNumero) + 1 };
          await supabase.from('parish_parameters').upsert({ parish_id: user.parishId, bautizos_params: newParams }, { onConflict: 'parish_id' });

          toast({ title: "Reposición Exitosa", description: "La partida supletoria ha sido creada en la Nube.", className: "bg-green-50 text-green-900 border-green-200" });
          navigate('/parroquia/decretos/reposicion');

      } catch (error) {
          toast({ title: "Error en Proceso", description: error.message, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        {/* 🚀 DATALISTS PARA AUTOCOMPLETADO DESDE AUXILIARES */}
        <datalist id="ciudades-list">
            {auxiliares.ciudades.map((c, i) => <option key={i} value={c} />)}
        </datalist>
        <datalist id="ministros-list">
            {auxiliares.ministros.map((m, i) => <option key={i} value={m} />)}
        </datalist>

        <div className="max-w-6xl mx-auto pb-24 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decreto de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Generación de Partidas Supletorias</p>
                    </div>
                </div>
                <div className="bg-amber-50 text-amber-800 px-5 py-3 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider leading-tight">Acción Legal:<br/>Reposición de Registro Perdido</span>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-10 pt-8">
                        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-2xl h-14">
                            <TabsTrigger value="bautismo" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmacion" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonio" className="rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-30" disabled>Matrimonios</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="bautismo" className="p-10 focus:outline-none">
                        <form onSubmit={handleSubmit} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            <section>
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText className="w-5 h-5"/></div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">01. Información del Decreto</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Número de Decreto *</label>
                                        <Input value={decreeData.numeroDecreto} onChange={(e) => setDecreeData({ ...decreeData, numeroDecreto: e.target.value.toUpperCase() })} className="py-6 font-black text-blue-600 bg-blue-50/30 border-blue-100 shadow-sm" placeholder="EJ: 005-2025" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha de Emisión *</label>
                                        <Input type="date" value={decreeData.fechaDecreto} onChange={(e) => setDecreeData({ ...decreeData, fechaDecreto: e.target.value })} className="py-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Causa de la Reposición *</label>
                                        <select 
                                            value={decreeData.conceptoAnulacionId} 
                                            onChange={(e) => setDecreeData({ ...decreeData, conceptoAnulacionId: e.target.value })}
                                            className="w-full h-[50px] px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-sm font-bold text-gray-700 uppercase"
                                        >
                                            <option value="">SELECCIONE CONCEPTO...</option>
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                                    <div className="bg-green-50 p-2 rounded-lg text-green-600"><UserPlus className="w-5 h-5"/></div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">02. Datos de la Partida a Reponer</h3>
                                </div>
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Apellidos Completos *</label><Input name="lastName" value={formData.lastName} onChange={handleChange} className="py-6 uppercase font-black text-gray-800" placeholder="PÉREZ GARCÍA" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombres Completos *</label><Input name="firstName" value={formData.firstName} onChange={handleChange} className="py-6 uppercase font-black text-gray-800" placeholder="JUAN ALBERTO" /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Bautismo</label><Input type="date" name="sacramentDate" value={formData.sacramentDate} onChange={handleChange} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Nacimiento</label><Input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="py-6" /></div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lugar Nacimiento</label>
                                            <Input name="placeOfBirth" list="ciudades-list" value={formData.placeOfBirth} onChange={handleChange} className="py-6 uppercase text-xs font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sexo</label>
                                            <select name="sex" value={formData.sex} onChange={handleChange} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl font-bold bg-gray-50 uppercase text-xs">
                                                <option value="MASCULINO">MASCULINO</option>
                                                <option value="FEMENINO">FEMENINO</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-100">
                                        <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100/50 space-y-4">
                                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Filiación Paterna</p>
                                            <Input name="fatherName" placeholder="Nombre del Padre" value={formData.fatherName} onChange={handleChange} className="bg-white uppercase font-bold text-xs" />
                                            <Input name="paternalGrandparents" placeholder="Abuelos Paternos" value={formData.paternalGrandparents} onChange={handleChange} className="bg-white uppercase text-[10px]" />
                                        </div>
                                        <div className="bg-pink-50/30 p-6 rounded-3xl border border-pink-100/50 space-y-4">
                                            <p className="text-[10px] font-black text-pink-700 uppercase tracking-[0.2em]">Filiación Materna</p>
                                            <Input name="motherName" placeholder="Nombre de la Madre" value={formData.motherName} onChange={handleChange} className="bg-white uppercase font-bold text-xs" />
                                            <Input name="maternalGrandparents" placeholder="Abuelos Maternos" value={formData.maternalGrandparents} onChange={handleChange} className="bg-white uppercase text-[10px]" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Padrinos</label>
                                        <Input name="godparents" value={formData.godparents} onChange={handleChange} className="py-6 uppercase font-bold text-gray-600 shadow-sm" placeholder="EJ: CARLOS PÉREZ Y MARÍA GARCÍA" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sacerdote Celebrante</label>
                                            <Input name="minister" list="ministros-list" value={formData.minister} onChange={handleChange} className="py-6 uppercase font-black text-blue-900" placeholder="NOMBRE DEL MINISTRO" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Firma (Da Fe) *</label>
                                            <Input name="ministerFaith" list="ministros-list" value={formData.ministerFaith} onChange={handleChange} className="py-6 uppercase font-bold text-gray-500 bg-gray-50" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-end gap-4 border-t border-gray-100 pt-10">
                                <Button type="button" variant="ghost" onClick={() => navigate('/parroquia/decretos/reposicion')} disabled={isSubmitting} className="px-8 text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest text-[10px]">Cancelar</Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl hover:shadow-green-500/20 text-white px-12 py-8 rounded-2xl transition-all transform active:scale-95 font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-green-900/10"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <><Save className="w-5 h-5 mr-3" /> Ejecutar Reposición</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    </DashboardLayout>
  );
};

export default BaptismRepositionNewPage;