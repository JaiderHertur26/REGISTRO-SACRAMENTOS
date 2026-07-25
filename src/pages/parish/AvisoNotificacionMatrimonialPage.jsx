import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Inbox, Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

import FiltrosAvisos from '@/components/FiltrosAvisos';
import TablaAvisos from '@/components/TablaAvisos';
import ModalVerAviso from '@/components/ModalVerAviso';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

import { 
    obtenerAvisosParroquia, 
    filtrarAvisos, 
    marcarAvisoComoVisto, 
    eliminarAviso,
    obtenerDocumentoRelacionado,
    obtenerPartidaRelacionada
} from '@/utils/matrimonialNotificationAvisoHelpers';

import { desafectarPartidaBautismo } from '@/utils/matrimonialNotificationHelpers';

const AvisoNotificacionMatrimonialPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { data, loadData } = useAppData();

    const [isLoading, setIsLoading] = useState(true);
    const [avisosRaw, setAvisosRaw] = useState([]);
    const [filteredAvisos, setFilteredAvisos] = useState([]);
    const [availableParishes, setAvailableParishes] = useState([]);
    const [currentFilters, setCurrentFilters] = useState({});
    
    // Modal & Dialog states
    const [selectedAviso, setSelectedAviso] = useState(null);
    const [relatedDocumento, setRelatedDocumento] = useState(null);
    const [relatedPartida, setRelatedPartida] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [avisoToProcess, setAvisoToProcess] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadAvisos = async () => {
        if (!user?.parishId) return;
        setIsLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const list = obtenerAvisosParroquia(user.parishId);
            setAvisosRaw(list);
            
            if (Object.keys(currentFilters).length > 0) {
                setFilteredAvisos(filtrarAvisos(list, currentFilters));
            } else {
                setFilteredAvisos(list);
            }

            const emisorIds = [...new Set(list.map(a => {
                const doc = obtenerDocumentoRelacionado(a.documentoId);
                return doc ? doc.parishId : null;
            }).filter(Boolean))];

            const parishesInfo = (data.parishes || []).filter(p => emisorIds.includes(p.id));
            setAvailableParishes(parishesInfo);
        } catch (error) {
            console.error("Error loading avisos:", error);
            toast({
                title: "Error al cargar",
                description: "Ocurrió un problema al cargar los avisos. Intente nuevamente.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAvisos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.parishId, data.parishes]);

    const handleFilterChange = (filtros) => {
        setCurrentFilters(filtros);
        const result = filtrarAvisos(avisosRaw, filtros);
        setFilteredAvisos(result);
    };

    const handleViewAviso = (aviso) => {
        const documento = obtenerDocumentoRelacionado(aviso.documentoId);
        const partida = documento ? obtenerPartidaRelacionada(documento.baptismPartidaId) : null;
        
        setSelectedAviso(aviso);
        setRelatedDocumento(documento);
        setRelatedPartida(partida);
        setShowViewModal(true);
    };

    const requestMarkAsViewed = (aviso) => {
        setAvisoToProcess(aviso);
        setShowConfirmDialog(true);
    };

    const confirmMarkAsViewed = () => {
        if (!avisoToProcess) return;
        
        const res = marcarAvisoComoVisto(avisoToProcess.id, user.id || user.username);
        
        if (res.success) {
            toast({
                title: "Estado Actualizado",
                description: "El aviso ha sido marcado como procesado.",
                className: "bg-green-600 text-white"
            });
            loadAvisos();
            if (showViewModal && selectedAviso?.id === avisoToProcess.id) {
                setSelectedAviso({ ...selectedAviso, status: 'visto', viewedAt: new Date().toISOString() });
            }
        } else {
            toast({
                title: "Error",
                description: res.message || "No se pudo actualizar el estado.",
                variant: "destructive"
            });
        }
        setShowConfirmDialog(false);
        setAvisoToProcess(null);
    };

    const requestDeleteAviso = (aviso) => {
        setAvisoToProcess(aviso);
        setShowDeleteDialog(true);
    };

    const confirmDeleteAviso = async () => {
        if (!avisoToProcess) return;
        setIsDeleting(true);
        
        try {
            const doc = obtenerDocumentoRelacionado(avisoToProcess.documentoId);
            
            if (doc && doc.baptismPartidaId && user?.parishId) {
                console.log(`[Avisos] Intentando desafectar partida ${doc.baptismPartidaId}...`);
                const desafectarRes = await desafectarPartidaBautismo(doc.baptismPartidaId, user.parishId);
                if (desafectarRes.success) {
                    console.log(`[Avisos] Partida ${doc.baptismPartidaId} desafectada y nota original restaurada.`);
                }
            }

            const res = eliminarAviso(avisoToProcess.id);
            
            if (res.success) {
                toast({
                    title: "Aviso Eliminado",
                    description: "El aviso fue eliminado y la partida desafectada de la notificación. Nota marginal original restaurada.",
                    className: "bg-green-600 text-white"
                });
                
                if (showViewModal && selectedAviso?.id === avisoToProcess.id) {
                    setShowViewModal(false);
                }
                
                // Refresh global data to sync changes across the app
                loadData();
                loadAvisos();
            } else {
                throw new Error(res.message || "No se pudo eliminar el aviso.");
            }
        } catch (error) {
            console.error("Error durante eliminación de aviso:", error);
            toast({
                title: "Error al procesar",
                description: error.message || "Hubo un error al eliminar el aviso o desafectar la partida.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
            setAvisoToProcess(null);
        }
    };

    const currentParishInfo = (data.parishes || []).find(p => p.id === user?.parishId);
    const currentParishName = currentParishInfo ? currentParishInfo.name : (user?.parishName || "Esta Parroquia");

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet>
                <title>Bandeja de Avisos Matrimoniales | Eclesia Digital</title>
                <meta name="description" content="Gestión de avisos recibidos de otras parroquias sobre matrimonios celebrados." />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#D4AF37] p-2 rounded-lg">
                            <Mail className="w-6 h-6 text-[#111111]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Bandeja de Avisos Matrimoniales</h1>
                            <p className="text-gray-500 text-sm">Gestione las notificaciones recibidas para asentar notas marginales de matrimonio.</p>
                        </div>
                    </div>
                </div>

                <FiltrosAvisos 
                    onFilterChange={handleFilterChange} 
                    availableParishes={availableParishes} 
                />

                {isLoading ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-lg font-medium text-gray-700">Cargando bandeja...</h2>
                    </div>
                ) : avisosRaw.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center">
                        <div className="bg-gray-50 p-5 rounded-full mb-4 text-gray-300 border border-gray-100">
                            <Inbox className="w-12 h-12" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Bandeja Vacía</h2>
                        <p className="text-gray-500 max-w-md">No hay avisos de notificación matrimonial recibidos para esta parroquia en este momento.</p>
                    </div>
                ) : (
                    <TablaAvisos 
                        avisos={filteredAvisos} 
                        onViewAviso={handleViewAviso} 
                        onMarkAsViewed={requestMarkAsViewed} 
                        onDeleteAviso={requestDeleteAviso}
                        currentParishName={currentParishName}
                    />
                )}
            </motion.div>

            <ModalVerAviso 
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                aviso={selectedAviso}
                documento={relatedDocumento}
                partida={relatedPartida}
                onMarkAsViewed={requestMarkAsViewed}
                onDeleteAviso={requestDeleteAviso}
                receptorInfo={currentParishInfo}
            />

            <ConfirmationDialog 
                isOpen={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={confirmMarkAsViewed}
                title="Marcar Aviso como Procesado"
                message="¿Confirma que ya ha realizado la búsqueda de la partida y ha asentado la nota marginal correspondiente? Esta acción marcará el aviso como procesado."
                confirmText="Sí, marcar como procesado"
            />

            <ConfirmationDialog 
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={confirmDeleteAviso}
                title="Eliminar Aviso"
                message="¿Está seguro de que desea eliminar este aviso de su bandeja? Esto desafectará cualquier partida de bautismo vinculada y restaurará la nota marginal original. Esta acción no se puede deshacer."
                confirmText={isDeleting ? "Eliminando..." : "Sí, eliminar aviso"}
                confirmButtonClass={`bg-red-600 hover:bg-red-700 text-white ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={isDeleting}
            />

        </DashboardLayout>
    );
};

export default AvisoNotificacionMatrimonialPage;