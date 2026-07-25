import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Save, RefreshCw, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const ParroquiaParametrosPage = () => {
    const { user } = useAuth();
    const { 
        getBaptismParameters, 
        saveBaptismParameters, 
        getDefaultBaptismParameters, 
        getDefaultMatrimonyParameters,
        getDefaultConfirmationParameters,
        getDefaultExequiasParameters,
        getDefaultFirstCommunionParameters
    } = useAppData();
    const { toast } = useToast();

    // Tab State
    const [activeTab, setActiveTab] = useState('bautizos');

    // Form Data States
    const [baptismData, setBaptismData] = useState(null);
    const [matrimonyData, setMatrimonyData] = useState(null);
    const [confirmationData, setConfirmationData] = useState(null);
    const [exequiasData, setExequiasData] = useState(null);
    const [firstCommunionData, setFirstCommunionData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load initial data
        const load = () => {
            // Safety check: ensure context functions are available
            if (!getDefaultBaptismParameters) {
                console.warn("Context functions not ready yet");
                return;
            }

            const currentBaptismParams = getBaptismParameters();
            const defaultBaptismParams = getDefaultBaptismParameters();

            // Merge to ensure structure integrity even if LS has partial data
            const mergedBaptismData = {
                ...defaultBaptismParams,
                ...currentBaptismParams,
                general: { ...defaultBaptismParams.general, ...(currentBaptismParams?.general || {}) },
                libroOrdinario: { ...defaultBaptismParams.libroOrdinario, ...(currentBaptismParams?.libroOrdinario || {}) },
                libroSuplemento: { ...defaultBaptismParams.libroSuplemento, ...(currentBaptismParams?.libroSuplemento || {}) },
                inscripcion: { ...defaultBaptismParams.inscripcion, ...(currentBaptismParams?.inscripcion || {}) }
            };

            setBaptismData(mergedBaptismData);
            
            // For other tabs, we load from LS or defaults if not present
            setMatrimonyData(JSON.parse(localStorage.getItem('matrimonyParameters')) || getDefaultMatrimonyParameters());
            setConfirmationData(JSON.parse(localStorage.getItem('confirmationParameters')) || getDefaultConfirmationParameters());
            setExequiasData(JSON.parse(localStorage.getItem('exequiasParameters')) || getDefaultExequiasParameters());
            setFirstCommunionData(JSON.parse(localStorage.getItem('firstCommunionParameters')) || getDefaultFirstCommunionParameters());
            setLoading(false);
        };
        load();
    }, [getBaptismParameters, getDefaultBaptismParameters, getDefaultMatrimonyParameters, getDefaultConfirmationParameters, getDefaultExequiasParameters, getDefaultFirstCommunionParameters]);

    /* --- HELPERS --- */
    const handleDeepChange = (setter, section, field, value) => {
        setter(prev => {
            // Safety check for section existence
            const currentSection = prev[section] || {};
            return {
                ...prev,
                [section]: {
                    ...currentSection,
                    [field]: value
                }
            };
        });
    };

    const handleRootChange = (setter, field, value) => {
        setter(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const validateForm = (data) => {
        let isValid = true;
        const errors = [];

        if (!data) return { isValid: false, errors: ["Datos no inicializados"] };

        // Recursive validation for number fields
        const validateNumbers = (obj, path = '') => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    validateNumbers(obj[key], path ? `${path}.${key}` : key);
                } else if (typeof obj[key] === 'number' || (typeof obj[key] === 'string' && !isNaN(obj[key]) && key !== 'fecha')) {
                    const val = Number(obj[key]);
                    if (val < 0) {
                        isValid = false;
                        errors.push(`El campo ${path ? `${path}.` : ''}${key} no puede ser negativo.`);
                    }
                    if (key === 'partidasPorFolio' && val <= 0) {
                        isValid = false;
                        errors.push(`Partidas por folio debe ser mayor a 0.`);
                    }
                }
            }
        };

        validateNumbers(data);

        // Date validation for baptism
        if (data.inscripcion && data.inscripcion.fecha) {
            if (isNaN(new Date(data.inscripcion.fecha).getTime())) {
                isValid = false;
                errors.push("Fecha de inscripción inválida.");
            }
        }

        return { isValid, errors };
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        let currentData;
        let saveFunction;

        switch (activeTab) {
            case 'bautizos':
                currentData = baptismData;
                saveFunction = saveBaptismParameters;
                break;
            case 'matrimonios':
                currentData = matrimonyData;
                saveFunction = (d) => { localStorage.setItem('matrimonyParameters', JSON.stringify(d)); return { success: true }; };
                break;
            case 'confirmaciones':
                currentData = confirmationData;
                saveFunction = (d) => { localStorage.setItem('confirmationParameters', JSON.stringify(d)); return { success: true }; };
                break;
            case 'exequias':
                currentData = exequiasData;
                saveFunction = (d) => { localStorage.setItem('exequiasParameters', JSON.stringify(d)); return { success: true }; };
                break;
            case 'comuniones':
                currentData = firstCommunionData;
                saveFunction = (d) => { localStorage.setItem('firstCommunionParameters', JSON.stringify(d)); return { success: true }; };
                break;
            default: return;
        }

        const validation = validateForm(currentData);
        if (!validation.isValid) {
            toast({
                title: "Error de Validación",
                description: validation.errors[0], // Show first error
                variant: "destructive"
            });
            return;
        }

        const result = await saveFunction(currentData);
        if (result.success) {
            toast({
                title: "Parámetros Guardados",
                description: "La configuración ha sido actualizada exitosamente.",
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-900"
            });
        }
    };

    /* --- COMPONENTS --- */
    const TabButton = ({ id, label }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap",
                activeTab === id 
                    ? "border-[#D4AF37] text-[#D4AF37] bg-yellow-50/50" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
        >
            {label}
        </button>
    );

    const NumberInput = ({ label, value, onChange, min = 0, helperText }) => (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input 
                type="number" 
                min={min}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4B7BA7] outline-none transition-shadow"
                value={value || ''}
                onChange={onChange}
            />
            {helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
            {Number(value) < 0 && <span className="text-xs text-red-500 block mt-1">No puede ser negativo</span>}
        </div>
    );

    const SectionCard = ({ title, children, className }) => (
        <div className={cn("bg-white border border-gray-200 rounded-lg p-6 shadow-sm", className)}>
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[#D4AF37] rounded-full"></div>
                {title}
            </h3>
            {children}
        </div>
    );

    /* --- TABS CONTENT RENDERERS --- */
    
    // Generic render for similar structures (Matrimony, Confirmation, etc.)
    const renderGenericTab = (data, setter, title) => {
        if (!data) return <div>Cargando...</div>;
        return (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SectionCard title={`Opciones Generales de ${title}`}>
                    <div className="flex flex-col gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={data.general?.activarVistaPrevia || false} 
                                onChange={(e) => handleDeepChange(setter, 'general', 'activarVistaPrevia', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Activar Vista Previa al imprimir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={data.general?.reportarImpresion || false} 
                                onChange={(e) => handleDeepChange(setter, 'general', 'reportarImpresion', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Reportar Impresión de Partidas</span>
                        </label>
                    </div>
                </SectionCard>

                <SectionCard title="Libro Ordinario">
                    <div className="mb-4">
                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input 
                                type="checkbox" 
                                checked={data.libroOrdinario?.bloquear || false}
                                onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'bloquear', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm font-semibold text-gray-700">Bloquear Libro Ordinario</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <NumberInput 
                            label="Partidas por Folio" 
                            value={data.libroOrdinario?.partidasPorFolio}
                            onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'partidasPorFolio', e.target.value)}
                        />
                        <NumberInput 
                            label="Libro Actual" 
                            value={data.libroOrdinario?.libro}
                            onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'libro', e.target.value)}
                        />
                         <NumberInput 
                            label="Folio Actual" 
                            value={data.libroOrdinario?.folio}
                            onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'folio', e.target.value)}
                        />
                        <NumberInput 
                            label="Número Actual" 
                            value={data.libroOrdinario?.numero}
                            onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'numero', e.target.value)}
                        />
                    </div>
                     <div className="mt-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={data.libroOrdinario?.reiniciarNumeroEnFolio || false}
                                onChange={(e) => handleDeepChange(setter, 'libroOrdinario', 'reiniciarNumeroEnFolio', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Número inicia en 1 en cada Folio</span>
                        </label>
                    </div>
                </SectionCard>
            </div>
        );
    };

    const renderBautizosTab = () => {
        if (!baptismData) return <div>Cargando...</div>;

        // Safe access to nested properties
        const general = baptismData.general || {};
        const libroOrdinario = baptismData.libroOrdinario || {};
        const libroSuplemento = baptismData.libroSuplemento || {};
        const inscripcion = baptismData.inscripcion || {};

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* SECCIÓN 1 - OPCIONES GENERALES */}
                <SectionCard title="Opciones Generales">
                    <div className="flex flex-col gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={general.activarVistaPrevia || false} 
                                onChange={(e) => handleDeepChange(setBaptismData, 'general', 'activarVistaPrevia', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Activar Vista Previa al imprimir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={general.reportarImpresion || false} 
                                onChange={(e) => handleDeepChange(setBaptismData, 'general', 'reportarImpresion', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Reportar Impresión de Partidas</span>
                        </label>
                    </div>
                </SectionCard>

                {/* SECCIÓN 2 - LIBRO ORDINARIO */}
                <SectionCard title="Libro Ordinario">
                    <div className="mb-4">
                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input 
                                type="checkbox" 
                                checked={libroOrdinario.bloquear || false}
                                onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'bloquear', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm font-semibold text-gray-700">Bloquear</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <NumberInput 
                            label="Partidas por Folio" 
                            value={libroOrdinario.partidasPorFolio}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'partidasPorFolio', e.target.value)}
                        />
                        <NumberInput 
                            label="Libro" 
                            value={libroOrdinario.libro}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'libro', e.target.value)}
                        />
                         <NumberInput 
                            label="Folio" 
                            value={libroOrdinario.folio}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'folio', e.target.value)}
                        />
                        <NumberInput 
                            label="Número" 
                            value={libroOrdinario.numero}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'numero', e.target.value)}
                        />
                    </div>
                     <div className="mt-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={libroOrdinario.reiniciarNumeroEnFolio || false}
                                onChange={(e) => handleDeepChange(setBaptismData, 'libroOrdinario', 'reiniciarNumeroEnFolio', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Número inicia en 1 en cada Folio</span>
                        </label>
                    </div>
                </SectionCard>

                {/* SECCIÓN 3 - LIBRO SUPLEMENTARIO */}
                <SectionCard title="Libro Suplementario">
                    <div className="mb-4 flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={libroSuplemento.bloquear || false}
                                onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'bloquear', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm font-semibold text-gray-700">Bloquear</span>
                        </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={libroSuplemento.reiniciarNumeroEnFolio || false}
                                onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'reiniciarNumeroEnFolio', e.target.checked)}
                                className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-sm text-gray-700">Reiniciar Número desde 1 en cada folio</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <NumberInput 
                            label="Partidas por Folio" 
                            value={libroSuplemento.partidasPorFolio}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'partidasPorFolio', e.target.value)}
                        />
                        <NumberInput 
                            label="Libro" 
                            value={libroSuplemento.libro}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'libro', e.target.value)}
                        />
                         <NumberInput 
                            label="Folio" 
                            value={libroSuplemento.folio}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'folio', e.target.value)}
                        />
                        <NumberInput 
                            label="Número" 
                            value={libroSuplemento.numero}
                            onChange={(e) => handleDeepChange(setBaptismData, 'libroSuplemento', 'numero', e.target.value)}
                        />
                    </div>
                </SectionCard>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SECCIÓN 4 - REGISTROS DE ADULTO */}
                    <SectionCard title="Registros de Adulto">
                         <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="registrosAdulto"
                                    value="ordinario"
                                    checked={baptismData.registrosAdulto === 'ordinario'}
                                    onChange={(e) => handleRootChange(setBaptismData, 'registrosAdulto', e.target.value)}
                                    className="w-4 h-4 text-[#4B7BA7] border-gray-300 focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-sm text-gray-700">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="registrosAdulto"
                                    value="suplementario"
                                    checked={baptismData.registrosAdulto === 'suplementario'}
                                    onChange={(e) => handleRootChange(setBaptismData, 'registrosAdulto', e.target.value)}
                                    className="w-4 h-4 text-[#4B7BA7] border-gray-300 focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-sm text-gray-700">Libro Suplementario</span>
                            </label>
                        </div>
                    </SectionCard>

                    {/* SECCIÓN 5 - INSCRIPCIÓN POR DECRETO */}
                    <SectionCard title="Inscripción por Decreto">
                         <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="inscripcionDecreto"
                                    value="ordinario"
                                    checked={baptismData.inscripcionDecreto === 'ordinario'}
                                    onChange={(e) => handleRootChange(setBaptismData, 'inscripcionDecreto', e.target.value)}
                                    className="w-4 h-4 text-[#4B7BA7] border-gray-300 focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-sm text-gray-700">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="inscripcionDecreto"
                                    value="suplementario"
                                    checked={baptismData.inscripcionDecreto === 'suplementario'}
                                    onChange={(e) => handleRootChange(setBaptismData, 'inscripcionDecreto', e.target.value)}
                                    className="w-4 h-4 text-[#4B7BA7] border-gray-300 focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-sm text-gray-700">Libro Suplementario</span>
                            </label>
                        </div>
                    </SectionCard>
                 </div>

                {/* SECCIÓN 6 - NOTA MARGINAL */}
                 <SectionCard title="Nota Marginal">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={baptismData.generarNotaMarginal || false}
                            onChange={(e) => handleRootChange(setBaptismData, 'generarNotaMarginal', e.target.checked)}
                            className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]" 
                        />
                        <span className="text-sm text-gray-700">Generar nota marginal de Registro Civil al imprimir el libro</span>
                    </label>
                </SectionCard>

                 {/* SECCIÓN 7 - INSCRIPCIÓN */}
                 <SectionCard title="Inscripción">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <NumberInput 
                            label="Inscripción" 
                            value={inscripcion.numero}
                            onChange={(e) => handleDeepChange(setBaptismData, 'inscripcion', 'numero', e.target.value)}
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                            <input 
                                type="datetime-local" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4B7BA7] outline-none"
                                value={inscripcion.fecha || ''}
                                onChange={(e) => handleDeepChange(setBaptismData, 'inscripcion', 'fecha', e.target.value)}
                            />
                        </div>
                         <NumberInput 
                            label="Formato" 
                            value={inscripcion.formato}
                            onChange={(e) => handleDeepChange(setBaptismData, 'inscripcion', 'formato', e.target.value)}
                        />
                    </div>
                </SectionCard>
            </div>
        );
    };

    if (loading) {
        return <DashboardLayout entityName={user?.parishName || "Parroquia"}><div className="p-8 text-center text-gray-500">Cargando parámetros...</div></DashboardLayout>;
    }

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#2C3E50] font-serif flex items-center gap-2">
                    <Settings className="w-6 h-6" /> Configuración de Parámetros
                </h1>
                <p className="text-gray-500">Gestione la numeración de libros y opciones generales para cada sacramento.</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
                {/* Tabs Header */}
                <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
                    <TabButton id="bautizos" label="Bautizos" />
                    <TabButton id="matrimonios" label="Matrimonios" />
                    <TabButton id="confirmaciones" label="Confirmaciones" />
                    <TabButton id="exequias" label="Exequias" />
                    <TabButton id="comuniones" label="Primeras Comuniones" />
                </div>

                {/* Tab Content */}
                <div className="p-8 flex-1 bg-gray-50/30">
                    <form onSubmit={handleSave}>
                        {activeTab === 'bautizos' && renderBautizosTab()}
                        {activeTab === 'matrimonios' && renderGenericTab(matrimonyData, setMatrimonyData, 'Matrimonios')}
                        {activeTab === 'confirmaciones' && renderGenericTab(confirmationData, setConfirmationData, 'Confirmaciones')}
                        {activeTab === 'exequias' && renderGenericTab(exequiasData, setExequiasData, 'Exequias')}
                        {activeTab === 'comuniones' && renderGenericTab(firstCommunionData, setFirstCommunionData, 'Primeras Comuniones')}

                        {/* Sticky Footer Actions */}
                        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-4 sticky bottom-0 bg-white/50 backdrop-blur-sm py-4 -mx-4 px-4 rounded-b-lg">
                            <Button type="button" variant="outline" onClick={() => window.location.reload()} className="gap-2">
                                <RefreshCw className="w-4 h-4" /> Cancelar Cambios
                            </Button>
                            <Button type="submit" className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2 shadow-lg shadow-yellow-500/20">
                                <Save className="w-4 h-4" /> Guardar Parámetros
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ParroquiaParametrosPage;