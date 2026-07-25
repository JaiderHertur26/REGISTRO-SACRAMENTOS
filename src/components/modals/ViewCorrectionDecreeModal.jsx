import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrintCorrectionDecree from '@/components/PrintCorrectionDecree';

const ViewCorrectionDecreeModal = ({ isOpen, onClose, decreeData }) => {
    const printComponentRef = useRef();

    if (!isOpen || !decreeData) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 p-1.5 rounded-md text-xs">VISTA PREVIA</span>
                        Decreto de Corrección No. {decreeData.decreeNumber}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-200">
                        <X className="w-5 h-5 text-gray-500" />
                    </Button>
                </div>

                {/* Content - Scrollable Preview Area */}
                <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
                    <div className="shadow-2xl print:shadow-none">
                        <PrintCorrectionDecree 
                            ref={printComponentRef} 
                            decreeData={decreeData} 
                        />
                    </div>
                </div>

                {/* Footer - Actions */}
                <div className="p-4 border-t border-gray-100 bg-white rounded-b-lg flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="border-gray-300">
                        Cerrar
                    </Button>
                    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2">
                        <Printer className="w-4 h-4" />
                        Imprimir Decreto
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ViewCorrectionDecreeModal;