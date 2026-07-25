import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Save, X, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const MatrimonioCelebratedPage = () => {
    const { user } = useAuth();
    const { 
        saveMatrimonioToSource, 
        validateMatrimonioNumbers,
        getMatrimonios
    } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentRegIndex, setCurrentRegIndex] = useState(0);
    const [totalRegs, setTotalRegs] = useState(1);
    
    // Ministers State
    const [ministersList, setMinistersList] = useState([]);
    
    // Initial Form State
    const initialFormData = {
        // Row 1
        libro: '',
        folio: '',
        numero: '',
        expediente: '',
        fechaMatrimonio: new Date().toISOString().split('T')[0],
        
        // Row 2
        lugarCelebracion: '',
        
        // Esposo
        esposoApellidos: '',
        esposoNombres: '',
        esposoPadres: '',
        esposoFechaNac: '',
        esposoLugarNac: '',
        esposoLugarBautismo: '',
        esposoFechaBautismo: '',
        esposoLibro: '',
        esposoFolio: '',
        esposoNumero: '',
        
        // Esposa
        esposaApellidos: '',
        esposaNombres: '',
        esposaPadres: '',
        esposaFechaNac: '',
        esposaLugarNac: '',
        esposaLugarBautismo: '',
        esposaFechaBautismo: '',
        esposaLibro: '',
        esposaFolio: '',
        esposaNumero: '',
        
        // Adicionales
        testigo: '',
        presencia: '',
        daFeId: '', // Changed from daFe to daFeId for select mapping
        daFeNombre: ''
    };

    const [formData, setFormData] = useState(initialFormData);

    // Load Initial Data
    useEffect(() => {
        if (!user?.parishId && !user?.dioceseId) return;

        const loadData = async () => {
            const contextId = user.parishId || user.dioceseId;

            // 1. Set Parish Name as default Place
            let parishName = user.parishName || "Parroquia Desconocida";
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
            setFormData(prev => ({ ...prev, lugarCelebracion: parishName }));

            // 2. Load Ministers for 'Da Fe' dropdown
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
            const formattedMinisters = foundMinisters.map((p, idx) => ({
                id: p.id || idx + 1,
                name: `${p.nombre || ''} ${p.apellido || ''}`.trim(),
                status: String(p.estado || p.status || 0),
                code: String(idx + 1).padStart(4, '0') // "0001", "0002"...
            })).filter(m => m.status === '1' || m.status === 'active' || m.status === 'Activo'); // ONLY ACTIVE PRIESTS
            
            setMinistersList(formattedMinisters);

            // Set active priest default
            if (formattedMinisters.length > 0) {
                const active = formattedMinisters[formattedMinisters.length - 1];
                setFormData(prev => ({ 
                    ...prev, 
                    daFeId: active.id,
                    daFeNombre: active.name 
                }));
            }

            // 3. Get Total Count for Indicator
            const existingMatrimonios = getMatrimonios(contextId);
            setTotalRegs(existingMatrimonios.length + 1);
            setCurrentRegIndex(existingMatrimonios.length + 1);
        };

        loadData();
    }, [user, getMatrimonios]);

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
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSearchPerson = (type) => {
        toast({
            title: "Búsqueda de Personas",
            description: `La búsqueda de ${type} en la base de datos central estará disponible próximamente.`,
        });
    };

    const validateForm = async () => {
        const required = [
            { field: 'libro', label: 'Libro' },
            { field: 'folio', label: 'Folio' },
            { field: 'numero', label: 'Número' },
            { field: 'fechaMatrimonio', label: 'Fecha de Matrimonio' },
            { field: 'esposoNombres', label: 'Nombre del Esposo' },
            { field: 'esposoApellidos', label: 'Apellidos del Esposo' },
            { field: 'esposaNombres', label: 'Nombre de la Esposa' },
            { field: 'esposaApellidos', label: 'Apellidos de la Esposa' },
            { field: 'presencia', label: 'Presencia (Ministro)' }
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
        const check = await validateMatrimonioNumbers(formData.libro, formData.folio, formData.numero, user.parishId || user.dioceseId);
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
            
            const newRecord = {
                // Core
                book_number: formData.libro,
                page_number: formData.folio,
                entry_number: formData.numero,
                sacramentDate: formData.fechaMatrimonio,
                place: formData.lugarCelebracion,
                
                // Groom
                groomName: formData.esposoNombres,
                groomSurname: formData.esposoApellidos,
                groomParents: [{ name: formData.esposoPadres, role: 'parents' }], // Simplified for this view
                groomBirthDate: formData.esposoFechaNac,
                groomBirthPlace: formData.esposoLugarNac,
                
                // Bride
                brideName: formData.esposaNombres,
                brideSurname: formData.esposaApellidos,
                brideParents: [{ name: formData.esposaPadres, role: 'parents' }], // Simplified for this view
                brideBirthDate: formData.esposaFechaNac,
                brideBirthPlace: formData.esposaLugarNac,

                // Ministers & Witnesses
                minister: formData.presencia,
                witnesses: [{ name: formData.testigo, role: 'testigo' }],
                
                // Metadata specific to this form view
                metadata: {
                    expediente: formData.expediente,
                    esposo: {
                        lugarBautismo: formData.esposoLugarBautismo,
                        fechaBautismo: formData.esposoFechaBautismo,
                        bautismoLibro: formData.esposoLibro,
                        bautismoFolio: formData.esposoFolio,
                        bautismoNumero: formData.esposoNumero
                    },
                    esposa: {
                        lugarBautismo: formData.esposaLugarBautismo,
                        fechaBautismo: formData.esposaFechaBautismo,
                        bautismoLibro: formData.esposaLibro,
                        bautismoFolio: formData.esposaFolio,
                        bautismoNumero: formData.esposaNumero
                    },
                    daFeId: formData.daFeId,
                    daFeNombre: formData.daFeNombre
                }
            };

            const result = await saveMatrimonioToSource(newRecord, contextId, 'celebrated');
            
            if (result.success) {
                toast({
                    title: "Registro Guardado",
                    description: `Matrimonio de ${formData.esposoApellidos} y ${formData.esposaApellidos} guardado.`,
                    className: "bg-green-50 border-green-200 text-green-900"
                });
                
                // Reset form for next entry but keep logical fields
                setFormData(prev => ({
                    ...initialFormData,
                    lugarCelebracion: prev.lugarCelebracion,
                    fechaMatrimonio: prev.fechaMatrimonio,
                    libro: prev.libro,
                    folio: prev.folio,
                    numero: (parseInt(prev.numero || 0) + 1).toString(),
                    presencia: prev.presencia,
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
                className="max-w-6xl mx-auto"
            >
                {/* Header */}
                <div className="bg-[#4B7BA7] text-white p-4 rounded-t-xl shadow-lg flex justify-between items-center">
                    <h1 className="text-xl font-bold font-serif tracking-wide">Actualizar Libros de Matrimonio</h1>
                    <div className="flex gap-2">
                        <div className="bg-[#3a5f8a] px-3 py-1 rounded text-sm font-mono font-medium" title="Número de Libro">NL: {formData.libro || '0'}</div>
                        <div className="bg-[#3a5f8a] px-3 py-1 rounded text-sm font-mono font-medium" title="Número de Vuelta">NV: {formData.folio || '0'}</div>
                    </div>
                </div>

                {/* Form Container */}
                <form onSubmit={handleSubmit} className="bg-white border-x border-b border-gray-200 shadow-xl rounded-b-xl p-6 md:p-8 space-y-6">
                    
                    {/* SECTION 1: Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Libro</label>
                            <input type="number" name="libro" value={formData.libro} onChange={handleChange} className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Folio</label>
                            <input type="number" name="folio" value={formData.folio} onChange={handleChange} className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número</label>
                            <input type="number" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expediente No.</label>
                            <input type="text" name="expediente" value={formData.expediente} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha Matrimonio</label>
                            <input type="date" name="fechaMatrimonio" value={formData.fechaMatrimonio} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none" />
                        </div>
                    </div>

                    {/* SECTION 2: Lugar */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Celebración</label>
                        <input type="text" name="lugarCelebracion" value={formData.lugarCelebracion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase" />
                    </div>

                    <hr className="border-gray-100 my-4" />

                    {/* SECTION 3: ESPOSO */}
                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-blue-900 text-sm uppercase">Datos del Esposo</h3>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700" onClick={() => handleSearchPerson('esposo')}>
                                <Search className="w-3 h-3" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos</label>
                                <input type="text" name="esposoApellidos" value={formData.esposoApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none uppercase font-semibold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombres</label>
                                <input type="text" name="esposoNombres" value={formData.esposoNombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none uppercase font-semibold" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre de los Padres</label>
                            <input type="text" name="esposoPadres" value={formData.esposoPadres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none uppercase" placeholder="Padre y Madre" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha Nacimiento</label>
                                <input type="date" name="esposoFechaNac" value={formData.esposoFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar Nacimiento</label>
                                <input type="text" name="esposoLugarNac" value={formData.esposoLugarNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none uppercase" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Bautismo</label>
                            <input type="text" name="esposoLugarBautismo" value={formData.esposoLugarBautismo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300 outline-none uppercase" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Fec. Bautismo</label>
                                <input type="date" name="esposoFechaBautismo" value={formData.esposoFechaBautismo} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Libro</label>
                                <input type="text" name="esposoLibro" value={formData.esposoLibro} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Folio</label>
                                <input type="text" name="esposoFolio" value={formData.esposoFolio} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Número</label>
                                <input type="text" name="esposoNumero" value={formData.esposoNumero} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: ESPOSA */}
                    <div className="bg-pink-50/50 p-4 rounded-lg border border-pink-100">
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-pink-900 text-sm uppercase">Datos de la Esposa</h3>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-700" onClick={() => handleSearchPerson('esposa')}>
                                <Search className="w-3 h-3" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellidos</label>
                                <input type="text" name="esposaApellidos" value={formData.esposaApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none uppercase font-semibold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombres</label>
                                <input type="text" name="esposaNombres" value={formData.esposaNombres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none uppercase font-semibold" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre de los Padres</label>
                            <input type="text" name="esposaPadres" value={formData.esposaPadres} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none uppercase" placeholder="Padre y Madre" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha Nacimiento</label>
                                <input type="date" name="esposaFechaNac" value={formData.esposaFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar Nacimiento</label>
                                <input type="text" name="esposaLugarNac" value={formData.esposaLugarNac} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none uppercase" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lugar de Bautismo</label>
                            <input type="text" name="esposaLugarBautismo" value={formData.esposaLugarBautismo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-300 outline-none uppercase" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Fec. Bautismo</label>
                                <input type="date" name="esposaFechaBautismo" value={formData.esposaFechaBautismo} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Libro</label>
                                <input type="text" name="esposaLibro" value={formData.esposaLibro} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Folio</label>
                                <input type="text" name="esposaFolio" value={formData.esposaFolio} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Número</label>
                                <input type="text" name="esposaNumero" value={formData.esposaNumero} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100 my-4" />

                    {/* SECTION 5: ADICIONALES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Testigo</label>
                            <input type="text" name="testigo" value={formData.testigo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Presencia</label>
                            <input type="text" name="presencia" value={formData.presencia} onChange={handleChange} placeholder="Nombre del Sacerdote" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4B7BA7] outline-none uppercase" />
                        </div>
                    </div>
                    
                    {/* Da Fe Block - Full Width */}
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

                    {/* ACTION BUTTONS */}
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
                                {isSubmitting ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </DashboardLayout>
    );
};

export default MatrimonioCelebratedPage;