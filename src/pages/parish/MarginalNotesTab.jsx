import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, Check, Loader2, FileText, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import { generarTextoNotificacionMatrimonial, formatearFecha } from '@/utils/notificacionMatrimonialTextGenerator';

const MarginalNotesTab = ({ selectedConceptData, documentos = [] }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // Primary State holding all values
    const [notes, setNotes] = useState({
        porCorreccion: { anulada: '', nuevaPartida: '' },
        porReposicion: { nuevaPartidaCreada: { textoParaNuevaPartida: '' } },
        porNotificacionMatrimonial: { textoParaPartidaOriginal: '' },
        estandar: ''
    });

    // Loading & Success feedback states
    const [saving, setSaving] = useState({});
    const [success, setSuccess] = useState({});

    // Dynamic Generator State
    const [dynamicText, setDynamicText] = useState('');
    const [selectedDocId, setSelectedDocId] = useState('');

    // Load data from localStorage
    useEffect(() => {
        if (!user?.parishId) return;

        const storageKey = `notasAlMargen_${user.parishId}`;
        const storedData = localStorage.getItem(storageKey);

        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                setNotes({
                    porCorreccion: {
                        anulada: parsed?.porCorreccion?.anulada || '',
                        nuevaPartida: parsed?.porCorreccion?.nuevaPartida || ''
                    },
                    porReposicion: {
                        nuevaPartidaCreada: {
                            textoParaNuevaPartida: parsed?.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || parsed?.porReposicion?.nuevaPartida || ''
                        }
                    },
                    porNotificacionMatrimonial: {
                        textoParaPartidaOriginal: parsed?.porNotificacionMatrimonial?.textoParaPartidaOriginal || ''
                    },
                    estandar: parsed?.estandar || ''
                });
            } catch (e) {
                console.error("Error parsing stored marginal notes:", e);
                toast({ title: "Error", description: "No se pudieron cargar las notas.", variant: "destructive" });
            }
        }
    }, [user?.parishId, toast]);

    // Detect if selected concept relates to Notificación Matrimonial
    const isNotificacion = selectedConceptData?.concepto?.toLowerCase().includes('notificaci');

    // Handle Dynamic Text Generation when concept or document changes
    useEffect(() => {
        if (selectedConceptData) {
            if (isNotificacion) {
                const docToUse = selectedDocId ? documentos.find(d => d.id === selectedDocId) : documentos[0];
                
                if (docToUse) {
                    if (!selectedDocId) setSelectedDocId(docToUse.id);
                    
                    const text = generarTextoNotificacionMatrimonial({
                        fechaNotificacion: formatearFecha(docToUse.createdAt),
                        fechaMatrimonio: formatearFecha(docToUse.marriageDate),
                        parroquiaMatrimonio: docToUse.marriageParish?.toUpperCase(),
                        diocesisMatrimonio: docToUse.marriageDiocese?.toUpperCase(),
                        nombreConyuge: docToUse.spouseName?.toUpperCase(),
                        libroMatrimonio: docToUse.marriageBook || '___',
                        folioMatrimonio: docToUse.marriageFolio || '___',
                        numeroMatrimonio: docToUse.marriageNumber || '___',
                        fechaExpedicion: formatearFecha(new Date().toISOString())
                    });
                    setDynamicText(text);
                } else {
                    // Fallback to placeholders if no document exists
                    setDynamicText(generarTextoNotificacionMatrimonial());
                }
            } else {
                // When other concepts are selected: Show an empty text field for manual entry
                setDynamicText('');
            }
        }
    }, [selectedConceptData, selectedDocId, isNotificacion, documentos]);

    // Handle generic update to deeply nested state
    const handleChange = (keyPath, value) => {
        setNotes(prev => {
            const newState = { ...prev };
            let current = newState;
            for (let i = 0; i < keyPath.length - 1; i++) {
                current[keyPath[i]] = { ...current[keyPath[i]] };
                current = current[keyPath[i]];
            }
            current[keyPath[keyPath.length - 1]] = value;
            return newState;
        });
    };

    // Generic save to LocalStorage
    const handleSave = async (keyPath, value, buttonKey) => {
        if (!user?.parishId) return;

        setSaving(prev => ({ ...prev, [buttonKey]: true }));
        try {
            await new Promise(resolve => setTimeout(resolve, 600));

            const storageKey = `notasAlMargen_${user.parishId}`;
            const storedData = localStorage.getItem(storageKey);
            let currentData = storedData ? JSON.parse(storedData) : {};

            let current = currentData;
            for (let i = 0; i < keyPath.length - 1; i++) {
                if (!current[keyPath[i]]) current[keyPath[i]] = {};
                current = current[keyPath[i]];
            }
            current[keyPath[keyPath.length - 1]] = value;

            localStorage.setItem(storageKey, JSON.stringify(currentData));

            toast({ title: "Cambios guardados exitosamente", className: "bg-green-600 text-white" });
            
            setSuccess(prev => ({ ...prev, [buttonKey]: true }));
            setTimeout(() => setSuccess(prev => ({ ...prev, [buttonKey]: false })), 2500);
        } catch (error) {
            console.error("Error saving to localStorage:", error);
            toast({ title: "Error", description: "Ocurrió un error al guardar.", variant: "destructive" });
        } finally {
            setSaving(prev => ({ ...prev, [buttonKey]: false }));
        }
    };

    const handleSaveDynamic = () => {
        if (isNotificacion) {
            // Update state and save
            handleChange(['porNotificacionMatrimonial', 'textoParaPartidaOriginal'], dynamicText);
            handleSave(['porNotificacionMatrimonial', 'textoParaPartidaOriginal'], dynamicText, 'dyn_notif');
        } else {
            // Save as standard note template
            handleChange(['estandar'], dynamicText);
            handleSave(['estandar'], dynamicText, 'dyn_std');
        }
    };

    // Helper for generating previews
    const getPreview = (text, type) => {
        if (!text) return "Sin texto definido...";
        let res = text;
        const sampleDate = convertDateToSpanishTextNatural(new Date().toISOString().split('T')[0]);
        
        res = res.replace(/\[FECHA_EXPEDICION\]/g, sampleDate);

        if (type === 'anulada_correccion' || type === 'anulada_notificacion') {
            res = res.replace(/\[FECHA_DECRETO\]/g, "OCHO DE ABRIL DE DOS MIL VEINTICINCO");
            res = res.replace(/\[NUMERO_DECRETO\]/g, "0357");
            res = res.replace(/\[LIBRO_NUEVA\]/g, "0003");
            res = res.replace(/\[FOLIO_NUEVA\]/g, "0001");
            res = res.replace(/\[NUMERO_PARTIDA_NUEVA\]/g, "0002");
        } else if (type === 'nueva_correccion' || type === 'nueva_notificacion') {
            res = res.replace(/\[NUMERO_DECRETO\]/g, "1957");
            res = res.replace(/\[FECHA_DECRETO\]/g, "DIEZ DE ABRIL DE DOS MIL VEINTITRÉS");
            res = res.replace(/\[OFICINA_DECRETO\]/g, "CANCILLERÍA");
            res = res.replace(/\[LIBRO_ANULADA\]/g, "001");
            res = res.replace(/\[FOLIO_ANULADA\]/g, "039");
            res = res.replace(/\[NUMERO_PARTIDA_ANULADA\]/g, "0779");
            res = res.replace(/\[NOMBRE_SACERDOTE\]/g, "PADRE JAIDER HERRERA");
        } else if (type === 'reposicion') {
            res = res.replace(/\[NUMERO_DECRETO\]/g, "0842");
            res = res.replace(/\[FECHA_DECRETO\]/g, "DOCE DE ENERO DE DOS MIL VEINTICUATRO");
        } else if (type === 'notificacion_original') {
            res = res.replace(/\[NUMERO_DECRETO\]/g, "1957");
            res = res.replace(/\[FECHA_DECRETO\]/g, "DIEZ DE ABRIL DE DOS MIL VEINTITRÉS");
            res = res.replace(/\[FECHA_MATRIMONIO\]/g, "QUINCE DE MARZO DE DOS MIL VEINTITRÉS");
            // Also replace the dynamic tags if they were manually inserted
            res = res.replace(/\[FECHA_NOTIFICACION\]/g, "21 DE FEBRERO DE 2025");
            res = res.replace(/\[PARROQUIA_MATRIMONIO\]/g, "SANTA CRUZ");
            res = res.replace(/\[DIOCESIS_MATRIMONIO\]/g, "BARRANQUILLA");
            res = res.replace(/\[NOMBRE_CONYUGE\]/g, "MARIA PEREZ");
            res = res.replace(/\[LIBRO_MAT\]/g, "002");
            res = res.replace(/\[FOLIO_MAT\]/g, "014");
            res = res.replace(/\[NUMERO_MAT\]/g, "056");
        }
        
        return res;
    };

    // Reusable Status Button
    const SaveStatusButton = ({ isSaving, isSuccess, onClick, label = "Guardar Cambios", className = "" }) => (
        <Button 
            onClick={onClick} 
            disabled={isSaving}
            className={`w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-2 transition-all relative overflow-hidden ${className}`}
        >
            <AnimatePresence mode="wait">
                {isSaving ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                    </motion.div>
                ) : isSuccess ? (
                    <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-green-300">
                        <Check className="w-4 h-4" /> ¡Guardado exitosamente!
                    </motion.div>
                ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <Save className="w-4 h-4" /> {label}
                    </motion.div>
                )}
            </AnimatePresence>
        </Button>
    );

    return (
        <div className="space-y-8 py-6 px-4 max-w-5xl mx-auto">
            
            {/* CONDITIONAL RENDERING: Dynamic Section for Selected Concept */}
            <AnimatePresence mode="wait">
                {selectedConceptData && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, height: 'auto', scale: 1 }} 
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className={`rounded-xl border shadow-md p-6 mb-8 overflow-hidden relative ${isNotificacion ? 'bg-indigo-50/50 border-indigo-200' : 'bg-blue-50/50 border-blue-200'}`}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>
                        
                        <div className="mb-5 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className={`w-5 h-5 ${isNotificacion ? 'text-indigo-600' : 'text-blue-600'}`} />
                                    <h3 className={`text-xl font-bold ${isNotificacion ? 'text-indigo-900' : 'text-blue-900'}`}>
                                        Generador para: {selectedConceptData.concepto}
                                    </h3>
                                </div>
                                {isNotificacion ? (
                                    <p className="text-sm text-indigo-700 ml-7">Texto predefinido generado utilizando los datos de notificaciones matrimoniales reales.</p>
                                ) : (
                                    <p className="text-sm text-blue-700 ml-7">Ingrese la nota marginal manual correspondiente a este concepto.</p>
                                )}
                            </div>

                            {/* Show Document Selector ONLY for Notificación */}
                            {isNotificacion && documentos?.length > 0 && (
                                <div className="shrink-0 bg-white p-2 rounded-lg border border-indigo-100 shadow-sm flex items-center gap-3">
                                    <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Usar datos de:</span>
                                    <select 
                                        className="p-1.5 text-sm border-0 border-b-2 border-indigo-200 bg-transparent text-indigo-900 focus:ring-0 focus:border-indigo-600 outline-none cursor-pointer"
                                        value={selectedDocId}
                                        onChange={(e) => setSelectedDocId(e.target.value)}
                                    >
                                        <option value="">Seleccione un respaldo...</option>
                                        {documentos.map(doc => (
                                            <option key={doc.id} value={doc.id}>
                                                Consecutivo #{doc.consecutivo} - {doc.personName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {!isNotificacion && (
                                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-100 mb-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>Para este concepto, se proporciona un campo vacío para la entrada manual según los requerimientos.</p>
                                </div>
                            )}
                            
                            <textarea
                                value={dynamicText}
                                onChange={(e) => setDynamicText(e.target.value)}
                                className={`w-full min-h-[180px] p-4 border rounded-lg focus:ring-2 outline-none resize-none text-[15px] font-mono leading-relaxed shadow-inner ${isNotificacion ? 'border-indigo-300 focus:ring-indigo-500 bg-white text-indigo-950' : 'border-blue-300 focus:ring-blue-500 bg-white text-blue-950'}`}
                                placeholder={isNotificacion ? "Generando texto..." : "Ingrese el texto manual aquí..."}
                            />
                            
                            <SaveStatusButton 
                                isSaving={saving[isNotificacion ? 'dyn_notif' : 'dyn_std']} 
                                isSuccess={success[isNotificacion ? 'dyn_notif' : 'dyn_std']} 
                                onClick={handleSaveDynamic}
                                label={isNotificacion ? "Guardar como Plantilla de Notificación" : "Guardar Texto Manual"}
                                className={isNotificacion ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Plantillas Generales</span>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            {/* SECCIÓN 1: CORRECCIÓN */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 opacity-75 hover:opacity-100 transition-opacity">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Por Corrección</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Partida Anulada */}
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Texto para Partida Anulada</label>
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                                <strong>Variables:</strong> [FECHA_DECRETO], [NUMERO_DECRETO], [LIBRO_NUEVA], [FOLIO_NUEVA], [NUMERO_PARTIDA_NUEVA], [FECHA_EXPEDICION]
                            </div>
                            <textarea
                                value={notes.porCorreccion.anulada}
                                onChange={(e) => handleChange(['porCorreccion', 'anulada'], e.target.value)}
                                className="w-full min-h-[160px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 bg-white font-mono"
                                placeholder="Texto legal para la partida que se anula..."
                            />
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100 flex-1 flex flex-col">
                             <span className="text-xs font-bold text-gray-500 block mb-1 uppercase">Vista Previa</span>
                             <div className="flex-1 bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 italic overflow-y-auto max-h-[160px]">
                                {getPreview(notes.porCorreccion.anulada, 'anulada_correccion')}
                             </div>
                        </div>
                        <SaveStatusButton 
                            isSaving={saving['corr_anulada']} 
                            isSuccess={success['corr_anulada']} 
                            onClick={() => handleSave(['porCorreccion', 'anulada'], notes.porCorreccion.anulada, 'corr_anulada')} 
                        />
                    </div>

                    {/* Nueva Partida */}
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Texto para Nueva Partida Creada</label>
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                                <strong>Variables:</strong> [NUMERO_DECRETO], [FECHA_DECRETO], [OFICINA_DECRETO], [LIBRO_ANULADA], [FOLIO_ANULADA], [NUMERO_PARTIDA_ANULADA], [NOMBRE_SACERDOTE], [FECHA_EXPEDICION]
                            </div>
                            <textarea
                                value={notes.porCorreccion.nuevaPartida}
                                onChange={(e) => handleChange(['porCorreccion', 'nuevaPartida'], e.target.value)}
                                className="w-full min-h-[160px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 bg-white font-mono"
                                placeholder="Texto legal para la nueva partida creada..."
                            />
                        </div>
                         <div className="bg-gray-50 p-3 rounded border border-gray-100 flex-1 flex flex-col">
                             <span className="text-xs font-bold text-gray-500 block mb-1 uppercase">Vista Previa</span>
                             <div className="flex-1 bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 italic overflow-y-auto max-h-[160px]">
                                {getPreview(notes.porCorreccion.nuevaPartida, 'nueva_correccion')}
                             </div>
                        </div>
                        <SaveStatusButton 
                            isSaving={saving['corr_nueva']} 
                            isSuccess={success['corr_nueva']} 
                            onClick={() => handleSave(['porCorreccion', 'nuevaPartida'], notes.porCorreccion.nuevaPartida, 'corr_nueva')} 
                        />
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: REPOSICIÓN */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 opacity-75 hover:opacity-100 transition-opacity">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Por Reposición</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Texto para Nueva Partida Creada</label>
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                                <strong>Variables:</strong> [NUMERO_DECRETO], [FECHA_DECRETO], [FECHA_EXPEDICION]
                            </div>
                            <textarea
                                value={notes.porReposicion.nuevaPartidaCreada.textoParaNuevaPartida}
                                onChange={(e) => handleChange(['porReposicion', 'nuevaPartidaCreada', 'textoParaNuevaPartida'], e.target.value)}
                                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 bg-white"
                                placeholder="Texto legal para la partida de reposición..."
                            />
                        </div>
                    </div>
                    <div className="space-y-4 flex flex-col h-full">
                         <div className="bg-gray-50 p-4 rounded border border-gray-100 flex-1">
                             <span className="text-xs font-bold text-gray-500 block mb-2 uppercase">Vista Previa</span>
                             <p className="text-sm text-gray-600 italic">
                                 {getPreview(notes.porReposicion.nuevaPartidaCreada.textoParaNuevaPartida, 'reposicion')}
                            </p>
                        </div>
                    </div>
                </div>
                
                <SaveStatusButton 
                    isSaving={saving['repo_nueva']} 
                    isSuccess={success['repo_nueva']} 
                    onClick={() => handleSave(['porReposicion', 'nuevaPartidaCreada', 'textoParaNuevaPartida'], notes.porReposicion.nuevaPartidaCreada.textoParaNuevaPartida, 'repo_nueva')} 
                />
            </div>

            {/* SECCIÓN 3: NOTIFICACIÓN MATRIMONIAL (Plantilla Base) */}
            <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-6 transition-all ${isNotificacion ? 'ring-2 ring-indigo-500 shadow-md opacity-100' : 'opacity-75 hover:opacity-100'}`}>
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Por Notificación Matrimonial</h3>
                    <p className="text-sm text-gray-500">Plantilla base para avisos de matrimonio</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Texto para Partida Original</label>
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                                <strong>Variables:</strong> [NUMERO_DECRETO], [FECHA_DECRETO], [FECHA_MATRIMONIO], [FECHA_EXPEDICION]
                            </div>
                            <textarea
                                value={notes.porNotificacionMatrimonial.textoParaPartidaOriginal}
                                onChange={(e) => handleChange(['porNotificacionMatrimonial', 'textoParaPartidaOriginal'], e.target.value)}
                                className="w-full min-h-[160px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 bg-white font-mono"
                                placeholder="Ej: Esta partida corresponde a persona casada/o. Decreto de notificación matrimonial [NUMERO_DECRETO] de [FECHA_DECRETO]. Matrimonio celebrado [FECHA_MATRIMONIO]. Expedido [FECHA_EXPEDICION]."
                            />
                        </div>
                    </div>
                    <div className="space-y-4 flex flex-col h-full">
                         <div className="bg-gray-50 p-4 rounded border border-gray-100 flex-1">
                             <span className="text-xs font-bold text-gray-500 block mb-2 uppercase">Vista Previa</span>
                             <p className="text-sm text-gray-600 italic">
                                {getPreview(notes.porNotificacionMatrimonial.textoParaPartidaOriginal, 'notificacion_original')}
                             </p>
                        </div>
                    </div>
                </div>
                
                <SaveStatusButton 
                    isSaving={saving['notif_original']} 
                    isSuccess={success['notif_original']} 
                    onClick={() => handleSave(['porNotificacionMatrimonial', 'textoParaPartidaOriginal'], notes.porNotificacionMatrimonial.textoParaPartidaOriginal, 'notif_original')} 
                />
            </div>

            {/* SECCIÓN 4: ESTÁNDAR */}
            <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-6 transition-opacity ${!isNotificacion && selectedConceptData ? 'ring-2 ring-blue-500 shadow-md opacity-100' : 'opacity-75 hover:opacity-100'}`}>
                 <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">La Nota al Margen Estándar</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Texto Estándar</label>
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                                <strong>Variables:</strong> [FECHA_EXPEDICION]
                            </div>
                            <textarea
                                value={notes.estandar}
                                onChange={(e) => handleChange(['estandar'], e.target.value)}
                                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 bg-white"
                                placeholder="Texto estándar para notas marginales..."
                            />
                        </div>
                    </div>
                     <div className="space-y-4 flex flex-col h-full">
                         <div className="bg-gray-50 p-4 rounded border border-gray-100 flex-1">
                             <span className="text-xs font-bold text-gray-500 block mb-2 uppercase">Vista Previa</span>
                             <p className="text-sm text-gray-600 italic">{getPreview(notes.estandar, 'estandar')}</p>
                        </div>
                    </div>
                </div>

                <SaveStatusButton 
                    isSaving={saving['estandar']} 
                    isSuccess={success['estandar']} 
                    onClick={() => handleSave(['estandar'], notes.estandar, 'estandar')} 
                />
            </div>
        </div>
    );
};

export default MarginalNotesTab;