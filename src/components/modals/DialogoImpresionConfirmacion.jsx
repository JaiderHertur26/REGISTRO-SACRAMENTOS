import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText } from 'lucide-react';

const DialogoImpresionConfirmacion = ({ isOpen, onClose, onAccept, confirmationData }) => {
    const [copias, setCopias] = useState(1);
    const [firma, setFirma] = useState('');
    const [cargo, setCargo] = useState('Párroco');

    const handleAccept = () => {
        onAccept({ copias, firma, cargo });
    };

    if (!confirmationData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Opciones de Impresión">
            <div className="space-y-6 min-w-[400px]">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                    <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm">Documento a Imprimir</h4>
                        <p className="text-xs text-gray-600">Partida de Confirmación: {confirmationData.firstName} {confirmationData.lastName}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de Copias</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="5"
                            value={copias} 
                            onChange={(e) => setCopias(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Firma (Nombre del Sacerdote)</label>
                        <input 
                            type="text" 
                            value={firma} 
                            onChange={(e) => setFirma(e.target.value)}
                            placeholder="Ej. Pbro. Juan Pérez"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Deje en blanco para usar el nombre del párroco actual configurado.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                        <select
                            value={cargo}
                            onChange={(e) => setCargo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="Párroco">Párroco</option>
                            <option value="Vicario Parroquial">Vicario Parroquial</option>
                            <option value="Administrador Parroquial">Administrador Parroquial</option>
                            <option value="Secretario(a)">Secretario(a)</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button variant="outline" onClick={onClose}>
                        <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                    <Button onClick={handleAccept} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Printer className="w-4 h-4 mr-2" /> Imprimir
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DialogoImpresionConfirmacion;