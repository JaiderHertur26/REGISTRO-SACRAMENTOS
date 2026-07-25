import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, RefreshCw, Settings, BookOpen, FileText, CheckSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN PARA SUPABASE

const DEFAULT_PARAMS = {
    enablePreview: true,
    reportPrinting: false,
    ordinarioBlocked: false,
    ordinarioRestartNumber: false,
    ordinarioPartidas: 2,
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    numeroRegistroActual: '', // 🚀 CAMBIO CLAVE
    suplementarioBlocked: false,
    suplementarioReiniciar: false,
    suplementarioPartidas: 2,
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,
    registroAdultoEn: 'ordinario',
    registroDecretoEn: 'suplementario',
    registroInscripcionEn: 'ordinario',
    generarNotaMarginal: true,
    inscripcionNumero: '',
    inscripcionFecha: '',
    inscripcionFormato: ''
};

const ConfirmationParametersPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load Parameters on Mount from SUPABASE
    useEffect(() => {
        const loadParameters = async () => {
            if (!user?.parishId) return;

            console.log("🔍 Cargando parámetros de confirmaciones desde Supabase...");

            try {
                const { data, error } = await supabase
                    .from('parish_parameters')
                    .select('confirmaciones_params')
                    .eq('parish_id', user.parishId)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') throw error;

                if (data && data.confirmaciones_params) {
                    setParams(prev => ({ ...prev, ...data.confirmaciones_params }));
                    console.log("✅ Parámetros cargados:", data.confirmaciones_params);
                } else {
                    console.log("ℹ️ No hay parámetros en Supabase, usando valores por defecto");
                    setParams(DEFAULT_PARAMS);
                }
            } catch (error) {
                console.error("Error loading parameters:", error);
                toast({
                    title: "Error al cargar",
                    description: "No se pudieron cargar los parámetros desde la nube.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadParameters();
    }, [user, toast]);

    // Handle Parameter Changes
    const handleParameterChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        setParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Save Parameters to SUPABASE
    const handleSaveParameters = async () => {
        if (!user?.parishId) {
            toast({
                title: "Error de Sesión",
                description: "No se ha identificado la parroquia.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        console.log("💾 Guardando parámetros en Supabase...");

        try {
            const payload = {
                parish_id: user.parishId,
                confirmaciones_params: params // Guardamos el objeto en la columna de confirmaciones
            };

            const { error } = await supabase
                .from('parish_parameters')
                .upsert(payload, { onConflict: 'parish_id' });

            if (error) throw error;

            console.log("✅ Parámetros guardados correctamente en la Nube");
            
            toast({
                title: "Sincronizado",
                description: "La configuración de Confirmaciones ha sido actualizada en la nube.",
                className: "bg-green-50 border-green-200 text-green-900"
            });
        } catch (error) {
            console.error("Error saving parameters:", error);
            toast({
                title: "Error al guardar",
                description: "Ocurrió un problema al intentar sincronizar con la base de datos.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Reset Parameters
    const handleResetParameters = () => {
        if (window.confirm('¿Está seguro de que desea reiniciar todos los parámetros a sus valores por defecto? Esta acción no se puede deshacer.')) {
            setParams(DEFAULT_PARAMS);
            console.log("🔄 Parámetros reiniciados a valores por defecto");
            
            toast({
                title: "Parámetros Reiniciados",
                description: "Se han restaurado los valores originales. Recuerde guardar.",
            });
        }
    };

    if (loading) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
                        <p className="text-gray-500">Descargando configuración de Confirmaciones...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#111111] font-serif flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#4B7BA7]" /> 
                    Parámetros y Consecutivos (Confirmación)
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                    Configure la numeración de libros, folios y opciones generales para las partidas de confirmación.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-300 mb-6 space-x-1 overflow-x-auto">
                <Link 
                    to="/parroquia/bautismo/parametros" 
                    className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap rounded-t-md"
                >
                    Bautizos
                </Link>
                <Link 
                    to="/parroquia/matrimonio/parametros" 
                    className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap rounded-t-md"
                >
                    Matrimonios
                </Link>
                <button className="px-6 py-2 text-sm font-bold text-[#4B7BA7] border-b-2 border-[#4B7BA7] bg-white rounded-t-md whitespace-nowrap">
                    Confirmaciones
                </button>
                <button className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-not-allowed">
                    Exequias
                </button>
                <button className="px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-not-allowed">
                    Primeras Comuniones
                </button>
            </div>

            {/* Main Content Card - Configuraciones */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden text-sm">
                
                {/* 1. Opciones Generales */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                    <h3 className="text-base font-bold text-[#111111] mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-gray-500" /> Opciones Generales
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                         <label className="flex items-center gap-3 cursor-pointer select-none bg-white p-3 rounded-lg border border-gray-100 hover:border-[#4B7BA7] transition-colors shadow-sm">
                            <input 
                                type="checkbox" 
                                name="enablePreview"
                                checked={params?.enablePreview || false}
                                onChange={handleParameterChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-gray-700 font-medium">Activar Vista Previa al Imprimir</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none bg-white p-3 rounded-lg border border-gray-100 hover:border-[#4B7BA7] transition-colors shadow-sm">
                            <input 
                                type="checkbox" 
                                name="reportPrinting"
                                checked={params?.reportPrinting || false}
                                onChange={handleParameterChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-gray-700 font-medium">Reportar Impresión de Partidas</span>
                        </label>
                    </div>
                </div>

                {/* 2. SECCIÓN: LIBRO ORDINARIO */}
                <div className="p-6 border-b border-gray-100 bg-white">
                    <h3 className="text-base font-bold text-[#111111] flex items-center gap-2 mb-4 uppercase tracking-wide">
                        <BookOpen className="w-4 h-4 text-[#4B7BA7]" /> Libro Ordinario
                    </h3>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioBlocked"
                                checked={params?.ordinarioBlocked || false}
                                onChange={handleParameterChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="font-medium">Bloquear</span>
                        </label>
                         <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioRestartNumber"
                                checked={params?.ordinarioRestartNumber || false}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            <span className="font-medium">Número inicia en 1 en cada Folio</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Partidas por Folio</label>
                            <input 
                                type="number" 
                                name="ordinarioPartidas"
                                value={params?.ordinarioPartidas || ''}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Libro</label>
                            <input 
                                type="number" 
                                name="ordinarioLibro"
                                value={params?.ordinarioLibro || ''}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Folio</label>
                            <input 
                                type="number" 
                                name="ordinarioFolio"
                                value={params?.ordinarioFolio || ''}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Número</label>
                            <input 
                                type="number" 
                                name="ordinarioNumero"
                                value={params?.ordinarioNumero || ''}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Núm. Registro</label>
                            <input 
                                type="text" 
                                name="numeroRegistroActual"
                                value={params?.numeroRegistroActual || ''}
                                onChange={handleParameterChange}
                                disabled={params?.ordinarioBlocked}
                                placeholder="Ej. 123"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. SECCIÓN: LIBRO SUPLETORIO */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-[#111111] flex items-center gap-2 uppercase tracking-wide">
                            <BookOpen className="w-4 h-4 text-gray-500" /> Libro Suplementario
                        </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="suplementarioBlocked"
                                checked={params?.suplementarioBlocked || false}
                                onChange={handleParameterChange}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="font-medium">Bloquear</span>
                        </label>
                         <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="suplementarioReiniciar"
                                checked={params?.suplementarioReiniciar || false}
                                onChange={handleParameterChange}
                                disabled={params?.suplementarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            <span className="font-medium">Reiniciar Número desde 1 en cada folio</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Partidas por Folio</label>
                            <input 
                                type="number" 
                                name="suplementarioPartidas"
                                value={params?.suplementarioPartidas || ''}
                                onChange={handleParameterChange}
                                disabled={params?.suplementarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Libro</label>
                            <input 
                                type="number" 
                                name="suplementarioLibro"
                                value={params?.suplementarioLibro || ''}
                                onChange={handleParameterChange}
                                disabled={params?.suplementarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Folio</label>
                            <input 
                                type="number" 
                                name="suplementarioFolio"
                                value={params?.suplementarioFolio || ''}
                                onChange={handleParameterChange}
                                disabled={params?.suplementarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Número</label>
                            <input 
                                type="number" 
                                name="suplementarioNumero"
                                value={params?.suplementarioNumero || ''}
                                onChange={handleParameterChange}
                                disabled={params?.suplementarioBlocked}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* 4 & 5. Registros Especiales */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 border-b border-gray-200 bg-white">
                    <div className="p-6">
                        <h4 className="font-bold text-[#111111] mb-4 text-xs uppercase tracking-wide">Registrar Inscri. por Decreto en:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="radio" 
                                    name="registroDecretoEn" 
                                    value="ordinario"
                                    checked={params?.registroDecretoEn === 'ordinario'}
                                    onChange={handleParameterChange}
                                    className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-gray-700 font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="radio" 
                                    name="registroDecretoEn" 
                                    value="suplementario"
                                    checked={params?.registroDecretoEn === 'suplementario'}
                                    onChange={handleParameterChange}
                                    className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-gray-700 font-medium">Libro Suplementario</span>
                            </label>
                        </div>
                    </div>
                    <div className="p-6">
                        <h4 className="font-bold text-[#111111] mb-4 text-xs uppercase tracking-wide">Inscripción Regular en:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="radio" 
                                    name="registroInscripcionEn" 
                                    value="ordinario"
                                    checked={params?.registroInscripcionEn === 'ordinario'}
                                    onChange={handleParameterChange}
                                    className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-gray-700 font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="radio" 
                                    name="registroInscripcionEn" 
                                    value="suplementario"
                                    checked={params?.registroInscripcionEn === 'suplementario'}
                                    onChange={handleParameterChange}
                                    className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" 
                                />
                                <span className="text-gray-700 font-medium">Libro Suplementario</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 6. Nota Marginal */}
                <div className="p-6 border-b border-gray-200 bg-gray-50/30">
                    <h3 className="text-base font-bold text-[#111111] mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gray-500" /> Nota Marginal
                    </h3>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            name="generarNotaMarginal"
                            checked={params?.generarNotaMarginal || false}
                            onChange={handleParameterChange}
                            className="w-4 h-4 text-[#4B7BA7] border-gray-300 rounded focus:ring-[#4B7BA7]" 
                        />
                        <span className="text-gray-700 font-medium">Generar nota marginal al imprimir el libro</span>
                    </label>
                </div>

                {/* 7. Inscripción */}
                <div className="p-6 bg-white">
                    <h3 className="text-base font-bold text-[#111111] mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" /> Plantilla de Inscripción por Defecto
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Numero</label>
                            <input 
                                type="text" 
                                name="inscripcionNumero"
                                value={params?.inscripcionNumero || ''}
                                onChange={handleParameterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none bg-gray-50 focus:bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Fecha</label>
                            <input 
                                type="datetime-local" 
                                name="inscripcionFecha"
                                value={params?.inscripcionFecha || ''}
                                onChange={handleParameterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none bg-gray-50 focus:bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Formato</label>
                            <input 
                                type="text" 
                                name="inscripcionFormato"
                                value={params?.inscripcionFormato || ''}
                                onChange={handleParameterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#4B7BA7] outline-none bg-gray-50 focus:bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* TOOLBAR */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row justify-end gap-3 sticky bottom-0 z-10 backdrop-blur-sm bg-gray-50/90">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleResetParameters}
                        disabled={isSaving}
                        className="text-gray-600 border-gray-300 hover:bg-white hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Restaurar
                    </Button>
                    <Button 
                        type="button"
                        onClick={handleSaveParameters}
                        disabled={isSaving}
                        className="bg-[#4B7BA7] hover:bg-[#3a5f8a] text-white px-8 font-bold shadow-md transition-transform active:scale-95"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {isSaving ? 'Guardando...' : 'Guardar y Sincronizar'}
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ConfirmationParametersPage;