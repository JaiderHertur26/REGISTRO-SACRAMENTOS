import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, FolderOpen } from 'lucide-react';

const ConfirmacionNotificacion = ({ isOpen, documento, onViewDocument, onGoToBackups, onClose }) => {
    if (!isOpen || !documento) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notificación Creada">
            <div className="flex flex-col items-center justify-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                    Notificación Matrimonial Creada Exitosamente
                </h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full mt-4 mb-6">
                    <div className="text-center mb-4">
                        <span className="text-sm text-gray-500 font-bold uppercase">Consecutivo Generado</span>
                        <div className="text-lg font-mono font-bold text-blue-700 mt-1">{documento.consecutivo}</div>
                    </div>
                    
                    <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Persona:</span>
                            <span className="font-semibold text-gray-900">{documento.personName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Cónyuge:</span>
                            <span className="font-semibold text-gray-900">{documento.spouseName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Fecha Matrimonio:</span>
                            <span className="font-semibold text-gray-900">{documento.marriageDate}</span>
                        </div>
                        {documento.marginNoteApplied && (
                             <div className="mt-3 bg-green-50 p-2 rounded text-xs text-green-800 font-medium text-center border border-green-200">
                                 Nota marginal aplicada automáticamente a la partida de bautismo.
                             </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 w-full">
                    <Button onClick={onGoToBackups} variant="outline" className="flex-1 flex justify-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Ir al Dashboard
                    </Button>
                    {onViewDocument && (
                        <Button onClick={onViewDocument} className="flex-1 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] flex justify-center gap-2">
                            <FileText className="w-4 h-4" /> Ver Documento
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmacionNotificacion;