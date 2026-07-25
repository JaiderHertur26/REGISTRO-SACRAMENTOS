import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Save, X, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';

const ConfirmationCelebratedPage = () => {
    const { user } = useAuth();
    const { 
        saveConfirmationToSource, 
        validateConfirmationNumbers,
        getConfirmations
    } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentRegIndex, setCurrentRegIndex] = useState(0);
    const [totalRegs, setTotalRegs] = useState(1); // Default to 1 for new entry
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    
    // Ministers State
    const [ministersList, setMinistersList] = useState([]);
    const [activePriest, setActivePriest] = useState({ id: '', name: '' });

    // Initial Form State
    const initialFormData = {
        // Row 1
        libro: '',
        folio: '',
        numero: '',
        fechaConfirmacion: new Date().toISOString().split('T')[0],
        
        // Row 2
        lugar: '',
        
        // Row 3
        apellidos: '',
        fechaNacimiento: '',
        
        // Row 4
        nombres: '',
        edad: '',
        sexo: '', // M or F
        
        // Row 5
        lugarBautismo: '',
        libroBautismo: '',
        folioBautismo: '',
        numeroBautismo: '',
        
        // Row 6-9
        nombrePadre: '',
        nombreMadre: '',
        padrinoMadrina: '',
        ministro: '',
        
        // Row 10
        daFeId: '', // ID or Code
        daFeNombre: ''
    };

    const [formData, setFormData] = useState(initialFormData);

    // Load Initial Data (Parish Info, Ministers, Existing Count)
    useEffect(() => {
        if (!user?.parishId && !user?.dioceseId) return;

        const loadData = async () => {
            const contextId = user.parishId || user.dioceseId;

            // 1. Set Parish Name as default Place
            let parishName = user.parishName || user.parish_name || "Parroquia Desconocida";
            
            // Try to find more detailed parish info from 'misDatos' if available
            try {
                const misDatosStr = localStorage.getItem(`misDatos_${contextId}`);
                if (misDatosStr) {
                    const misDatos = JSON.parse(misDatosStr);
                    if (misDatos.length > 0 && misDatos[0].nombre) {
                        parishName = misDatos[0].nombre;
                    }
                }
            } catch (e) {
                console.warn("Error loading misDatos", e);
            }

            setFormData(prev => ({ ...prev, lugar: parishName }));

            // 2. Load Ministers for 'Da Fe' dropdown
            // Looking for priests/parrocos
            let foundMinisters = [];
            const priestKeys = [`parrocos_${contextId}`, 'parrocos'];
            
            for (const key of priestKeys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '[]');
                    if (data.length > 0) {
                        foundMinisters = data;
                        break;
                    }
                } catch (e) {}
            }
            
            // Sort by date ASC (Oldest first) to calculate sequential Code
            foundMinisters.sort((a, b) => 
                new Date(a.fechaIngreso || a.fechaNombramiento || '1900-01-01') - 
                new Date(b.fechaIngreso || b.fechaNombramiento || '1900-01-01')
            );

            // Transform for dropdown: Calculate Code and Filter Active
            // UPDATED: Filter to show only ACTIVE and prepare labels
            const formattedMinisters = foundMinisters.map((p, idx) => ({
                id: p.id || idx + 1,
                name: `${p.nombre || ''} ${p.apellido || ''}`.trim(),
                status: String(p.estado || p.status || 0),
                code: String(idx + 1).padStart(4, '0') // "0001", "0002"...
            })).filter(m => m.status === '1' || m.status === 'active' || m.status === 'Activo'); // ONLY ACTIVE PRIESTS
            
            setMinistersList(formattedMinisters);

            // Set active priest default (Use the most recent active one if multiple, or the only one)
            if (formattedMinisters.length > 0) {
                // If sorted by oldest first, the last one is the most recently added/appointed
                const active = formattedMinisters[formattedMinisters.length - 1];
                setActivePriest(active);
                setFormData(prev => ({ 
                    ...prev, 
                    daFeId: active.id,
                    daFeNombre: active.name 
                }));
            }

            // 3. Get Total Count for Indicator
            const existingConfirmations = getConfirmations(contextId);
            setTotalRegs(existingConfirmations.length + 1); // +1 for the current new one being added
            setCurrentRegIndex(existingConfirmations.length + 1);
        };

        loadData();
    }, [user, getConfirmations]);

    // Age Calculation Effect
    useEffect(() => {
        if (formData.fechaNacimiento && formData.fechaConfirmacion) {
            const birth = new Date(formData.fechaNacimiento);
            const conf = new Date(formData.fechaConfirmacion);
            
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) {
                    age--;
                }
                setFormData(prev => ({ ...prev, edad: age >= 0 ? age.toString() : '' }));
            }
        }
    }, [formData.fechaNacimiento, formData.fechaConfirmacion]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Special handling for 'Da Fe' dropdown
        if (name === 'daFeId') {
            const selectedMinister = ministersList.find(m => String(m.id) === String(value));
            setFormData(prev => ({
                ...prev,
                daFeId: value,
                daFeNombre: selectedMinister ? selectedMinister.name : ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleOpenSearchModal = () => {
        setIsSearchModalOpen(true);
    };

    const handleCloseSearchModal = () => {
        setIsSearchModalOpen(false);
    };

    const handleSelectBaptismPartida = (partida) => {
        // Normalize sex to "Masculino" or "Femenino" for the select input
        let normalizedSex = '';
        if (partida.sex || partida.sexo) {
            const rawSex = (partida.sex || partida.sexo).toUpperCase();
            if (rawSex.startsWith('M')) normalizedSex = 'Masculino';
            else if (rawSex.startsWith('F')) normalizedSex = 'Femenino';
        }

        setFormData(prev => ({
            ...prev,
            // Personal Data
            nombres: partida.nombres || partida.firstName || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || prev.fechaNacimiento,
            sexo: normalizedSex || prev.sexo, // Updated to load sex/sexo
            
            // Parents
            nombrePadre: partida.nombrePadre || partida.fatherName || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || prev.nombreMadre,
            
            // Baptism Location Info
            lugarBautismo: partida.lugarBautismo || prev.lugarBautismo,
            libroBautismo: partida.book_number || partida.libro || prev.libroBautismo,
            folioBautismo: partida.page_number || partida.folio || prev.folioBautismo,
            numeroBautismo: partida.entry_number || partida.numero || prev.numeroBautismo
        }));
        
        toast({
            title: "Datos Importados",
            description: `Se han cargado los datos de ${partida.nombres} ${partida.apellidos}.`,
            className: "bg-blue-50 border-blue-200 text-blue-900"
        });
        
        handleCloseSearchModal();
    };

    const validateForm = async () => {
        const required = [
            { field: 'libro', label: 'Libro' },
            { field: 'folio', label: 'Folio' },
            { field: 'numero', label: 'Número' },
            { field: 'fechaConfirmacion', label: 'Fecha de Confirmación' },
            { field: 'nombres', label: 'Nombres' },
            { field: 'apellidos', label: 'Apellidos' },
            { field: 'ministro', label: 'Ministro' }
        ];

        for (const req of required) {
            if (!formData[req.field]) {
                toast({
                    title: "Campo Requerido",
                    description: `El campo '${req.label}' es obligatorio.`,
                    variant: "destructive"
                });
                return false;
            }
        }

        // Validate Number Duplication
        const check = await validateConfirmationNumbers(formData.libro, formData.folio, formData.numero, user.parishId || user.dioceseId);
        if (!check.valid) {
             toast({
                title: "Numeración Duplicada",
                description: `Ya existe un registro con Libro ${formData.libro}, Folio ${formData.folio}, Número ${formData.numero}.`,
                variant: "destructive"
            });
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!await validateForm()) return;

        setIsSubmitting(true);
        try {
            const contextId = user.parishId || user.dioceseId;
            
            // Prepare Data Object matching standard structure but flat mapping from this form
            const newRecord = {
                // Numbering
                book_number: formData.libro,
                page_number: formData.folio,
                entry_number: formData.numero,
                
                // Dates & Place
                sacramentDate: formData.fechaConfirmacion,
                place: formData.lugar,
                sacramentPlace: formData.lugar,
                
                // Person
                firstName: formData.nombres,
                lastName: formData.apellidos,
                birthDate: formData.fechaNacimiento,
                sex: formData.sexo, // Saved as 'sex' (standard)
                sexo: formData.sexo, // Saved as 'sexo' (requested persistence fix)
                
                // VITAL: Ensure Baptism Place is saved in standardized fields
                birthPlace: formData.lugarBautismo, // Legacy mapping
                baptismPlace: formData.lugarBautismo, // Explicit root field
                
                // Baptism details (Book, Folio, Number)
                baptismBook: formData.libroBautismo,
                baptismPage: formData.folioBautismo,
                baptismNumber: formData.numeroBautismo,
                
                baptismData: {
                    place: formData.lugarBautismo,
                    book: formData.libroBautismo,
                    folio: formData.folioBautismo,
                    number: formData.numeroBautismo
                },
                
                // Parents & Godparents
                fatherName: formData.nombrePadre,
                motherName: formData.nombreMadre,
                godparents: formData.padrinoMadrina,
                
                // Ministers
                minister: formData.ministro,
                ministerFaith: formData.daFeNombre,
                
                // Metadata specific to this form view
                metadata: {
                    ageAtConfirmation: formData.edad,
                    daFeId: formData.daFeId,
                    daFeNombre: formData.daFeNombre,
                    lugarBautismo: formData.lugarBautismo // Explicitly store here too
                }
            };

            const result = await saveConfirmationToSource(newRecord, contextId, 'celebrated');
            
            if (result.success) {
                toast({
                    title: "Registro Guardado",
                    description: `Confirmación de ${formData.nombres} ${formData.apellidos} guardada correctamente.`,
                    className: "bg-green-50 border-green-200 text-green-900"
                });
                
                // Reset form but keep some context like place and dates if useful, or full reset
                // Keeping place and dates usually helps in batch entry
                setFormData(prev => ({
                    ...initialFormData,
                    lugar: prev.lugar,
                    fechaConfirmacion: prev.fechaConfirmacion,
                    libro: prev.libro,
                    folio: prev.folio,
                    // Increment number automatically
                    numero: (parseInt(prev.numero || 0) + 1).toString(),
                    ministro: prev.ministro,
                    daFeId: prev.daFeId,
                    daFeNombre: prev.daFeNombre
                }));
                
                setTotalRegs(prev => prev + 1);
                setCurrentRegIndex(prev => prev + 1);

            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "No se pudo guardar el registro.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-5xl mx-auto"
            >
                {/* Header */}
                <div className="bg-[#4B7BA7] text-white p-4 rounded-t-xl shadow-lg flex justify-between items-center">
                    <h1 className="text-xl font-bold font-serif tracking-wide">Actualizar Libros de Confirmación</h1>
                    <div className="bg-[#3a5f8a] px-3 py-1 rounded text-sm font-mono font-medium">
                        Reg {currentRegIndex} de {totalRegs > currentRegIndex ? totalRegs : currentRegIndex}
                    </div>
                </div>

                {/* Form Container */}
                <form onSubmit={handleSubmit} className="bg-white border-x border-b border-gray-200 shadow-xl rounded-b-xl p-6 md:p-8 space-y-6">
                    
                    {/* ROW 1: Numbering & Date */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Libro</label>
                            <input 
                                type="number" 
                                name="libro" 
                                value={formData.libro} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] focus:border-transparent outline-none transition-all text-center font-mono font-bold text-lg"
                                maxLength={4}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Folio</label>
                            <input 
                                type="number" 
                                name="folio" 
                                value={formData.folio} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] focus:border-transparent outline-none transition-all text-center font-mono font-bold text-lg"
                                maxLength={4}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número</label>
                            <input 
                                type="number" 
                                name="numero" 
                                value={formData.numero} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] focus:border-transparent outline-none transition-all text-center font-mono font-bold text-lg"
                                maxLength={4}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha de Confirmación</label>
                            <input 
                                type="date" 
                                name="fechaConfirmacion" 
                                value={formData.fechaConfirmacion} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none"
                            />
                        </div>
                    </div>

                    {/* ROW 2: Lugar */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar</label>
                        <input 
                            type="text" 
                            name="lugar" 
                            value={formData.lugar} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                        />
                    </div>

                    {/* ROW 3: Apellidos & Nacimiento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos</label>
                            <input 
                                type="text" 
                                name="apellidos" 
                                value={formData.apellidos} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase font-bold text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha de Nacimiento</label>
                            <input 
                                type="date" 
                                name="fechaNacimiento" 
                                value={formData.fechaNacimiento} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none"
                            />
                        </div>
                    </div>

                    {/* ROW 4: Nombres, Edad, Sexo */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-6">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombres</label>
                            <input 
                                type="text" 
                                name="nombres" 
                                value={formData.nombres} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase font-bold text-gray-800"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Edad</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    name="edad" 
                                    value={formData.edad} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none pr-12"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-gray-400 pointer-events-none">AÑOS</span>
                            </div>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sexo</label>
                            <select 
                                name="sexo" 
                                value={formData.sexo} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none bg-white"
                            >
                                <option value="">Seleccione...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                            </select>
                        </div>
                    </div>

                    {/* ROW 5: Lugar de Bautismo - IMPROVED SECTION */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-9">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Bautismo</label>
                                <ChurchLocationAutocomplete 
                                    value={formData.lugarBautismo} 
                                    onChange={(val) => setFormData(prev => ({...prev, lugarBautismo: val}))}
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
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">BAUTIZO INSCRITO EN LIBRO</label>
                                <input 
                                    type="text" 
                                    name="libroBautismo" 
                                    value={formData.libroBautismo} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">FOLIO</label>
                                <input 
                                    type="text" 
                                    name="folioBautismo" 
                                    value={formData.folioBautismo} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">NÚMERO</label>
                                <input 
                                    type="text" 
                                    name="numeroBautismo" 
                                    value={formData.numeroBautismo} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
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
                    </div>

                    {/* ROW 6: Nombre del Padre */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre del Padre</label>
                        <input 
                            type="text" 
                            name="nombrePadre" 
                            value={formData.nombrePadre} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                        />
                    </div>

                    {/* ROW 7: Nombre de la Madre */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre de la Madre</label>
                        <input 
                            type="text" 
                            name="nombreMadre" 
                            value={formData.nombreMadre} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                        />
                    </div>

                    {/* ROW 8: Padrino / Madrina */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Padrino / Madrina</label>
                        <input 
                            type="text" 
                            name="padrinoMadrina" 
                            value={formData.padrinoMadrina} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                        />
                    </div>

                    {/* ROW 9: Ministro */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ministro</label>
                        <input 
                            type="text" 
                            name="ministro" 
                            value={formData.ministro} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase"
                        />
                    </div>

                    {/* ROW 10: Da Fe */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Da Fe (Código)</label>
                            <select 
                                name="daFeId" 
                                value={formData.daFeId} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none bg-white font-mono"
                            >
                                <option value="">---</option>
                                {/* UPDATED: Display only the code in the select option */}
                                {ministersList.map(m => (
                                    <option key={m.id} value={m.id}>{m.code}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre del Párroco</label>
                            <input 
                                type="text" 
                                name="daFeNombre" 
                                value={formData.daFeNombre} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase bg-white"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => navigate(-1)} 
                            className="text-gray-600 border-gray-300 hover:bg-gray-50 gap-2"
                        >
                            <X className="w-4 h-4" /> Cancelar
                        </Button>

                        <div className="flex gap-3">
                             {/* Navigation Placeholders - can be implemented for editing mode later */}
                             <div className="hidden md:flex gap-2 mr-4">
                                <Button type="button" variant="ghost" size="icon" disabled>
                                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" disabled>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </Button>
                             </div>

                            <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="bg-[#4B7BA7] hover:bg-[#3a5f8a] text-white px-8 font-bold shadow-md transition-all active:scale-95"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
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
    );
};

export default ConfirmationCelebratedPage;