import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Search, User, Users, ClipboardList, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import CityAutocomplete from '@/components/CityAutocomplete';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import useParroquiaFromMisDatos from '@/hooks/useParroquiaFromMisDatos';

const MatrimonioNewPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, getCiudadesList, getConfirmations } = useAppData();
  const navigate = useNavigate();
  const { toast } = useToast();
  const parishNameFromMisDatos = useParroquiaFromMisDatos();
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("novio");
  const [cities, setCities] = useState([]);
  
  // Search Modal States
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null); // 'novio' or 'novia'
  
  // Initial Form Data
  const initialFormData = {
    // Header
    numero: '00000001',
    fechaExpediente: new Date().toISOString().split('T')[0], // 06/02/2026
    porDecreto: false,

    // Upper Section
    fechaHoraPrevista: '',
    presenciaria: '',
    lugarCeremonia: '',

    // Novio
    novioApellidos: '',
    novioNombres: '',
    novioPadre: '',
    novioMadre: '',
    novioFechaNac: '',
    novioLugarNac: '',
    novioOcupacion: '',
    novioEmpresa: '',
    novioDireccion: '',
    novioTelefonos: '',
    novioCiudad: 'BARRANQUILLA, ATLANTICO - COLOMBIA',
    novioCedula: '',
    novioExpedida: '',
    
    // Novio Sacraments
    novioBautizado: false,
    novioBautismoLugar: '',
    novioBautismoLibro: '',
    novioBautismoFolio: '',
    novioBautismoNumero: '',
    novioBautismoFecha: '',
    novioConfirmado: false,
    novioConfirmacionLugar: '',
    novioPrimeraComunion: false,
    novioPrimeraComunionLugar: '',

    // Novia
    noviaApellidos: '',
    noviaNombres: '',
    noviaPadre: '',
    noviaMadre: '',
    noviaFechaNac: '',
    noviaLugarNac: '',
    noviaOcupacion: '',
    noviaEmpresa: '',
    noviaDireccion: '',
    noviaTelefonos: '',
    noviaCiudad: '',
    noviaCedula: '',
    noviaExpedida: '',

    // Novia Sacraments
    noviaBautizado: false,
    noviaBautismoLugar: '',
    noviaBautismoLibro: '',
    noviaBautismoFolio: '',
    noviaBautismoNumero: '',
    noviaBautismoFecha: '',
    noviaConfirmado: false,
    noviaConfirmacionLugar: '',
    noviaPrimeraComunion: false,
    noviaPrimeraComunionLugar: '',

    // Testigos (Assuming 2 for standard form)
    testigo1Nombres: '',
    testigo1Cedula: '',
    testigo1Expedida: '',
    testigo2Nombres: '',
    testigo2Cedula: '',
    testigo2Expedida: '',

    // Decree Section
    decretoFecha: '',
    decretoNumero: '',
    decretoExpedido: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  // Auto-populate Parish Name from Hook
  useEffect(() => {
    if (parishNameFromMisDatos && !formData.lugarCeremonia) {
        setFormData(prev => ({ ...prev, lugarCeremonia: parishNameFromMisDatos }));
    }
  }, [parishNameFromMisDatos]);

  // Load Defaults
  useEffect(() => {
      if (user?.username) {
          setFormData(prev => ({
              ...prev,
              presenciaria: user.username
          }));
      }
  }, [user]);

  useEffect(() => {
      if (user?.parishId || user?.dioceseId) {
          const list = getCiudadesList(user.parishId || user.dioceseId);
          setCities(list);
      }
  }, [user, getCiudadesList]);

  const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const validateForm = () => {
      const required = [
          { field: 'novioNombres', label: 'Nombres del Novio' },
          { field: 'novioApellidos', label: 'Apellidos del Novio' },
          { field: 'noviaNombres', label: 'Nombres de la Novia' },
          { field: 'noviaApellidos', label: 'Apellidos de la Novia' },
          { field: 'fechaHoraPrevista', label: 'Fecha y Hora Prevista' }
      ];

      for (const req of required) {
          if (!formData[req.field]) {
              toast({
                  title: "Campo Requerido",
                  description: `Por favor complete: ${req.label}`,
                  variant: "destructive"
              });
              return false;
          }
      }
      return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
        const entityId = user.parishId || user.dioceseId;
        const storageKey = `pendingMatrimonios_${entityId}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const newExpediente = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            status: 'pending_expediente',
            type: 'marriage_expediente',
            parishId: user?.parishId,
            ...formData
        };

        localStorage.setItem(storageKey, JSON.stringify([...existing, newExpediente]));
        
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate api call

        toast({
            title: "Expediente Guardado",
            description: "El expediente matrimonial ha sido registrado exitosamente.",
            className: "bg-green-50 border-green-200 text-green-900"
        });
        
        // Optional: Reset or Redirect
        // navigate('/parroquia/matrimonios'); 
        
    } catch (error) {
        console.error(error);
        toast({
            title: "Error",
            description: "No se pudo guardar el expediente.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEntrevista = (type) => {
      toast({
          title: "Funcionalidad en Desarrollo",
          description: `El módulo de entrevista para ${type} estará disponible pronto.`,
          variant: "default"
      });
  };

  // Search Logic
  const handleOpenSearch = (target) => {
      setSearchTarget(target);
      setIsSearchModalOpen(true);
  };

  const handleCloseSearch = () => {
      setIsSearchModalOpen(false);
      setSearchTarget(null);
  };

  const handleSelectBaptismPartidaNovio = (partida) => {
      const entityId = user.parishId || user.dioceseId;
      const confirmations = getConfirmations(entityId);
      
      const partidaName = `${partida.nombres || partida.firstName || ''} ${partida.apellidos || partida.lastName || ''}`.trim().toLowerCase();
      
      const foundConfirmation = confirmations.find(c => {
          const cName = `${c.nombres || c.firstName || ''} ${c.apellidos || c.lastName || ''}`.trim().toLowerCase();
          return cName === partidaName;
      });

      setFormData(prev => ({
          ...prev,
          novioNombres: partida.nombres || partida.firstName || prev.novioNombres,
          novioApellidos: partida.apellidos || partida.lastName || prev.novioApellidos,
          novioPadre: partida.nombrePadre || partida.fatherName || prev.novioPadre,
          novioMadre: partida.nombreMadre || partida.motherName || prev.novioMadre,
          novioFechaNac: partida.fechaNacimiento || partida.birthDate || prev.novioFechaNac,
          novioLugarNac: partida.lugarNacimiento || partida.birthPlace || prev.novioLugarNac,
          
          novioBautizado: true,
          novioBautismoLugar: partida.lugarBautismo || partida.place || prev.novioBautismoLugar,
          novioBautismoLibro: partida.book_number || partida.libro || prev.novioBautismoLibro,
          novioBautismoFolio: partida.page_number || partida.folio || prev.novioBautismoFolio,
          novioBautismoNumero: partida.entry_number || partida.numero || prev.novioBautismoNumero,
          novioBautismoFecha: partida.sacramentDate || prev.novioBautismoFecha,

          novioConfirmado: !!foundConfirmation,
          novioConfirmacionLugar: foundConfirmation ? (foundConfirmation.place || foundConfirmation.lugar || user.parishName) : prev.novioConfirmacionLugar
      }));

      toast({
          title: "Datos del Novio Importados",
          description: `Se han cargado los datos de bautismo.${foundConfirmation ? ' También se encontró registro de confirmación.' : ''}`,
          className: "bg-blue-50 border-blue-200 text-blue-900"
      });
  };

  const handleSelectBaptismPartidaNovia = (partida) => {
      const entityId = user.parishId || user.dioceseId;
      const confirmations = getConfirmations(entityId);
      
      const partidaName = `${partida.nombres || partida.firstName || ''} ${partida.apellidos || partida.lastName || ''}`.trim().toLowerCase();
      
      const foundConfirmation = confirmations.find(c => {
          const cName = `${c.nombres || c.firstName || ''} ${c.apellidos || c.lastName || ''}`.trim().toLowerCase();
          return cName === partidaName;
      });

      setFormData(prev => ({
          ...prev,
          noviaNombres: partida.nombres || partida.firstName || prev.noviaNombres,
          noviaApellidos: partida.apellidos || partida.lastName || prev.noviaApellidos,
          noviaPadre: partida.nombrePadre || partida.fatherName || prev.noviaPadre,
          noviaMadre: partida.nombreMadre || partida.motherName || prev.noviaMadre,
          noviaFechaNac: partida.fechaNacimiento || partida.birthDate || prev.noviaFechaNac,
          noviaLugarNac: partida.lugarNacimiento || partida.birthPlace || prev.noviaLugarNac,
          
          noviaBautizado: true,
          noviaBautismoLugar: partida.lugarBautismo || partida.place || prev.noviaBautismoLugar,
          noviaBautismoLibro: partida.book_number || partida.libro || prev.noviaBautismoLibro,
          noviaBautismoFolio: partida.page_number || partida.folio || prev.noviaBautismoFolio,
          noviaBautismoNumero: partida.entry_number || partida.numero || prev.noviaBautismoNumero,
          noviaBautismoFecha: partida.sacramentDate || prev.noviaBautismoFecha,

          noviaConfirmado: !!foundConfirmation,
          noviaConfirmacionLugar: foundConfirmation ? (foundConfirmation.place || foundConfirmation.lugar || user.parishName) : prev.noviaConfirmacionLugar
      }));

      toast({
          title: "Datos de la Novia Importados",
          description: `Se han cargado los datos de bautismo.${foundConfirmation ? ' También se encontró registro de confirmación.' : ''}`,
          className: "bg-pink-50 border-pink-200 text-pink-900"
      });
  };

  const handleSelectPartida = (partida) => {
      if (searchTarget === 'novio') {
          handleSelectBaptismPartidaNovio(partida);
      } else if (searchTarget === 'novia') {
          handleSelectBaptismPartidaNovia(partida);
      }
      handleCloseSearch();
  };

  // Reusable Sacrament Section Component
  const SacramentSection = ({ prefix, label }) => (
      <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="font-bold text-gray-700 text-sm uppercase mb-3 border-b border-gray-300 pb-2">Sacramentos - {label}</h4>
          
          {/* Bautismo */}
          <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                  <input 
                      type="checkbox" 
                      name={`${prefix}Bautizado`} 
                      checked={formData[`${prefix}Bautizado`]} 
                      onChange={handleChange}
                      className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]"
                  />
                  <label className="font-bold text-gray-700 text-sm">Bautizado</label>
              </div>
              
              {formData[`${prefix}Bautizado`] && (
                  <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 pl-6"
                  >
                      <div className="md:col-span-4">
                          <label className="text-xs font-semibold text-gray-600 block">Lugar / Parroquia</label>
                          <input type="text" name={`${prefix}BautismoLugar`} value={formData[`${prefix}BautismoLugar`]} onChange={handleChange} className="w-full h-8 px-2 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600 block">Libro</label>
                          <input type="text" name={`${prefix}BautismoLibro`} value={formData[`${prefix}BautismoLibro`]} onChange={handleChange} className="w-full h-8 px-2 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600 block">Folio</label>
                          <input type="text" name={`${prefix}BautismoFolio`} value={formData[`${prefix}BautismoFolio`]} onChange={handleChange} className="w-full h-8 px-2 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600 block">Número</label>
                          <input type="text" name={`${prefix}BautismoNumero`} value={formData[`${prefix}BautismoNumero`]} onChange={handleChange} className="w-full h-8 px-2 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600 block">Fecha</label>
                          <input type="date" name={`${prefix}BautismoFecha`} value={formData[`${prefix}BautismoFecha`]} onChange={handleChange} className="w-full h-8 px-2 border border-gray-300 rounded text-sm" />
                      </div>
                  </motion.div>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Confirmacion */}
              <div>
                  <div className="flex items-center gap-2 mb-2">
                      <input 
                          type="checkbox" 
                          name={`${prefix}Confirmado`} 
                          checked={formData[`${prefix}Confirmado`]} 
                          onChange={handleChange}
                          className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]"
                      />
                      <label className="font-bold text-gray-700 text-sm">Confirmado</label>
                  </div>
                  {formData[`${prefix}Confirmado`] && (
                       <input 
                          type="text" 
                          placeholder="Lugar de Confirmación"
                          name={`${prefix}ConfirmacionLugar`} 
                          value={formData[`${prefix}ConfirmacionLugar`]} 
                          onChange={handleChange} 
                          className="w-full h-8 px-2 border border-gray-300 rounded text-sm ml-6" 
                      />
                  )}
              </div>

              {/* Primera Comunion */}
              <div>
                  <div className="flex items-center gap-2 mb-2">
                      <input 
                          type="checkbox" 
                          name={`${prefix}PrimeraComunion`} 
                          checked={formData[`${prefix}PrimeraComunion`]} 
                          onChange={handleChange}
                          className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]"
                      />
                      <label className="font-bold text-gray-700 text-sm">1a. Comunión</label>
                  </div>
                  {formData[`${prefix}PrimeraComunion`] && (
                       <input 
                          type="text" 
                          placeholder="Lugar de 1a. Comunión"
                          name={`${prefix}PrimeraComunionLugar`} 
                          value={formData[`${prefix}PrimeraComunionLugar`]} 
                          onChange={handleChange} 
                          className="w-full h-8 px-2 border border-gray-300 rounded text-sm ml-6" 
                      />
                  )}
              </div>
          </div>
      </div>
  );

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-serif">Expediente Matrimonial</h1>
                    <p className="text-gray-600 font-medium text-sm">Registro de datos previos al sacramento.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden max-w-6xl mx-auto">
                
                {/* HEADER SECTION */}
                <div className="bg-gray-50 border-b border-gray-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número</label>
                            <input 
                                type="text" 
                                name="numero"
                                value={formData.numero}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 font-mono font-bold"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha</label>
                            <input 
                                type="date" 
                                name="fechaExpediente"
                                value={formData.fechaExpediente}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900"
                            />
                        </div>
                        <div className="md:col-span-3 flex pb-2">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    name="porDecreto"
                                    checked={formData.porDecreto}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                                />
                                <span className="font-bold text-gray-700">Por Decreto</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    
                    {/* UPPER SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha y Hora Prevista</label>
                            <input 
                                type="datetime-local" 
                                name="fechaHoraPrevista" 
                                value={formData.fechaHoraPrevista} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Presenciaria</label>
                            <input 
                                type="text" 
                                name="presenciaria" 
                                value={formData.presenciaria} 
                                onChange={handleChange} 
                                placeholder="JAIDER HERRERA TURIZO"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white uppercase" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Ceremonia</label>
                            <input 
                                type="text" 
                                name="lugarCeremonia" 
                                value={formData.lugarCeremonia} 
                                onChange={handleChange} 
                                placeholder="PARROQUIA..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white uppercase" 
                            />
                        </div>
                    </div>

                    {/* TABS SECTION */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1 bg-gray-100 rounded-lg">
                            <TabsTrigger value="novio" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 font-bold flex gap-2">
                                <User className="w-4 h-4" /> Datos del Novio
                            </TabsTrigger>
                            <TabsTrigger value="novia" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-pink-700 font-bold flex gap-2">
                                <User className="w-4 h-4" /> Datos de la Novia
                            </TabsTrigger>
                            <TabsTrigger value="testigos" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-purple-700 font-bold flex gap-2">
                                <Users className="w-4 h-4" /> Datos de los Testigos
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: NOVIO */}
                        <TabsContent value="novio" className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                             <div className="flex justify-end mb-2">
                                <Button 
                                    type="button" 
                                    onClick={() => handleOpenSearch('novio')}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200"
                                    size="sm"
                                >
                                    <Search className="w-4 h-4 mr-2" /> Cargar datos de Bautismo
                                </Button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos</label>
                                    <input type="text" name="novioApellidos" value={formData.novioApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombres</label>
                                    <input type="text" name="novioNombres" value={formData.novioNombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            {/* ...Rest of Novio inputs... (Kept as is but truncated in thought for brevity, full file in output) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Padre</label>
                                    <input type="text" name="novioPadre" value={formData.novioPadre} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Madre</label>
                                    <input type="text" name="novioMadre" value={formData.novioMadre} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fec. Nac.</label>
                                    <input type="date" name="novioFechaNac" value={formData.novioFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar Nac.</label>
                                    <input type="text" name="novioLugarNac" value={formData.novioLugarNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ocupación</label>
                                    <input type="text" name="novioOcupacion" value={formData.novioOcupacion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Empresa</label>
                                    <input type="text" name="novioEmpresa" value={formData.novioEmpresa} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Dirección</label>
                                    <input type="text" name="novioDireccion" value={formData.novioDireccion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Teléfonos</label>
                                    <input type="text" name="novioTelefonos" value={formData.novioTelefonos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ciudad</label>
                                    <CityAutocomplete
                                        name="novioCiudad"
                                        value={formData.novioCiudad}
                                        onChange={handleChange}
                                        cities={cities}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase"
                                    />
                                </div>
                                 <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cédula</label>
                                    <input type="text" name="novioCedula" value={formData.novioCedula} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expedida</label>
                                    <input type="text" name="novioExpedida" value={formData.novioExpedida} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>

                            <SacramentSection prefix="novio" label="Novio" />

                        </TabsContent>

                        {/* TAB 2: NOVIA */}
                        <TabsContent value="novia" className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex justify-end mb-2">
                                <Button 
                                    type="button" 
                                    onClick={() => handleOpenSearch('novia')}
                                    className="bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-200"
                                    size="sm"
                                >
                                    <Search className="w-4 h-4 mr-2" /> Cargar datos de Bautismo
                                </Button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos</label>
                                    <input type="text" name="noviaApellidos" value={formData.noviaApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombres</label>
                                    <input type="text" name="noviaNombres" value={formData.noviaNombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                            </div>
                            {/* ...Rest of Novia inputs... */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Padre</label>
                                    <input type="text" name="noviaPadre" value={formData.noviaPadre} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Madre</label>
                                    <input type="text" name="noviaMadre" value={formData.noviaMadre} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fec. Nac.</label>
                                    <input type="date" name="noviaFechaNac" value={formData.noviaFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar Nac.</label>
                                    <input type="text" name="noviaLugarNac" value={formData.noviaLugarNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ocupación</label>
                                    <input type="text" name="noviaOcupacion" value={formData.noviaOcupacion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Empresa</label>
                                    <input type="text" name="noviaEmpresa" value={formData.noviaEmpresa} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Dirección</label>
                                    <input type="text" name="noviaDireccion" value={formData.noviaDireccion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Teléfonos</label>
                                    <input type="text" name="noviaTelefonos" value={formData.noviaTelefonos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ciudad</label>
                                    <input type="text" name="noviaCiudad" value={formData.noviaCiudad} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cédula</label>
                                    <input type="text" name="noviaCedula" value={formData.noviaCedula} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expedida</label>
                                    <input type="text" name="noviaExpedida" value={formData.noviaExpedida} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-200 outline-none uppercase" />
                                </div>
                            </div>

                            <SacramentSection prefix="novia" label="Novia" />

                        </TabsContent>

                         {/* TAB 3: TESTIGOS */}
                         <TabsContent value="testigos" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                             {/* Testigo 1 */}
                             <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <h4 className="font-bold text-purple-800 text-sm mb-3">Testigo 1</h4>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre Completo</label>
                                        <input type="text" name="testigo1Nombres" value={formData.testigo1Nombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none uppercase" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cédula</label>
                                        <input type="text" name="testigo1Cedula" value={formData.testigo1Cedula} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expedida</label>
                                        <input type="text" name="testigo1Expedida" value={formData.testigo1Expedida} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none uppercase" />
                                    </div>
                                </div>
                             </div>

                             {/* Testigo 2 */}
                             <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <h4 className="font-bold text-purple-800 text-sm mb-3">Testigo 2</h4>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre Completo</label>
                                        <input type="text" name="testigo2Nombres" value={formData.testigo2Nombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none uppercase" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cédula</label>
                                        <input type="text" name="testigo2Cedula" value={formData.testigo2Cedula} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expedida</label>
                                        <input type="text" name="testigo2Expedida" value={formData.testigo2Expedida} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-200 outline-none uppercase" />
                                    </div>
                                </div>
                             </div>
                        </TabsContent>
                    </Tabs>

                    {/* DECREE SECTION */}
                    <AnimatePresence>
                        {formData.porDecreto && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                    <p className="text-sm text-yellow-800 font-medium mb-4 italic">
                                        Para el caso de una Inscripción por Decreto de Reposición, suministre los siguientes datos del Decreto Expedido:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Fecha de Decreto</label>
                                            <input type="date" name="decretoFecha" value={formData.decretoFecha} onChange={handleChange} className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Número</label>
                                            <input type="text" name="decretoNumero" value={formData.decretoNumero} onChange={handleChange} className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Expedido</label>
                                            <input type="text" name="decretoExpedido" value={formData.decretoExpedido} onChange={handleChange} className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none bg-white" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ACTION BUTTONS & TOOLBAR */}
                    <div className="pt-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-4 w-full md:w-auto">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => handleEntrevista("Novios")}
                                className="border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50 flex gap-2 w-full md:w-auto"
                            >
                                <ClipboardList className="w-4 h-4" /> Entrevista Novios
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => handleEntrevista("Testigos")}
                                className="border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50 flex gap-2 w-full md:w-auto"
                            >
                                <ClipboardList className="w-4 h-4" /> Entrevista Testigos
                            </Button>
                        </div>

                        <div className="flex gap-4 w-full md:w-auto justify-end">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => navigate(-1)} 
                                disabled={isSubmitting}
                                className="gap-2 text-gray-900 border-gray-300 hover:bg-gray-100"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 px-8 py-2.5 shadow-lg shadow-yellow-500/20 transition-transform active:scale-95 font-bold w-full md:w-auto"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" /> 
                                )}
                                {isSubmitting ? 'Guardando...' : 'Guardar Expediente'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={handleSelectPartida}
                onSelectPartida={handleSelectPartida}
            />
        </motion.div>
    </DashboardLayout>
  );
};

export default MatrimonioNewPage;