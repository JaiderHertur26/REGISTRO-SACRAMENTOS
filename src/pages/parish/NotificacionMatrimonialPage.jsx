import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { 
    Mail, CheckCircle2, AlertCircle, Edit3, 
    Search, FileText, Send, History, 
    ArrowRight, UserPlus, ShieldCheck, Loader2, X
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { motion, AnimatePresence } from 'framer-motion';

import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';
import FormularioNotificacionMatrimonial from '@/components/FormularioNotificacionMatrimonial';
import FormularioNotificacionManual from '@/components/FormularioNotificacionManual';
import ConfirmacionNotificacion from '@/components/ConfirmacionNotificacion';
import FiltrosRespaldos from '@/components/FiltrosRespaldos';
import TablaRespaldos from '@/components/TablaRespaldos';
import ModalVerDocumento from '@/components/ModalVerDocumento';

import { filtrarDocumentos, enriquecerDocumentoConDatos } from '@/utils/matrimonialNotificationDocumentHelpers';
import { validarPersonaNoTieneConyuge } from '@/utils/matrimonialNotificationValidation';
import { cn } from '@/lib/utils';

const NotificacionMatrimonialPage = () => {
    const { user } = useAuth();
    const { 
        guardarNotificacionMatrimonial, getDocumentosParroquia, 
        getParroquiasReceptoras, getBaptisms, getMatrimonios,
        getMisDatosList, obtenerNotasAlMargen, loadData, data 
    } = useAppData();
    const { toast } = useToast();

    // --- ESTADOS DE CONTROL ---
    const [activeTab, setActiveTab] = useState('crear');
    const [isManualMode, setIsManualMode] = useState(false);
    const [selectedPartida, setSelectedPartida] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [savedDocumento, setSavedDocumento] = useState(null);
    
    // Estados de Archivo
    const [rawDocuments, setRawDocuments] = useState([]);
    const [filteredDocuments, setFilteredDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [showDocumentModal, setShowDocumentModal] = useState(false);

    useEffect(() => {
        if (user?.parishId) loadRespaldosData();
    }, [user?.parishId, activeTab]);

    const loadRespaldosData = () => {
        const docs = getDocumentosParroquia(user.parishId);
        setRawDocuments(docs);
        setFilteredDocuments(docs);
    };

    // --- MANEJADORES DE FLUJO ---
    const handlePartidaSelected = (partida) => {
        if (!partida) return setSelectedPartida(null);
        
        // Validación de Integridad Canónica
        const fullName = `${partida.firstName || partida.nombres} ${partida.lastName || partida.apellidos}`.toUpperCase();
        const validacion = validarPersonaNoTieneConyuge(fullName, rawDocuments);
        
        if (!validacion.valido) {
            toast({ title: "Alerta Canónica", description: validacion.mensaje, variant: "destructive" });
        }
        
        setSelectedPartida(partida);
    };

    const processSave = async (payloadPartida, payloadFormData) => {
        setIsSaving(true);
        try {
            const parishId = user?.parishId;
            const notasConfig = obtenerNotasAlMargen(parishId);
            
            const payload = {
                partida: payloadPartida,
                formData: payloadFormData,
                parishId: parishId,
                createdBy: user.username,
                notaPlantilla: notasConfig?.porNotificacionMatrimonial?.textoParaPartidaOriginal
            };

            const result = await guardarNotificacionMatrimonial(payload);

            if (result.success) {
                setSavedDocumento(result.data);
                setShowConfirmation(true);
                toast({ title: "Despachado", description: "Notificación archivada y lista para impresión.", className: "bg-green-50 text-green-900 border-green-200" });
                loadData();
            }
        } catch (err) {
            toast({ title: "Error de Sistema", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFilterChange = (filters) => {
        const filtered = filtrarDocumentos(rawDocuments, filters);
        setFilteredDocuments(filtered);
    };

    const handleViewDocument = (doc) => {
        const baptisms = getBaptisms(user.parishId);
        const matrimonios = getMatrimonios(user.parishId);
        const enrichedDoc = enriquecerDocumentoConDatos(doc, baptisms, matrimonios);
        setSelectedDocument(enrichedDoc);
        setShowDocumentModal(true);
    };

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Corresponsalía Matrimonial | Sacramentum</title></Helmet>

            <div className="max-w-6xl mx-auto pb-20">
                
                {/* CABECERA */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                            <Send className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Notificación Matrimonial</h1>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Gestión de avisos a parroquias de bautismo</p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-10 bg-gray-100 p-1 rounded-2xl h-14 max-w-md">
                        <TabsTrigger value="crear" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Nueva Notificación</TabsTrigger>
                        <TabsTrigger value="respaldos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Archivo de Envíos</TabsTrigger>
                    </TabsList>

                    {/* --- PESTAÑA: CREACIÓN --- */}
                    <TabsContent value="crear" className="space-y-8 animate-in fade-in duration-500">
                        
                        {!selectedPartida && !isManualMode && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Opción A: Búsqueda Local */}
                                <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Search className="w-5 h-5"/></div>
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Búsqueda en Base Digital</h3>
                                    </div>
                                    <p className="text-gray-500 text-xs font-medium leading-relaxed">Utilice este método si el contrayente fue bautizado en esta parroquia y su registro ya está en la Nube.</p>
                                    <BusquedaPartidaBautismo onPartidaSelected={handlePartidaSelected} />
                                </div>

                                {/* Opción B: Modo Manual */}
                                <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-dashed border-gray-300 flex flex-col items-center justify-center text-center space-y-6 group hover:bg-white hover:border-[#D4AF37] transition-all">
                                    <div className="bg-white p-4 rounded-full shadow-sm text-gray-400 group-hover:text-[#D4AF37] transition-colors"><UserPlus className="w-10 h-10" /></div>
                                    <div>
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-2">Registro Externo</h3>
                                        <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">Emita una notificación para bautismos realizados en otras parroquias o registros antiguos no digitalizados.</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setIsManualMode(true)}
                                        className="py-6 rounded-2xl border-gray-200 font-black uppercase text-[10px] tracking-widest px-8"
                                    >
                                        Crear Notificación Manual
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* FORMULARIOS DE REDACCIÓN */}
                        <AnimatePresence mode="wait">
                            {(selectedPartida || isManualMode) && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="bg-gray-50 px-10 py-6 border-b border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg text-white shadow-lg", isManualMode ? "bg-orange-500" : "bg-blue-600")}>
                                                {isManualMode ? <Edit3 className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                                            </div>
                                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Redacción de Documento Oficial</h3>
                                        </div>
                                        <Button variant="ghost" onClick={() => { setSelectedPartida(null); setIsManualMode(false); }} className="text-gray-400 hover:text-red-500"><X/></Button>
                                    </div>
                                    
                                    <div className="p-10">
                                        {isManualMode ? (
                                            <FormularioNotificacionManual 
                                                parishes={data?.parishes || []} 
                                                onSave={(formData) => processSave({ ...formData, isManual: true }, formData)} 
                                                onCancel={() => setIsManualMode(false)} 
                                                disabled={isSaving} 
                                            />
                                        ) : (
                                            <FormularioNotificacionMatrimonial 
                                                selectedPartida={selectedPartida} 
                                                allDocuments={rawDocuments}
                                                onSave={(formData) => processSave(selectedPartida, formData)} 
                                                onCancel={() => setSelectedPartida(null)} 
                                                disabled={isSaving} 
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </TabsContent>

                    {/* --- PESTAÑA: ARCHIVO --- */}
                    <TabsContent value="respaldos" className="space-y-6 animate-in fade-in duration-500">
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
                            <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><History className="w-4 h-4 text-amber-500"/> Registro Histórico de Salida</h2>
                                <FiltrosRespaldos onFilterChange={handleFilterChange} availableParishes={getParroquiasReceptoras(user.parishId)} />
                            </div>
                            <div className="p-2">
                                <TablaRespaldos 
                                    documentos={filteredDocuments} 
                                    onViewDocument={handleViewDocument} 
                                    catalogParishes={data?.parishes || []} 
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* MODALES DE CIERRE */}
            <ConfirmacionNotificacion 
                isOpen={showConfirmation} 
                documento={savedDocumento} 
                onClose={() => { setShowConfirmation(false); setActiveTab('respaldos'); }} 
                onViewDocument={() => handleViewDocument(savedDocumento)}
            />

            <ModalVerDocumento 
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                documento={selectedDocument}
            />
        </DashboardLayout>
    );
};

export default NotificacionMatrimonialPage;