import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Save, X, Printer, CheckCircle, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ConfirmationTicket from '@/components/ConfirmationTicket';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import { useActivePriestDisplay } from '@/hooks/useActivePriestDisplay';
import useParroquiaFromMisDatos from '@/hooks/useParroquiaFromMisDatos';

const ConfirmationNewPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, getConfirmationParameters } = useAppData();
  const navigate = useNavigate();
  const { toast } = useToast();
  const parishNameFromMisDatos = useParroquiaFromMisDatos();
  
  // States
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [ministers, setMinisters] = useState([]);
  
  // Ticket Printing States
  const [showTicket, setShowTicket] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [parishInfo, setParishInfo] = useState({ name: '', address: '', phone: '', city: '' });

  // Use hook to get active priest full name for Da Fe field
  const activePriestDisplay = useActivePriestDisplay(ministers);

  // Initial Form Data
  const initialFormData = {
    // Header
    numero: '', // Will be auto-filled or managed
    inscriptionDate: new Date().toISOString().split('T')[0],
    isDecreto: false,

    // Main Section
    sacramentDate: '', // datetime
    place: '',
    lastName: '',
    firstName: '',
    birthDate: '',
    age: '',
    sex: '',
    
    // Baptism Info
    baptismPlace: '',
    baptismBook: '',
    baptismFolio: '',
    baptismNumber: '',
    
    // Parents & Godparents
    fatherName: '',
    motherName: '',
    godparents: '',
    
    // Minister
    minister: '',
    ministerFaith: '',

    // Decree Section
    decretoDate: '',
    decretoNumber: '',
    decretoIssuer: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  // Auto-populate Parish Name from Hook
  useEffect(() => {
    if (parishNameFromMisDatos && !formData.place) {
        setFormData(prev => ({ ...prev, place: parishNameFromMisDatos }));
    }
  }, [parishNameFromMisDatos]);

  // Load Ministers for hook
  useEffect(() => {
     if (!user?.parishId) return;
     const key = `parrocos_${user.parishId}`;
     const stored = localStorage.getItem(key);
     if (stored) {
         try {
             setMinisters(JSON.parse(stored));
         } catch(e) {}
     }
  }, [user]);

  // Auto-populate ministerFaith when activePriestDisplay is available
  useEffect(() => {
     if (activePriestDisplay) {
         setFormData(prev => ({ ...prev, ministerFaith: activePriestDisplay }));
     }
  }, [activePriestDisplay]);

  // Load Parish Data & Parameters
  useEffect(() => {
      const loadData = async () => {
          if (!user?.parishId && !user?.dioceseId) return;

          const contextId = user.parishId || user.dioceseId;
          
          // 1. Load Parish Info for Ticket/Defaults
          const misDatos = getMisDatosList(contextId);
          let parishNameFound = null;
          let parishAddress = '';
          let parishPhone = '';
          let parishCity = '';

          if (Array.isArray(misDatos) && misDatos.length > 0) {
              const mainRecord = misDatos[0];
              if (mainRecord.nombre) parishNameFound = mainRecord.nombre;
              if (mainRecord.direccion) parishAddress = mainRecord.direccion;
              if (mainRecord.telefono) parishPhone = mainRecord.telefono;
              if (mainRecord.ciudad) parishCity = mainRecord.ciudad;
          }

          if (!parishNameFound) {
              parishNameFound = user.parishName || user.parish_name || '';
          }

          setParishInfo({
              name: parishNameFound,
              address: parishAddress,
              phone: parishPhone,
              city: parishCity
          });

          // 2. Load Parameters for Numbering
          const params = getConfirmationParameters(contextId);
          const nextNum = params?.ordinarioNumero || '1';

          setFormData(prev => ({ 
              ...prev, 
              numero: nextNum,
              // place is now handled by the hook useEffect above
          }));
      };
      
      loadData();
  }, [user, getMisDatosList, getConfirmationParameters]);

  // Calculate Age on BirthDate Change
  useEffect(() => {
      if (formData.birthDate) {
          const birth = new Date(formData.birthDate);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
              age--;
          }
          // Only update if age is valid number
          if (!isNaN(age)) {
             setFormData(prev => ({ ...prev, age: age.toString() }));
          }
      }
  }, [formData.birthDate]);

  const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const handleOpenSearchModal = () => {
      setIsSearchModalOpen(true);
  };

  const handleCloseSearchModal = () => {
      setIsSearchModalOpen(false);
  };

  const handleSelectBaptismPartida = (partida) => {
      // Normalize sex for dropdown (Uppercase for this form)
      let normalizedSex = '';
      if (partida.sex || partida.sexo) {
          const rawSex = String(partida.sex || partida.sexo).toUpperCase().trim();
          if (rawSex.startsWith('M') || rawSex === '1') normalizedSex = 'MASCULINO';
          else if (rawSex.startsWith('F') || rawSex === '2') normalizedSex = 'FEMENINO';
      }

      setFormData(prev => ({
          ...prev,
          // Personal Data
          firstName: partida.nombres || partida.firstName || prev.firstName,
          lastName: partida.apellidos || partida.lastName || prev.lastName,
          birthDate: partida.fechaNacimiento || partida.birthDate || prev.birthDate,
          sex: normalizedSex || prev.sex,
          
          // Parents
          fatherName: partida.nombrePadre || partida.fatherName || prev.fatherName,
          motherName: partida.nombreMadre || partida.motherName || prev.motherName,
          
          // Baptism Info
          baptismBook: partida.book_number || partida.libro || prev.baptismBook,
          baptismFolio: partida.page_number || partida.folio || prev.baptismFolio,
          baptismNumber: partida.entry_number || partida.numero || prev.baptismNumber,
          
          // Use place from record (formatted as CHURCH - CITY by modal), or fallback to current state
          baptismPlace: partida.lugarBautismo || prev.baptismPlace
      }));
      
      toast({
          title: "Datos Importados",
          description: `Se han cargado los datos de ${partida.nombres || partida.firstName || ''} ${partida.apellidos || partida.lastName || ''}.`,
          className: "bg-blue-50 border-blue-200 text-blue-900"
      });
      
      handleCloseSearchModal();
  };

  const validateForm = () => {
      const requiredFields = [
          { field: 'firstName', label: 'Nombre' },
          { field: 'lastName', label: 'Apellidos' },
          { field: 'sacramentDate', label: 'Fecha y Hora de Confirmación' },
          { field: 'minister', label: 'Ministro' }
      ];

      for (const req of requiredFields) {
          if (!formData[req.field]) {
              toast({
                  title: "Campo Requerido",
                  description: `Por favor complete: ${req.label}`,
                  variant: "destructive"
              });
              return false;
          }
      }

      if (formData.isDecreto) {
          if (!formData.decretoDate || !formData.decretoNumber || !formData.decretoIssuer) {
               toast({
                  title: "Datos de Decreto Incompletos",
                  description: "Al marcar 'Por Decreto', debe llenar todos los campos de la sección de decreto.",
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
        const storageKey = `pendingConfirmations_${entityId}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const newConfirmation = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            status: 'pending',
            type: 'confirmation',
            parishId: user?.parishId,
            dioceseId: user?.dioceseId,
            
            // Map flat form data to structure expected by other components if needed
            numero: formData.numero,
            inscriptionDate: formData.inscriptionDate,
            isDecreto: formData.isDecreto,
            
            firstName: formData.firstName,
            lastName: formData.lastName,
            sacramentDate: formData.sacramentDate, 
            birthDate: formData.birthDate,
            age: formData.age,
            sex: formData.sex,
            place: formData.place,
            
            baptismData: {
                place: formData.baptismPlace,
                book: formData.baptismBook,
                folio: formData.baptismFolio,
                number: formData.baptismNumber
            },

            minister: formData.minister,
            fatherName: formData.fatherName,
            motherName: formData.motherName,
            godparents: formData.godparents,
            
            // Add Da Fe
            ministerFaith: activePriestDisplay || formData.ministerFaith,

            decree: formData.isDecreto ? {
                date: formData.decretoDate,
                number: formData.decretoNumber,
                issuer: formData.decretoIssuer
            } : null,
            
            // For compatibility with Ticket component
            lugarNacimientoDetalle: '', 
            lugarConfirmacionDetalle: formData.place
        };

        // SAVE TO LOCAL STORAGE (Pending)
        const updated = [...existing, newConfirmation];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        
        await new Promise(resolve => setTimeout(resolve, 500));

        // TICKET & PRINT LOGIC
        setTicketData(newConfirmation);
        setShowTicket(true);
        setIsSuccess(true);
        
        toast({ 
            title: "Éxito - Confirmación guardada", 
            description: "Imprimiendo boleta...",
            className: "bg-green-50 border-green-200 text-green-900"
        });

        // Trigger Browser Print
        setTimeout(() => {
            window.print();
        }, 500);
        
    } catch (error) {
        console.error(error);
        toast({
            title: "Error inesperado",
            description: "Ocurrió un error al guardar.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isSuccess) {
      return (
          <>
            <div className="print:hidden">
                <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg text-center mt-12 border border-gray-200">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-700" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirmación Guardada</h2>
                        <p className="text-gray-700 mb-8 font-medium">
                            Se ha enviado la orden de impresión para la boleta.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button onClick={() => window.location.reload()} variant="outline" className="text-gray-900 border-gray-300">
                                Nuevo Registro
                            </Button>
                            <Button onClick={() => navigate('/parroquia/confirmacion/sentar-registros')} variant="secondary" className="text-gray-900 bg-gray-100 hover:bg-gray-200">
                                Ir a Sentar Registros
                            </Button>
                            <Button onClick={() => window.print()} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 font-bold">
                                <Printer className="w-4 h-4" /> Re-imprimir Boleta
                            </Button>
                        </div>
                    </div>
                </DashboardLayout>
            </div>

            <div className="hidden print:block">
                 {ticketData && <ConfirmationTicket confirmationData={ticketData} parishInfo={parishInfo} />}
            </div>
          </>
      );
  }

  return (
    <>
        <div className="print:hidden">
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 font-serif">Inscripción para Confirmación</h1>
                        <p className="text-gray-600 font-medium text-sm">Registro de datos para el sacramento.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto">
                        
                        {/* HEADER SECTION */}
                        <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-wrap items-center gap-6">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número</label>
                                <input 
                                    type="number" 
                                    name="numero"
                                    value={formData.numero}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white"
                                />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha</label>
                                <input 
                                    type="date" 
                                    name="inscriptionDate"
                                    value={formData.inscriptionDate}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white"
                                />
                            </div>
                            <div className="flex items-center pt-5">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        name="isDecreto"
                                        checked={formData.isDecreto}
                                        onChange={handleChange}
                                        className="w-5 h-5 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                                    />
                                    <span className="font-bold text-gray-700">Por Decreto</span>
                                </label>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            
                            {/* MAIN FORM */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha y Hora</label>
                                    <input 
                                        type="datetime-local" 
                                        name="sacramentDate" 
                                        value={formData.sacramentDate} 
                                        onChange={handleChange} 
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar Confirmación</label>
                                    <input 
                                        type="text" 
                                        name="place" 
                                        value={formData.place} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        name="lastName" 
                                        value={formData.lastName} 
                                        onChange={handleChange} 
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 uppercase font-semibold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        name="firstName" 
                                        value={formData.firstName} 
                                        onChange={handleChange} 
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 uppercase font-semibold" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha de Nacimiento</label>
                                    <input 
                                        type="date" 
                                        name="birthDate" 
                                        value={formData.birthDate} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Edad</label>
                                    <input 
                                        type="number" 
                                        name="age" 
                                        value={formData.age} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-gray-50" 
                                        readOnly
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sexo</label>
                                    <select 
                                        name="sex" 
                                        value={formData.sex} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 bg-white"
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="MASCULINO">Masculino</option>
                                        <option value="FEMENINO">Femenino</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-9">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Bautizo</label>
                                    <ChurchLocationAutocomplete 
                                        value={formData.baptismPlace} 
                                        onChange={(val) => setFormData({...formData, baptismPlace: val})} 
                                        placeholder="Buscar iglesia y ciudad..." 
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={handleOpenSearchModal}
                                        className="w-full border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50"
                                    >
                                        <Search className="w-4 h-4 mr-2" /> Buscar
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Bautizo Inscrito en Libro</label>
                                    <input 
                                        type="text" 
                                        name="baptismBook" 
                                        value={formData.baptismBook} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Folio</label>
                                    <input 
                                        type="text" 
                                        name="baptismFolio" 
                                        value={formData.baptismFolio} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número</label>
                                    <input 
                                        type="text" 
                                        name="baptismNumber" 
                                        value={formData.baptismNumber} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={handleOpenSearchModal}
                                        className="w-full border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50"
                                    >
                                        <Search className="w-4 h-4 mr-2" /> Buscar
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre del Padre</label>
                                    <input 
                                        type="text" 
                                        name="fatherName" 
                                        value={formData.fatherName} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre de la Madre</label>
                                    <input 
                                        type="text" 
                                        name="motherName" 
                                        value={formData.motherName} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Padrino / Madrina</label>
                                <input 
                                    type="text" 
                                    name="godparents" 
                                    value={formData.godparents} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                />
                            </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase">Ministro <span className="text-red-500">*</span></label>
                                        <span className="text-xs text-gray-400">Ninguno</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        name="minister" 
                                        value={formData.minister} 
                                        onChange={handleChange} 
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase">Da Fe (Párroco)</label>
                                    </div>
                                    <Input 
                                        name="ministerFaith" 
                                        value={formData.ministerFaith} 
                                        onChange={handleChange} 
                                    />
                                </div>
                            </div>

                            {/* DECREE SECTION - ANIMATED */}
                            <AnimatePresence>
                                {formData.isDecreto && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-4">
                                            <p className="text-sm text-yellow-800 font-medium mb-4 italic">
                                                Para el caso de una Inscripción por Decreto de Reposición, suministre los siguientes datos del Decreto Expedido:
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Fecha</label>
                                                    <input 
                                                        type="date" 
                                                        name="decretoDate" 
                                                        value={formData.decretoDate} 
                                                        onChange={handleChange} 
                                                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900 bg-white" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Decreto No.</label>
                                                    <input 
                                                        type="text" 
                                                        name="decretoNumber" 
                                                        value={formData.decretoNumber} 
                                                        onChange={handleChange} 
                                                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900 bg-white" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Expedido por</label>
                                                    <input 
                                                        type="text" 
                                                        name="decretoIssuer" 
                                                        value={formData.decretoIssuer} 
                                                        onChange={handleChange} 
                                                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900 bg-white" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* TOOLBAR */}
                            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-4">
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
                                    className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 px-8 py-2.5 shadow-lg shadow-yellow-500/20 transition-transform active:scale-95 font-bold"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" /> 
                                    )}
                                    {isSubmitting ? 'Guardando...' : 'Guardar y Generar Boleta'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </motion.div>
                
                {/* Search Modal */}
                <SearchBaptismPartidaModal 
                    isOpen={isSearchModalOpen}
                    onClose={handleCloseSearchModal}
                    onSelectPartida={handleSelectBaptismPartida}
                />
                
            </DashboardLayout>
            </div>

            {/* --- HIDDEN TICKET CONTAINER (Visible only in print) --- */}
            <div className="hidden print:block">
                 {ticketData && <ConfirmationTicket confirmationData={ticketData} parishInfo={parishInfo} />}
            </div>
        </>
  );
};

export default ConfirmationNewPage;