import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
    Save, X, FileText, UserPlus, CheckCircle, 
    Loader2, AlertCircle, BookOpen, UserCheck, 
    ShieldCheck, Eraser 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { generateUUID, incrementPaddedValue } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

const BaptismRepositionNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // 🧠 Herramientas del Cerebro Global
  const { 
      getConceptosAnulacion, 
      getParrocoActual,
      getMisDatosList,
      purificarRegistroBautismo,
      guardarEnPermanentes
  } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  const [activePriest, setActivePriest] = useState('');
  
  // SECCIÓN 1: DATOS DEL DECRETO DE REPOSICIÓN
  const [decreeData, setDecreeData] = useState({ 
      numeroDecreto: '', 
      fechaDecreto: new Date().toISOString().split('T')[0], 
      conceptoAnulacionId: '' 
  });
  
  // SECCIÓN 2: DATOS DE LA PERSONA (NUEVA PARTIDA)
  const [formData, setFormData] = useState({
      sacramentDate: '', 
      firstName: '', 
      lastName: '', 
      sex: 'MASCULINO',
      birthDate: '', 
      placeOfBirth: '', 
      fatherName: '', 
      motherName: '', 
      tipoUnionPadres: 'MATRIMONIO CATÓLICO',
      paternalGrandparents: '', 
      maternalGrandparents: '', 
      godparents: '', 
      minister: '', 
      ministerFaith: '',
      serialRegCivil: '', 
      nuipNuit: '', 
      oficinaRegistro: '', 
      fechaExpedicion: ''
  });

  // --- 1. CARGA INICIAL ---
  useEffect(() => {
      if (user?.parishId) {
          // Filtrar solo conceptos de Reposición
          const allConcepts = getConceptosAnulacion(user.parishId);
          setConceptos(allConcepts.filter(c => 
              c.tipo === 'porReposicion' || 
              c.concepto?.toLowerCase().includes('reposición') || 
              c.concepto?.toLowerCase().includes('reposicion')
          ));
          
          // Firma automática (párroco activo)
          const priest = getParrocoActual(user.parishId);
          if (priest) {
              const name = `${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase();
              setActivePriest(name);
              setFormData(prev => ({ ...prev, ministerFaith: name }));
          }
      }
  }, [user]);

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- 2. PROCESAMIENTO Y GUARDADO ---
  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!decreeData.numeroDecreto || !formData.firstName || !formData.lastName) {
          toast({ title: "Faltan Datos", description: "El número de decreto y el nombre del bautizado son obligatorios.", variant: "destructive" });
          return;
      }

      setIsSubmitting(true);
      const parishId = user?.parishId;

      try {
          // A. Obtener numeración de Libros Supletorios
          let params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
          if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };

          // B. Generar Nota Marginal de Reposición
          const conceptoText = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId))?.concepto || 'REPOSICIÓN POR DETERIORO O PÉRDIDA';
          const fechaTexto = convertDateToSpanishText(decreeData.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
          
          const notaMarginalTecnica = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.numeroDecreto.toUpperCase()} DE FECHA ${fechaTexto}, DEBIDO A LA ${conceptoText.toUpperCase()} DEL ORIGINAL. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;

          // C. 🧠 PASAR POR EL CEREBRO DE PURIFICACIÓN
          const registroParaPurificar = {
              ...formData,
              parishId: parishId,
              status: 'seated',
              isSupplementary: true,
              creadoPorDecreto: true,
              numeroDecreto: decreeData.numeroDecreto,
              // Asignamos la ubicación supletoria antes de purificar
              book_number: params.suplementarioLibro,
              page_number: params.suplementarioFolio,
              entry_number: params.suplementarioNumero,
              // Forzamos la nota técnica de reposición
              marginNote: notaMarginalTecnica
          };

          const registroPurificado = purificarRegistroBautismo(registroParaPurificar);

          // D. Inyectar en la Nube mediante el motor de guardado único
          const res = await guardarEnPermanentes(registroPurificado);
          if (!res.success) throw new Error(res.error);

          // E. Actualizar el consecutivo de la parroquia
          params.suplementarioNumero = incrementPaddedValue(params.suplementarioNumero || '0');
          localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));

          // F. Guardar en el historial de Decretos de Reposición
          const decreeKey = `decreeReplacementBaptism_${parishId}`;
          const currentDecrees = JSON.parse(localStorage.getItem(decreeKey) || '[]');
          currentDecrees.push({
              id: generateUUID(),
              ...decreeData,
              type: 'replacement',
              sacrament: 'bautismo',
              targetName: `${registroPurificado.lastName}, ${registroPurificado.firstName}`,
              newPartidaId: registroPurificado.id,
              newPartidaSummary: { 
                  book: registroPurificado.book_number, 
                  page: registroPurificado.page_number, 
                  entry: registroPurificado.entry_number 
              },
              status: 'active',
              createdAt: new Date().toISOString()
          });
          localStorage.setItem(decreeKey, JSON.stringify(currentDecrees));

          window.dispatchEvent(new Event('storage'));
          setIsSuccess(true);
          toast({ title: "Reposición Exitosa", description: "La partida supletoria ha sido creada en la Nube.", className: "bg-green-50 text-green-900 border-green-200" });

      } catch (error) {
          toast({ title: "Error en Proceso", description: error.message, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isSuccess) {
      return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-2xl mx-auto bg-white p-12 rounded-[2.5rem] shadow-xl text-center mt-12 border border-gray-100 animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">¡Reposición Completada!</h2>
                <p className="text-gray-500 mb-10 font-medium">El decreto ha sido archivado y la nueva partida supletoria ya se encuentra en la Nube.</p>
                <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => navigate('/parroquia/decretos/reposicion')} variant="outline" className="py-7 rounded-2xl font-bold uppercase tracking-widest text-[10px] border-gray-200">Ver Listado</Button>
                    <Button onClick={() => window.location.reload()} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white py-7 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20">Nueva Reposición</Button>
                </div>
            </div>
        </DashboardLayout>
      );
  }

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Decreto de Reposición</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Generación de Partidas Supletorias en la Nube</p>
                    </div>
                </div>
                <div className="bg-amber-50 text-amber-800 px-5 py-3 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-black uppercase tracking-wider leading-tight">Acción Legal:<br/>Reposición de Registro Perdido</span>
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
                            
                            {/* SECCIÓN 1: DATOS DEL DECRETO */}
                            <section>
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText className="w-5 h-5"/></div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">01. Información del Decreto</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Número de Decreto *</label>
                                        <Input value={decreeData.numeroDecreto} onChange={(e) => setDecreeData({ ...decreeData, numeroDecreto: e.target.value })} className="py-6 font-black text-blue-600 bg-blue-50/30 border-blue-100 shadow-sm" placeholder="EJ: 005-2025" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha de Emisión *</label>
                                        <Input type="date" value={decreeData.fechaDecreto} onChange={(e) => setDecreeData({ ...decreeData, fechaDecreto: e.target.value })} className="py-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Causa de la Reposición</label>
                                        <select 
                                            value={decreeData.conceptoAnulacionId} 
                                            onChange={(e) => setDecreeData({ ...decreeData, conceptoAnulacionId: e.target.value })}
                                            className="w-full h-[50px] px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-sm font-bold text-gray-700"
                                        >
                                            <option value="">SELECCIONE CONCEPTO...</option>
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* SECCIÓN 2: DATOS DEL BAUTIZADO */}
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
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Bautismo *</label><Input type="date" name="sacramentDate" value={formData.sacramentDate} onChange={handleChange} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha Nacimiento</label><Input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="py-6" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lugar Nacimiento</label><Input name="placeOfBirth" value={formData.placeOfBirth} onChange={handleChange} className="py-6 uppercase text-xs font-bold" /></div>
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
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sacerdote Celebrante</label><Input name="minister" value={formData.minister} onChange={handleChange} className="py-6 uppercase font-black text-blue-900" placeholder="NOMBRE DEL MINISTRO" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Firma (Da Fe)</label><Input name="ministerFaith" value={formData.ministerFaith} onChange={handleChange} className="py-6 uppercase font-bold text-gray-500 bg-gray-50" /></div>
                                    </div>
                                </div>
                            </section>

                            {/* ACCIONES FINALES */}
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