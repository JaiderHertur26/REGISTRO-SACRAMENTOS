import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { Eye, Printer, ExternalLink, FileText, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VistaImprimibleDocumentoRespaldo from '@/components/VistaImprimibleDocumentoRespaldo';
import { validarPersonaNoTieneConyuge } from '@/utils/matrimonialNotificationValidation';
import { useAppData } from '@/context/AppDataContext';
import { desafectarPartidaBautismo } from '@/utils/matrimonialNotificationHelpers';

const TablaRespaldos = ({ documentos, onViewDocument, onUpdateDocument, catalogParishes }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { deleteNotificacionMatrimonial } = useAppData();
    
    const [documentosState, setDocumentosState] = useState([]);
    const [documentoParaImprimir, setDocumentoParaImprimir] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const printRef = useRef(null);

    useEffect(() => {
        setDocumentosState(documentos);
    }, [documentos]);

    const sortedDocs = [...documentosState].sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const getParishName = (parishId) => {
        if (!parishId) return 'Interna (Misma Parroquia)';
        const found = catalogParishes.find(p => p.id === parishId);
        return found ? found.name : 'Desconocida';
    };

    const handleImprimir = (documento) => {
        if (!documento || (!documento.id && !documento.consecutivo)) {
            toast({
                title: 'Error',
                description: 'El documento no es válido o está incompleto.',
                variant: 'destructive'
            });
            return;
        }
        setDocumentoParaImprimir(documento);
    };

    const handlePrintAction = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Respaldo_Notificacion_${documentoParaImprimir?.consecutivo || 'Documento'}`
    });

    const handleAbrirPartida = (baptismPartidaId) => {
        if (!baptismPartidaId) {
            toast({
                title: 'Error',
                description: 'Error: No se puede abrir la partida - ID no encontrado',
                variant: 'destructive'
            });
            return;
        }
        navigate(`/parroquia/bautismo/${baptismPartidaId}`);
    };

    const handleEliminarAviso = async (row) => {
        if (window.confirm("¿Está seguro de que desea eliminar este aviso de notificación matrimonial? Ambas partidas de bautismo serán desafectadas.")) {
            setIsDeleting(true);
            try {
                // 1. Unlink baptism for main person
                if (row.baptismPartidaId) {
                    await desafectarPartidaBautismo(row.baptismPartidaId, row.parishId);
                }
                
                // Unlink baptism for spouse
                if (row.spouseBaptismPartidaId) {
                    const spouseParish = row.spouseBaptismParishId || row.parishId;
                    await desafectarPartidaBautismo(row.spouseBaptismPartidaId, spouseParish);
                }
                
                // 2. Delete the notification
                if (deleteNotificacionMatrimonial) {
                    const res = deleteNotificacionMatrimonial(row.id);
                    if (!res.success) {
                        throw new Error(res.message || "Error al eliminar documento del almacenamiento.");
                    }
                }
                
                // 3. Update local state
                setDocumentosState(prev => prev.filter(d => d.id !== row.id));
                
                toast({
                    title: "Eliminado Exitosamente",
                    description: "Aviso eliminado correctamente. Ambas partidas han sido desafectadas.",
                    className: "bg-green-600 text-white"
                });
                
            } catch (error) {
                console.error("Error eliminando aviso:", error);
                alert("Error al eliminar el aviso: " + (error.message || "Error desconocido."));
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const tieneConyugeRegistrado = (nombrePersona) => {
        const validacion = validarPersonaNoTieneConyuge(nombrePersona, documentosState);
        return !validacion.valido;
    };

    const columns = [
        {
            header: 'Consecutivo',
            accessor: 'consecutivo',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-900">{row.consecutivo}</span>
                </div>
            )
        },
        {
            header: 'Persona',
            accessor: 'personName',
            render: (row) => <span className="font-medium text-gray-800">{row.personName}</span>
        },
        {
            header: 'Cónyuge',
            accessor: 'spouseName',
            render: (row) => {
                const docStatus = (row.status || '').toLowerCase();
                const isActive = docStatus !== 'anulado' && docStatus !== 'cancelado';
                const hasSpouseRegistered = isActive && tieneConyugeRegistrado(row.personName);

                return (
                    <div className="flex items-center gap-2">
                        <span className={hasSpouseRegistered ? "text-gray-500" : "text-gray-600"}>
                            {row.spouseName}
                        </span>
                        {hasSpouseRegistered && (
                            <AlertCircle 
                                className="w-4 h-4 text-red-500 shrink-0" 
                                title={`${row.personName} ya tiene cónyuge registrado. No se puede crear otro aviso.`}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Parroquia Receptora',
            accessor: 'receiverParishId',
            render: (row) => <span className="text-gray-600 text-sm">{getParishName(row.receiverParishId)}</span>
        },
        {
            header: 'Fecha',
            accessor: 'createdAt',
            render: (row) => {
                const d = new Date(row.createdAt || Date.now());
                return <span className="text-gray-500 text-sm">{d.toLocaleDateString()}</span>;
            }
        },
        {
            header: 'Estado',
            accessor: 'status',
            render: (row) => {
                const status = (row.status || 'generado').toLowerCase();
                let badgeClass = 'bg-gray-100 text-gray-700';
                
                if (status === 'generado') badgeClass = 'bg-blue-100 text-blue-800';
                if (status === 'visto') badgeClass = 'bg-green-100 text-green-800';
                if (status === 'archivado') badgeClass = 'bg-purple-100 text-purple-800';
                if (status === 'anulado' || status === 'cancelado') badgeClass = 'bg-red-100 text-red-800';

                return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${badgeClass}`}>
                        {status}
                    </span>
                );
            }
        }
    ];

    const actions = [
        {
            label: 'Ver',
            icon: Eye,
            onClick: (row) => onViewDocument(row),
            className: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        },
        {
            label: 'Abrir Partida',
            icon: ExternalLink,
            onClick: (row) => handleAbrirPartida(row.baptismPartidaId),
            className: "text-green-600 hover:text-green-800 hover:bg-green-50",
            title: "Ir a la partida de bautismo de la persona",
            disabled: isDeleting
        },
        {
            label: 'Eliminar',
            icon: isDeleting ? Loader2 : Trash2,
            onClick: (row) => handleEliminarAviso(row),
            className: "text-red-600 hover:text-red-800 hover:bg-red-50",
            title: "Eliminar aviso de notificación matrimonial",
            disabled: isDeleting
        }
    ];

    if (sortedDocs.length === 0) {
        return (
            <div className="bg-white p-12 text-center rounded-lg border border-gray-200 shadow-sm">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No hay documentos</h3>
                <p className="text-gray-500">No se encontraron respaldos que coincidan con los criterios de búsqueda.</p>
            </div>
        );
    }

    const emisorInfo = documentoParaImprimir ? catalogParishes.find(p => p.id === documentoParaImprimir.parishId) : null;
    const receptorInfo = documentoParaImprimir ? catalogParishes.find(p => p.id === documentoParaImprimir.receiverParishId) : null;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <Table 
                columns={columns} 
                data={sortedDocs} 
                actions={actions}
            />

            <Modal 
                isOpen={!!documentoParaImprimir} 
                onClose={() => setDocumentoParaImprimir(null)} 
                title="Vista Previa de Impresión"
            >
                <div className="flex flex-col h-[70vh]">
                    <div className="flex justify-end gap-2 mb-4 shrink-0">
                        <Button variant="outline" onClick={() => setDocumentoParaImprimir(null)}>
                            Cerrar
                        </Button>
                        <Button onClick={handlePrintAction} className="flex items-center gap-2">
                            <Printer className="w-4 h-4" />
                            Imprimir Documento
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-auto border border-gray-200 bg-gray-50 p-4 rounded-md">
                        {documentoParaImprimir && (
                            <VistaImprimibleDocumentoRespaldo 
                                ref={printRef} 
                                documento={documentoParaImprimir} 
                                emisorInfo={emisorInfo}
                                receptorInfo={receptorInfo}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TablaRespaldos;