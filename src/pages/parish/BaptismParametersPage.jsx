import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, RefreshCw, Settings, BookOpen, FileText, CheckSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient'; 

// ☁️ 1. PARÁMETROS DE LA NUBE (Consecutivos y Reglas de Negocio)
const DEFAULT_CLOUD_PARAMS = {
    ordinarioBlocked: false,
    ordinarioRestartNumber: false,
    ordinarioPartidas: 2,
    ordinarioLibro: 1,
    ordinarioFolio: 436,
    ordinarioNumero: 871,
    numeroRegistroActual: '', 
    suplementarioBlocked: false,
    suplementarioReiniciar: false,
    suplementarioPartidas: 2,
    suplementarioLibro: 3,
    suplementarioFolio: 2,
    suplementarioNumero: 3,
    registroAdultoEn: 'ordinario',
    registroDecretoEn: 'suplementario',
    generarNotaMarginal: true,
    inscripcionNumero: '',
    inscripcionFecha: '',
    inscripcionFormato: ''
};

// 💻 2. PREFERENCIAS LOCALES DEL DISPOSITIVO (UI)
const DEFAULT_LOCAL_PREFS = {
    enablePreview: true,
    reportPrinting: false,
};

const BaptismParametersPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [cloudParams, setCloudParams] = useState(DEFAULT_CLOUD_PARAMS);
    const [localPrefs, setLocalPrefs] = useState(DEFAULT_LOCAL_PREFS);
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 🚀 CARGA DE DATOS AL MONTAR EL COMPONENTE
    useEffect(() => {
        const loadSettings = async () => {
            if (!user?.parishId) return;

            // 1. Cargar Preferencias Locales (del PC actual)
            const savedPrefs = localStorage.getItem('bautizos_ui_prefs');
            if (savedPrefs) {
                setLocalPrefs(JSON.parse(savedPrefs));
            }

            // 2. Cargar Consecutivos desde Supabase (La fuente de la verdad para todas las PCs)
            try {
                const { data, error } = await supabase
                    .from('parish_parameters')
                    .select('bautizos_params')
                    .eq('parish_id', user.parishId)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') throw error;

                if (data && data.bautizos_params) {
                    setCloudParams(prev => ({ ...prev, ...data.bautizos_params }));
                }
            } catch (error) {
                toast({
                    title: "Error de Sincronización",
                    description: "No se pudieron descargar los consecutivos desde la nube.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [user, toast]);

    // ⚙️ MANEJADOR DE CAMBIOS PARA LA NUBE (Consecutivos)
    const handleCloudChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCloudParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // ⚙️ MANEJADOR DE CAMBIOS LOCALES (Gustos de este PC)
    const handleLocalPrefChange = (e) => {
        const { name, checked } = e.target;
        const newPrefs = { ...localPrefs, [name]: checked };
        setLocalPrefs(newPrefs);
        localStorage.setItem('bautizos_ui_prefs', JSON.stringify(newPrefs)); // Se guarda instantáneamente en el PC
    };

    // 🚀 GUARDADO DE CONSECUTIVOS EN SUPABASE
    const handleSaveParameters = async () => {
        if (!user?.parishId) return;

        setIsSaving(true);
        try {
            const payload = {
                parish_id: user.parishId,
                bautizos_params: cloudParams 
            };

            const { error } = await supabase
                .from('parish_parameters')
                .upsert(payload, { onConflict: 'parish_id' });

            if (error) throw error;
            
            toast({
                title: "Sincronizado con la Nube",
                description: "Los consecutivos han sido actualizados para todas las computadoras.",
                className: "bg-green-50 border-green-200 text-green-900"
            });
        } catch (error) {
            toast({
                title: "Error al guardar",
                description: "No se pudo sincronizar con la base de datos central.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetParameters = () => {
        if (window.confirm('¿Está seguro de que desea reiniciar todos los consecutivos a sus valores de fábrica? Esta acción afectará a todos los ordenadores.')) {
            setCloudParams(DEFAULT_CLOUD_PARAMS);
            toast({ title: "Parámetros Reiniciados", description: "Se han restaurado los valores. Recuerde hacer clic en Guardar en la Nube." });
        }
    };

    if (loading) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">Descargando Consecutivos...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#111111] font-serif flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#4B7BA7]" /> 
                    Parámetros y Consecutivos
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                    Configure la numeración de libros, folios y opciones generales para las partidas de bautismo.
                </p>
            </div>

            <div className="flex border-b border-gray-300 mb-6 space-x-1 overflow-x-auto">
                <button className="px-6 py-2 text-sm font-bold text-[#4B7BA7] border-b-2 border-[#4B7BA7] bg-white rounded-t-md whitespace-nowrap">
                    Bautizos
                </button>
                <Link to="/parroquia/matrimonio/parametros" className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap rounded-t-md">
                    Matrimonios
                </Link>
                <Link to="/parroquia/confirmacion/parametros" className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap rounded-t-md">
                    Confirmaciones
                </Link>
                <button className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-not-allowed">
                    Exequias
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden text-sm">
                
                {/* 1. Opciones Locales (UI) */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#4B7BA7]" /> Preferencias de este Ordenador
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="enablePreview"
                                checked={localPrefs.enablePreview}
                                onChange={handleLocalPrefChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-gray-700 font-medium">Activar Vista Previa al imprimir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="reportPrinting"
                                checked={localPrefs.reportPrinting}
                                onChange={handleLocalPrefChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-gray-700 font-medium">Reportar Impresión de Partidas</span>
                        </label>
                    </div>
                </div>

                {/* 2. Libro Ordinario (Nube) */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex flex-wrap items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-gray-800 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#4B7BA7]" /> Consecutivos Libro Ordinario
                        </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioBlocked"
                                checked={cloudParams.ordinarioBlocked}
                                onChange={handleCloudChange}
                                className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500" 
                            />
                            Bloquear
                        </label>
                         <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioRestartNumber"
                                checked={cloudParams.ordinarioRestartNumber}
                                onChange={handleCloudChange}
                                disabled={cloudParams.ordinarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            Número inicia en 1 en cada Folio
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Partidas/Folio</label>
                            <input 
                                type="number" name="ordinarioPartidas" value={cloudParams.ordinarioPartidas} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Libro</label>
                            <input 
                                type="number" name="ordinarioLibro" value={cloudParams.ordinarioLibro} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-bold text-blue-600 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Folio</label>
                            <input 
                                type="number" name="ordinarioFolio" value={cloudParams.ordinarioFolio} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-bold text-blue-600 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Número</label>
                            <input 
                                type="number" name="ordinarioNumero" value={cloudParams.ordinarioNumero} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-black text-green-600 bg-green-50 focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Núm. Registro</label>
                            <input 
                                type="text" name="numeroRegistroActual" value={cloudParams.numeroRegistroActual || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                placeholder="Ej. 123"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-50"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Libro Suplementario (Nube) */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-gray-800 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-purple-600" /> Consecutivos Supletorios
                        </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" name="suplementarioBlocked" checked={cloudParams.suplementarioBlocked} onChange={handleCloudChange}
                                className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500" 
                            />
                            Bloquear
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" name="suplementarioReiniciar" checked={cloudParams.suplementarioReiniciar} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            Reiniciar Número desde 1 en cada folio
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Partidas/Folio</label>
                            <input 
                                type="number" name="suplementarioPartidas" value={cloudParams.suplementarioPartidas} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Libro</label>
                            <input 
                                type="number" name="suplementarioLibro" value={cloudParams.suplementarioLibro} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-bold text-purple-600 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Folio</label>
                            <input 
                                type="number" name="suplementarioFolio" value={cloudParams.suplementarioFolio} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-bold text-purple-600 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Numero</label>
                            <input 
                                type="number" name="suplementarioNumero" value={cloudParams.suplementarioNumero} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-black text-purple-700 bg-purple-50 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                </div>

                {/* 4 & 5. Reglas de Negocio (Nube) */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/30">
                    <div className="p-6">
                        <h4 className="font-bold text-gray-800 mb-3 text-[11px] uppercase tracking-widest">Destino Bautizos de Adulto:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroAdultoEn" value="ordinario" checked={cloudParams.registroAdultoEn === 'ordinario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-gray-700 text-sm font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroAdultoEn" value="suplementario" checked={cloudParams.registroAdultoEn === 'suplementario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-gray-700 text-sm font-medium">Libro Supletorio</span>
                            </label>
                        </div>
                    </div>
                    <div className="p-6">
                        <h4 className="font-bold text-gray-800 mb-3 text-[11px] uppercase tracking-widest">Destino Inscripción por Decreto:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroDecretoEn" value="ordinario" checked={cloudParams.registroDecretoEn === 'ordinario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-gray-700 text-sm font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroDecretoEn" value="suplementario" checked={cloudParams.registroDecretoEn === 'suplementario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-gray-700 text-sm font-medium">Libro Supletorio</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 6. Nota Marginal (Nube) */}
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Notas Marginales
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" name="generarNotaMarginal" checked={cloudParams.generarNotaMarginal} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" />
                        <span className="text-gray-700 font-medium text-sm">Generar nota marginal de Registro Civil al imprimir el libro</span>
                    </label>
                </div>

                {/* Footer / Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row justify-end gap-3">
                    <Button 
                        type="button" variant="outline" onClick={handleResetParameters} disabled={isSaving}
                        className="text-gray-600 border-gray-300 hover:bg-gray-200 rounded-xl px-6 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Restaurar Valores
                    </Button>
                    <Button 
                        type="button" onClick={handleSaveParameters} disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-900/20 transition-all active:scale-95"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSaving ? 'Sincronizando...' : 'Guardar en la Nube'}
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BaptismParametersPage;