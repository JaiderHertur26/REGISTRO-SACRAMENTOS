import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, FileText, UserPlus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const NewDecreeReplacementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
      data,
      getConceptosAnulacion, 
      getParrocoActual,
      getMisDatosList,
      createChanceryReplacement
  } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  
  // NUEVO: Estado para mostrar los contadores en vivo de la parroquia seleccionada
  const [nextParams, setNextParams] = useState({ libro: '', folio: '', numero: '' });

  const [bautismoDecree, setBautismoDecree] = useState({ 
      parroquia: '',
      targetParishId: '',
      numeroDecreto: '', 
      fechaDecreto: new Date().toISOString().split('T')[0], 
      conceptoAnulacionId: '',
      descripcionHechos: ''
  });
  
  const [bautismoNewPartida, setBautismoNewPartida] = useState({
      sacramentDate: '', firstName: '', lastName: '', birthDate: '', 
      lugarNacimientoDetalle: '', lugarBautismo: '',
      fatherName: '', ceduPadre: '', motherName: '', ceduMadre: '', 
      tipoUnionPadres: '1', sex: '1', paternalGrandparents: '', maternalGrandparents: '',
      godparents: '', minister: '', ministerFaith: '',
      serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: ''
  });

  // 1. Carga inicial de datos de Cancillería y Conceptos
  useEffect(() => {
    if (user?.parishId || user?.dioceseId) {
        const contextId = user?.parishId || user?.dioceseId;
        const allConcepts = getConceptosAnulacion(contextId);
        const repoConcepts = allConcepts.filter(c => c.tipo === 'porReposicion' || c.tipo === 'porCorreccion');
        setConceptos(repoConcepts.length > 0 ? repoConcepts : allConcepts);
        
        const misDatos = getMisDatosList(contextId);
        let parishLabel = `${user.dioceseName || 'Cancillería'} - ${user.city || 'Ciudad'}`;
        if (misDatos && misDatos.length > 0) {
            parishLabel = `${misDatos[0].nombre || user.dioceseName} - ${misDatos[0].ciudad || user.city}`;
        }
        setBautismoDecree(prev => ({ ...prev, parroquia: parishLabel }));
    }
  }, [user, getConceptosAnulacion, getMisDatosList]);

  // 2. EFECTO REACTIVO: Cuando el Canciller elige una Parroquia Destino, traemos sus contadores y su Párroco
  useEffect(() => {
      if (bautismoDecree.targetParishId) {
          // Traer Libro, Folio y Número de la parroquia elegida
          const params = JSON.parse(localStorage.getItem(`baptismParameters_${bautismoDecree.targetParishId}`) || '{}');
          setNextParams({
              libro: String(params.suplementarioLibro || '1').padStart(4, '0'),
              folio: String(params.suplementarioFolio || '1').padStart(4, '0'),
              numero: String(params.suplementarioNumero || '1').padStart(4, '0')
          });

          // Traer el Párroco actual de esa parroquia para el "Da Fe"
          const priest = getParrocoActual(bautismoDecree.targetParishId);
          if (priest) {
              let name = `${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase();
              // Si el nombre ya trae "PBRO", no lo repetimos
              if (!name.startsWith('PBRO')) {
                  name = `PBRO. ${name}`;
              }
              setBautismoNewPartida(prev => ({ ...prev, ministerFaith: name }));
          } else {
              setBautismoNewPartida(prev => ({ ...prev, ministerFaith: 'PÁRROCO ENCARGADO' }));
          }
      } else {
          // Si se deselecciona la parroquia, vaciamos todo
          setNextParams({ libro: '', folio: '', numero: '' });
          setBautismoNewPartida(prev => ({ ...prev, ministerFaith: '' }));
      }
  }, [bautismoDecree.targetParishId, getParrocoActual]);

  const getConceptDetails = (id) => conceptos.find(c => c.id === id) || null;
  const selectedConcept = getConceptDetails(bautismoDecree.conceptoAnulacionId);

  const formatParishOption = (parish) => {
      const todosMisDatos = data.misDatos || [];
      const parishDatos = todosMisDatos.find(md => md.parishId === parish.id) || {};
      const nombre = parishDatos.nombre || parish.name || 'Parroquia';
      const ciudad = parishDatos.ciudad || parish.city || 'BARRANQUILLA';
      return `${nombre.toUpperCase()} - ${ciudad.toUpperCase()}`;
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      
      const targetParishId = bautismoDecree.targetParishId;
      const chanceryId = user.dioceseId || user.id;

      if (!targetParishId) return toast({ title: "Error", description: "Debe seleccionar la parroquia destino.", variant: "destructive" });
      if (!bautismoDecree.numeroDecreto || !bautismoNewPartida.firstName || !bautismoNewPartida.lastName) {
          return toast({ title: "Error", description: "Faltan datos obligatorios.", variant: "destructive" });
      }
      if (!bautismoDecree.conceptoAnulacionId) return toast({ title: "Error", description: "Debe seleccionar un Concepto.", variant: "destructive" });

      setIsSubmitting(true);
      
      const response = await createChanceryReplacement(bautismoDecree, bautismoNewPartida, targetParishId, chanceryId);

      if (response.success) {
          toast({ title: "Reposición Exitosa", description: "Decreto maestro guardado y parroquia actualizada.", className: "bg-green-50 border-green-200 text-green-900" });
          navigate('/chancery/decree-replacement/view');
      } else {
          toast({ title: "Error", description: response.message, variant: "destructive" });
      }
      setIsSubmitting(false);
  };

  const dioceseParishes = data.parishes ? data.parishes.filter(p => p.dioceseId === user?.dioceseId) : [];

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
        <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement/view')} className="p-0 hover:bg-transparent">
                <ArrowLeft className="w-6 h-6 text-gray-500" />
            </Button>
            <div>
                <h1 className="text-2xl font-bold text-gray-900 font-serif">Nuevo Decreto de Reposición</h1>
                <p className="text-gray-500 text-sm">Registro de reposición de partidas perdidas o deterioradas (Libro Supletorio)</p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-6xl mx-auto p-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger value="bautismo" className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmacion" disabled className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonio" disabled className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm">Matrimonios</TabsTrigger>
                </TabsList>

                <TabsContent value="bautismo" className="p-4">
                    <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        
                        {/* SECCIÓN 1: DATOS DEL DECRETO */}
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm mb-6">
                            <h3 className="font-bold text-blue-800 text-sm uppercase mb-4 border-b border-blue-300 pb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4"/> 1. DATOS DEL DECRETO
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                                
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Parroquia Destino (Dónde se asentará) <span className="text-red-500">*</span></label>
                                    <select
                                        value={bautismoDecree.targetParishId}
                                        onChange={(e) => setBautismoDecree({...bautismoDecree, targetParishId: e.target.value})}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Seleccionar Parroquia Destino...</option>
                                        {dioceseParishes.map(p => <option key={p.id} value={p.id}>{formatParishOption(p)}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número de Decreto <span className="text-red-500">*</span></label>
                                    <Input value={bautismoDecree.numeroDecreto} onChange={(e) => setBautismoDecree({...bautismoDecree, numeroDecreto: e.target.value})} placeholder="Ej: 001-2025" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Decreto <span className="text-red-500">*</span></label>
                                    <Input type="date" value={bautismoDecree.fechaDecreto} onChange={(e) => setBautismoDecree({...bautismoDecree, fechaDecreto: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Concepto de Reposición <span className="text-red-500">*</span></label>
                                    <select
                                        value={bautismoDecree.conceptoAnulacionId}
                                        onChange={(e) => setBautismoDecree({...bautismoDecree, conceptoAnulacionId: e.target.value})}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Seleccionar Concepto...</option>
                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA */}
                        <div className="bg-white rounded-lg shadow-sm border-l-4 border-green-600 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <UserPlus className="w-5 h-5 text-green-600" /> SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA
                            </h3>

                            {/* LAS CAJAS GRISES DE LIBRO, FOLIO Y NÚMERO (Idénticas a la Parroquia) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 bg-gray-50 border border-gray-100 rounded-lg">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Libro (Nuevo) *</label>
                                    <Input value={nextParams.libro} readOnly className="bg-gray-100 text-gray-500 font-mono text-center" placeholder="---" />
                                    <span className="text-[10px] text-gray-400 mt-1">Asignado de parámetros (Supletorio)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Folio (Nuevo) *</label>
                                    <Input value={nextParams.folio} readOnly className="bg-gray-100 text-gray-500 font-mono text-center" placeholder="---" />
                                    <span className="text-[10px] text-gray-400 mt-1">Asignado de parámetros (Supletorio)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número (Nuevo) *</label>
                                    <Input value={nextParams.numero} readOnly className="bg-gray-100 text-gray-500 font-mono text-center" placeholder="---" />
                                    <span className="text-[10px] text-gray-400 mt-1">Asignado de parámetros (Supletorio)</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Bautismo *</label><Input type="date" value={bautismoNewPartida.sacramentDate} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, sacramentDate: e.target.value})} required /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lugar Bautismo</label><Input value={bautismoNewPartida.lugarBautismo} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, lugarBautismo: e.target.value})} placeholder="Parroquia..." /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombres *</label><Input value={bautismoNewPartida.firstName} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, firstName: e.target.value})} required /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Apellidos *</label><Input value={bautismoNewPartida.lastName} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, lastName: e.target.value})} required /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Nacimiento</label><Input type="date" value={bautismoNewPartida.birthDate} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, birthDate: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lugar de Nacimiento</label><Input value={bautismoNewPartida.lugarNacimientoDetalle} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, lugarNacimientoDetalle: e.target.value})} /></div>
                                
                                {/* BLOQUE PADRES */}
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h4 className="md:col-span-2 text-xs font-bold text-blue-600 uppercase border-b pb-1 mb-2">Datos de los Padres</h4>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombre del Padre</label><Input value={bautismoNewPartida.fatherName} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, fatherName: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cédula del Padre</label><Input value={bautismoNewPartida.ceduPadre} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, ceduPadre: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombre de la Madre</label><Input value={bautismoNewPartida.motherName} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, motherName: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cédula de la Madre</label><Input value={bautismoNewPartida.ceduMadre} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, ceduMadre: e.target.value})} /></div>
                                </div>

                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Unión</label><select value={bautismoNewPartida.tipoUnionPadres} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, tipoUnionPadres: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"><option value="1">1 - MATRIMONIO CATÓLICO</option><option value="2">2 - MATRIMONIO CIVIL</option><option value="3">3 - UNIÓN LIBRE</option><option value="4">4 - MADRE SOLTERA</option><option value="5">5 - OTRO</option></select></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Sexo</label><select value={bautismoNewPartida.sex} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, sex: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"><option value="1">1 - Masculino</option><option value="2">2 - Femenino</option></select></div>
                                
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Abuelos Paternos</label><Input value={bautismoNewPartida.paternalGrandparents} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, paternalGrandparents: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Abuelos Maternos</label><Input value={bautismoNewPartida.maternalGrandparents} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, maternalGrandparents: e.target.value})} /></div>
                                
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Padrinos</label><Input value={bautismoNewPartida.godparents} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, godparents: e.target.value})} /></div>
                                
                                {/* BLOQUE REGISTRO CIVIL */}
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h4 className="md:col-span-4 text-xs font-bold text-blue-600 uppercase border-b pb-1 mb-2">Datos Registro Civil</h4>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Serial Reg. Civil</label><Input value={bautismoNewPartida.serialRegCivil} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, serialRegCivil: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">NUIP / NUIT</label><Input value={bautismoNewPartida.nuipNuit} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, nuipNuit: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Oficina Registro</label><Input value={bautismoNewPartida.oficinaRegistro} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, oficinaRegistro: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha Expedición</label><Input type="date" value={bautismoNewPartida.fechaExpedicion} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, fechaExpedicion: e.target.value})} /></div>
                                </div>

                                {/* BLOQUE FIRMAS (Añadido DA FE) */}
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Ministro (Quien bautizó)</label><Input value={bautismoNewPartida.minister} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, minister: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Da Fe <span className="text-red-500">*</span></label><Input value={bautismoNewPartida.ministerFaith} onChange={(e) => setBautismoNewPartida({...bautismoNewPartida, ministerFaith: e.target.value})} required /></div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/chancery/decree-replacement/view')}>
                                <X className="w-4 h-4 mr-2" /> Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {isSubmitting ? 'Guardando...' : <><Save className="w-4 h-4 mr-2" /> Emitir Decreto de Reposición</>}
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