import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, CheckCircle, Search, AlertCircle, FileText, UserPlus, Info, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { generateUUID, incrementPaddedValue } from '@/utils/supabaseHelpers';

const DecreeReplacementNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
      getConceptosAnulacion, 
      getBaptisms,
      getConfirmations,
      getMatrimonios, 
      getParrocoActual,
      createDecreeReplacement
  } = useAppData();
  
  const [activeTab, setActiveTab] = useState("bautismo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  
  // Initialize states with valid empty strings
  const [bautismoDecree, setBautismoDecree] = useState({ numeroDecreto: '', fechaDecreto: new Date().toISOString().split('T')[0], conceptoAnulacionId: '', observations: '' });
  const [confirmacionDecree, setConfirmacionDecree] = useState({ numeroDecreto: '', fechaDecreto: new Date().toISOString().split('T')[0], conceptoAnulacionId: '', observations: '' });
  const [matrimonioDecree, setMatrimonioDecree] = useState({ numeroDecreto: '', fechaDecreto: new Date().toISOString().split('T')[0], conceptoAnulacionId: '', observations: '' });

  // --- BAPTISM STATE ---
  const [bautismoSearch, setBautismoSearch] = useState({ book: '', page: '', entry: '' });
  const [bautismoFound, setBautismoFound] = useState(null);
  const [bautismoSearchError, setBautismoSearchError] = useState(null);
  const [bautismoSearching, setBautismoSearching] = useState(false);
  const [bautismoNewPartida, setBautismoNewPartida] = useState({
      sacramentDate: '', firstName: '', lastName: '', birthDate: '', placeOfBirth: '',
      fatherName: '', motherName: '', tipoUnionPadres: '1', sex: '1',
      paternalGrandparents: '', maternalGrandparents: '',
      godparents: '', minister: '', ministerFaith: '',
      // Datos Registro Civil
      serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: ''
  });

  // --- CONFIRMATION STATE ---
  const [confirmacionSearch, setConfirmacionSearch] = useState({ book: '', page: '', entry: '' });
  const [confirmacionFound, setConfirmacionFound] = useState(null);
  const [confirmacionSearchError, setConfirmacionSearchError] = useState(null);
  const [confirmacionSearching, setConfirmacionSearching] = useState(false);
  const [confirmacionNewPartida, setConfirmacionNewPartida] = useState({
      sacramentDate: '', firstName: '', lastName: '', birthDate: '', placeOfBirth: '',
      fatherName: '', motherName: '', godparents: '', minister: '', ministerFaith: ''
  });

  // --- MARRIAGE STATE ---
  const [matrimonioSearch, setMatrimonioSearch] = useState({ book: '', page: '', entry: '' });
  const [matrimonioFound, setMatrimonioFound] = useState(null);
  const [matrimonioSearchError, setMatrimonioSearchError] = useState(null);
  const [matrimonioSearching, setMatrimonioSearching] = useState(false);
  const [matrimonioNewPartida, setMatrimonioNewPartida] = useState({
      sacramentDate: '', husbandName: '', husbandSurname: '', wifeName: '', wifeSurname: '',
      witnesses: '', minister: '', ministerFaith: ''
  });

  // Load Initial Data
  useEffect(() => {
    if (user?.parishId) {
        const allConcepts = getConceptosAnulacion(user.parishId);
        setConceptos(allConcepts.filter(c => c.tipo === 'porReposicion'));
        const priest = getParrocoActual(user.parishId);
        if (priest) {
            const name = `${priest.nombre} ${priest.apellido || ''}`.trim();
            setBautismoNewPartida(prev => ({ ...prev, ministerFaith: name }));
            setConfirmacionNewPartida(prev => ({ ...prev, ministerFaith: name }));
            setMatrimonioNewPartida(prev => ({ ...prev, ministerFaith: name }));
        }
    }
  }, [user, getConceptosAnulacion, getParrocoActual]);

  const handleSearch = (type) => {
      let searchParams, setSearchError, setFound, setSearching, getMethod, mapNewPartida;
      
      if (type === 'bautismo') {
          searchParams = bautismoSearch; setSearchError = setBautismoSearchError; setFound = setBautismoFound; setSearching = setBautismoSearching; getMethod = getBaptisms;
          mapNewPartida = (found) => setBautismoNewPartida(prev => ({ ...prev, sacramentDate: found.sacramentDate || '', firstName: found.firstName || '', lastName: found.lastName || '', birthDate: found.birthDate || '', placeOfBirth: found.lugarNacimientoDetalle || found.birthPlace || '', fatherName: found.fatherName || '', motherName: found.motherName || '', godparents: found.godparents || '', minister: found.minister || '' }));
      } else if (type === 'confirmacion') {
          searchParams = confirmacionSearch; setSearchError = setConfirmacionSearchError; setFound = setConfirmacionFound; setSearching = setConfirmacionSearching; getMethod = getConfirmations;
          mapNewPartida = (found) => setConfirmacionNewPartida(prev => ({ ...prev, sacramentDate: found.sacramentDate || '', firstName: found.firstName || '', lastName: found.lastName || '', birthDate: found.birthDate || '', placeOfBirth: found.placeOfBirth || '', fatherName: found.fatherName || '', motherName: found.motherName || '', godparents: found.godparents || '', minister: found.minister || '' }));
      } else {
          searchParams = matrimonioSearch; setSearchError = setMatrimonioSearchError; setFound = setMatrimonioFound; setSearching = setMatrimonioSearching; getMethod = getMatrimonios;
          mapNewPartida = (found) => setMatrimonioNewPartida(prev => ({ ...prev, sacramentDate: found.sacramentDate || '', husbandName: found.husbandName || '', husbandSurname: found.husbandSurname || '', wifeName: found.wifeName || '', wifeSurname: found.wifeSurname || '', witnesses: found.witnesses || '', minister: found.minister || '' }));
      }

      if (!searchParams.book || !searchParams.page || !searchParams.entry) {
          setSearchError("Ingrese Libro, Folio y Número para buscar.");
          return;
      }
      
      setSearching(true); setSearchError(null); setFound(null);

      setTimeout(() => {
          const allRecords = getMethod(user?.parishId);
          const getNum = (val) => val == null || val === '' ? null : parseInt(String(val).replace(/\D/g, ''), 10);
          
          const found = allRecords.find(r => 
              getNum(r.book_number || r.libro) === getNum(searchParams.book) && 
              getNum(r.page_number || r.folio) === getNum(searchParams.page) && 
              getNum(r.entry_number || r.numero) === getNum(searchParams.entry)
          );

          if (found) {
              setFound(found);
              mapNewPartida(found);
              toast({ title: "Registro Encontrado", description: "Datos cargados en el formulario.", className: "bg-blue-50 text-blue-900" });
          } else {
              setSearchError("Partida no encontrada. Puede llenar los datos manualmente.");
          }
          setSearching(false);
      }, 500);
  };

  const handleSubmit = async (e, type) => {
      e.preventDefault();
      setIsSubmitting(true);
      const parishId = user.parishId;

      try {
          let decreeData, newPartidaData, originalFound, collectionKey, paramsKey;
          
          if (type === 'bautismo') {
              decreeData = bautismoDecree;
              newPartidaData = bautismoNewPartida;
              originalFound = bautismoFound;
              collectionKey = `baptisms_${parishId}`;
              paramsKey = `baptismParameters_${parishId}`;
          }

          if (!decreeData.numeroDecreto || !decreeData.conceptoAnulacionId) throw new Error("Complete los datos del decreto.");
          
          const allRecords = JSON.parse(localStorage.getItem(collectionKey) || '[]');
          let params = JSON.parse(localStorage.getItem(paramsKey) || '{}');
          if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };

          // 1. Mark Original as Replaced
          if (originalFound) {
              const idx = allRecords.findIndex(r => r.id === originalFound.id);
              if (idx !== -1) {
                  allRecords[idx] = { 
                      ...allRecords[idx], 
                      isAnnulled: true, 
                      status: 'anulada',
                      annulmentDecree: decreeData.numeroDecreto, 
                      annulmentDate: decreeData.fechaDecreto,
                      tipoNotaAlMargen: 'porReposicion.anulada',
                      updatedAt: new Date().toISOString()
                  };
              }
          }

          // 2. Create New Partida (Supletorio)
          const newId = generateUUID();
          
          // Mapeo especial para Bautismo (Registro Civil)
          const extraData = type === 'bautismo' ? {
              regciv: newPartidaData.serialRegCivil,
              nuip: newPartidaData.nuipNuit,
              notaria: newPartidaData.oficinaRegistro,
              fecregis: newPartidaData.fechaExpedicion
          } : {};

          const newRecord = {
              ...newPartidaData,
              ...extraData,
              id: newId,
              parishId,
              book_number: params.suplementarioLibro,
              page_number: params.suplementarioFolio,
              entry_number: params.suplementarioNumero,
              status: type === 'matrimonio' ? 'celebrated' : 'seated',
              isSupplementary: true,
              replacementDecreeRef: decreeData.numeroDecreto,
              conceptoAnulacionId: decreeData.conceptoAnulacionId,
              tipoNotaAlMargen: 'porReposicion.nuevaPartida',
              createdAt: new Date().toISOString()
          };
          
          allRecords.push(newRecord);
          localStorage.setItem(collectionKey, JSON.stringify(allRecords));
          
          // 3. Create Decree Record
          const decreePayload = {
              decreeNumber: decreeData.numeroDecreto,
              decreeDate: decreeData.fechaDecreto,
              sacrament: type,
              conceptoAnulacionId: decreeData.conceptoAnulacionId,
              notes: decreeData.observations,
              targetBaptismId: originalFound?.id || null, 
              newBaptismIdRepo: newId,
              originalPartidaSummary: originalFound ? { book: originalFound.book_number, page: originalFound.page_number, entry: originalFound.entry_number } : null,
              newPartidaSummary: { book: newRecord.book_number, page: newRecord.page_number, entry: newRecord.entry_number },
              datosNuevaPartida: newRecord, // Guardamos copia completa
              createdBy: user.username
          };

          const result = createDecreeReplacement(decreePayload, parishId);
          if (!result.success) throw new Error(result.message);

          // 4. Update Parameters
          localStorage.setItem(paramsKey, JSON.stringify({ ...params, suplementarioNumero: incrementPaddedValue(params.suplementarioNumero) }));

          setIsSuccess(true);
          toast({ title: "Reposición Exitosa", description: "Se ha registrado el decreto y creado la partida supletoria.", className: "bg-green-50 border-green-200 text-green-900" });

      } catch (error) {
          console.error(error);
          toast({ title: "Error", description: error.message || "Error al guardar.", variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isSuccess) {
      return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg text-center mt-12 border border-gray-200 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-700" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Decreto de Reposición Registrado</h2>
                <p className="text-gray-700 mb-8 font-medium">Se ha generado la nueva partida supletoria correctamente.</p>
                <div className="flex justify-center gap-4">
                    <Button onClick={() => navigate('/parroquia/decretos/reposicion')} variant="outline">Ver Lista</Button>
                    <Button onClick={() => window.location.reload()} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white font-bold">Nuevo Decreto</Button>
                </div>
            </div>
        </DashboardLayout>
      );
  }

  const renderDecreeSection = (decree, setDecree) => (
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm mb-6">
          <h3 className="font-bold text-blue-800 text-sm uppercase mb-4 border-b border-blue-300 pb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> 1. Datos del Decreto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número de Decreto <span className="text-red-500">*</span></label>
                  <Input name="numeroDecreto" value={decree.numeroDecreto} onChange={(e) => setDecree({ ...decree, numeroDecreto: e.target.value })} placeholder="Ej: 001-2026" className="bg-white"/>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha Decreto <span className="text-red-500">*</span></label>
                  <Input type="date" name="fechaDecreto" value={decree.fechaDecreto} onChange={(e) => setDecree({ ...decree, fechaDecreto: e.target.value })} className="bg-white"/>
              </div>
              <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Observaciones</label>
                  <Input name="observations" value={decree.observations} onChange={(e) => setDecree({ ...decree, observations: e.target.value })} className="bg-white" />
              </div>
          </div>
      </div>
  );

  const renderSearchSection = (search, setSearch, handleSearch, isSearching, error, found, type) => (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
          <h3 className="font-bold text-gray-700 text-sm uppercase mb-4 border-b border-gray-300 pb-2 flex items-center gap-2"><Search className="w-4 h-4"/> 2. Buscar Original (Opcional)</h3>
          <p className="text-xs text-gray-500 mb-4">Si la partida original existe (aunque esté dañada), búsquela para anularla automáticamente y precargar datos. Si está perdida totalmente, omita este paso y llene los datos manualmente.</p>
          <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
              {['book', 'page', 'entry'].map(field => (
                  <div key={field} className="flex-1 w-full">
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{field === 'book' ? 'Libro' : field === 'page' ? 'Folio' : 'Número'}</label>
                      <Input name={field} value={search[field]} onChange={(e) => setSearch({ ...search, [field]: e.target.value })} placeholder={field === 'book' ? 'Libro' : field === 'page' ? 'Folio' : 'Número'} />
                  </div>
              ))}
              <Button type="button" onClick={() => handleSearch(type)} disabled={isSearching} className="bg-[#4B7BA7] hover:bg-[#3B6B97] text-white w-full md:w-auto">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin"/> : "Buscar"}
              </Button>
          </div>
          {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
          {found && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-2 flex justify-between items-start">
                  <div className="text-sm">
                      <><div><span className="font-bold">Nombre:</span> {found.firstName} {found.lastName}</div>
                      <div><span className="font-bold">Fecha:</span> {found.sacramentDate}</div></>
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">Encontrada</div>
              </div>
          )}
      </div>
  );

  const renderConceptSection = (decree, setDecree) => (
      <div className="bg-purple-50 p-6 rounded-lg border border-purple-200 shadow-sm mb-6">
          <h3 className="font-bold text-purple-800 text-sm uppercase mb-4 border-b border-purple-300 pb-2 flex items-center gap-2"><Info className="w-4 h-4"/> 3. Concepto de Reposición</h3>
          <select name="conceptoAnulacionId" value={decree.conceptoAnulacionId} onChange={(e) => setDecree({ ...decree, conceptoAnulacionId: e.target.value })} className="w-full rounded-md border border-purple-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Seleccionar Concepto</option>
              {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
          </select>
      </div>
  );

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Nuevo Decreto de Reposición</h1>
            <p className="text-gray-600 font-medium text-sm">Registro de reposición por pérdida o deterioro (Partida Supletoria).</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger value="bautismo" className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmacion" className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm" disabled>Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonio" className="py-2 font-bold data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm" disabled>Matrimonios</TabsTrigger>
                </TabsList>

                <TabsContent value="bautismo">
                    <form onSubmit={(e) => handleSubmit(e, 'bautismo')} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {renderDecreeSection(bautismoDecree, setBautismoDecree)}
                        {renderSearchSection(bautismoSearch, setBautismoSearch, handleSearch, bautismoSearching, bautismoSearchError, bautismoFound, 'bautismo')}
                        {renderConceptSection(bautismoDecree, setBautismoDecree)}
                        
                        <div className="bg-green-50 p-6 rounded-lg border border-green-200 shadow-sm">
                            <h3 className="font-bold text-green-800 text-sm uppercase mb-4 border-b border-green-300 pb-2 flex items-center gap-2"><UserPlus className="w-4 h-4"/> 4. Datos de Nueva Partida (Supletorio)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Fecha Bautismo *</label><Input type="date" value={bautismoNewPartida.sacramentDate} onChange={e => setBautismoNewPartida({...bautismoNewPartida, sacramentDate: e.target.value})} className="bg-white" required/></div>
                                <div className="hidden md:block"></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Nombres *</label><Input value={bautismoNewPartida.firstName} onChange={e => setBautismoNewPartida({...bautismoNewPartida, firstName: e.target.value})} className="bg-white" required/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Apellidos *</label><Input value={bautismoNewPartida.lastName} onChange={e => setBautismoNewPartida({...bautismoNewPartida, lastName: e.target.value})} className="bg-white" required/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Fecha Nacimiento</label><Input type="date" value={bautismoNewPartida.birthDate} onChange={e => setBautismoNewPartida({...bautismoNewPartida, birthDate: e.target.value})} className="bg-white" /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Lugar Nacimiento</label><Input value={bautismoNewPartida.placeOfBirth} onChange={e => setBautismoNewPartida({...bautismoNewPartida, placeOfBirth: e.target.value})} className="bg-white" /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Padre</label><Input value={bautismoNewPartida.fatherName} onChange={e => setBautismoNewPartida({...bautismoNewPartida, fatherName: e.target.value})} className="bg-white" /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Madre</label><Input value={bautismoNewPartida.motherName} onChange={e => setBautismoNewPartida({...bautismoNewPartida, motherName: e.target.value})} className="bg-white" /></div>
                                
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase">Tipo de Unión</label>
                                    <select value={bautismoNewPartida.tipoUnionPadres} onChange={e => setBautismoNewPartida({...bautismoNewPartida, tipoUnionPadres: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
                                        <option value="1">Matrimonio Católico</option><option value="2">Matrimonio Civil</option><option value="3">Unión Libre</option><option value="4">Madre Soltera</option><option value="5">Otro</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase">Sexo</label>
                                    <select value={bautismoNewPartida.sex} onChange={e => setBautismoNewPartida({...bautismoNewPartida, sex: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
                                        <option value="1">Masculino</option><option value="2">Femenino</option>
                                    </select>
                                </div>

                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Abuelos Paternos</label><Input value={bautismoNewPartida.paternalGrandparents} onChange={e => setBautismoNewPartida({...bautismoNewPartida, paternalGrandparents: e.target.value})} className="bg-white" /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Abuelos Maternos</label><Input value={bautismoNewPartida.maternalGrandparents} onChange={e => setBautismoNewPartida({...bautismoNewPartida, maternalGrandparents: e.target.value})} className="bg-white" /></div>
                                <div className="md:col-span-2 space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Padrinos</label><Input value={bautismoNewPartida.godparents} onChange={e => setBautismoNewPartida({...bautismoNewPartida, godparents: e.target.value})} className="bg-white" /></div>
                                
                                {/* NUEVOS DATOS: REGISTRO CIVIL */}
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200 mt-2">
                                    <h4 className="md:col-span-4 text-xs font-bold text-blue-600 uppercase border-b pb-1">Datos Registro Civil</h4>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Serial Reg. Civil</label><Input value={bautismoNewPartida.serialRegCivil} onChange={e => setBautismoNewPartida({...bautismoNewPartida, serialRegCivil: e.target.value})} className="bg-gray-50" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">NUIP / NUIT</label><Input value={bautismoNewPartida.nuipNuit} onChange={e => setBautismoNewPartida({...bautismoNewPartida, nuipNuit: e.target.value})} className="bg-gray-50" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Oficina Registro</label><Input value={bautismoNewPartida.oficinaRegistro} onChange={e => setBautismoNewPartida({...bautismoNewPartida, oficinaRegistro: e.target.value})} className="bg-gray-50" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Fecha Expedición</label><Input type="date" value={bautismoNewPartida.fechaExpedicion} onChange={e => setBautismoNewPartida({...bautismoNewPartida, fechaExpedicion: e.target.value})} className="bg-gray-50" /></div>
                                </div>

                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Ministro</label><Input value={bautismoNewPartida.minister} onChange={e => setBautismoNewPartida({...bautismoNewPartida, minister: e.target.value})} className="bg-white" /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-700 uppercase">Da Fe</label><Input value={bautismoNewPartida.ministerFaith} onChange={e => setBautismoNewPartida({...bautismoNewPartida, ministerFaith: e.target.value})} className="bg-white" /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-200">
                             <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                             <Button type="submit" disabled={isSubmitting} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white font-bold"><Save className="w-4 h-4 mr-2" /> Guardar Decreto</Button>
                        </div>
                    </form>
                </TabsContent>
            </Tabs>
        </div>
    </DashboardLayout>
  );
};

export default DecreeReplacementNew;