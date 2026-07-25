import React, { useRef } from 'react';
import { X, Printer, BookOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmationPrintTemplate from '@/components/ConfirmationPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';

const ViewConfirmationPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const printComponentRef = useRef();

    if (!isOpen || !partida) return null;

    // --- LÓGICA LIMPIA ---
    let rawMarginText = partida.notaMarginal || partida.marginNote || partida.notaAlMargen || partida.observaciones || partida.observations || "";
    if (typeof rawMarginText === 'object') {
        rawMarginText = rawMarginText.text || JSON.stringify(rawMarginText);
    }
    
    // UI Banners
    const isDecreto = partida.isSupplementary || partida.correctionDecreeRef || partida.type === 'replacement' || partida.createdByDecree === 'replacement' || partida.creadoPorDecreto;
    const isAnulada = partida.status === 'anulada' || partida.isAnnulled || partida.estado === 'anulada';
    
    const displayNote = rawMarginText.trim() !== "" ? rawMarginText : "PARTIDA ESTÁNDAR (La nota oficial se generará al imprimir)";

    const handlePrint = () => {
        const printContent = printComponentRef.current;
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Imprimir Partida</title>');
        
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach((style) => { doc.write(style.outerHTML); });

        doc.write('</head><body class="bg-white" style="margin: 0; padding: 0;">');
        doc.write(printContent.innerHTML);
        doc.write('</body></html>');
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg shrink-0">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center flex-wrap gap-2">
                                <span className="bg-[#4B7BA7] text-white p-1.5 rounded-md text-xs font-bold uppercase tracking-wider">DOCUMENTO OFICIAL</span>
                                Partida de Confirmación
                                {isDecreto && <span className="bg-amber-100 text-amber-800 p-1.5 rounded-md text-xs border border-amber-200 shadow-sm font-bold">PARTIDA SUPLETORIA</span>}
                                {isAnulada && <span className="bg-red-100 text-red-800 p-1.5 rounded-md text-xs border border-red-200 shadow-sm flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3"/> REGISTRO ANULADO</span>}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-500" /></Button>
                        </div>

                        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex flex-col items-center gap-6">
                            <div className={`w-[8.5in] border-l-4 ${isAnulada ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'} p-4 rounded-r-lg shadow-sm print:hidden mb-2 relative overflow-hidden`}>
                                 <div className={`absolute top-0 right-0 -mr-6 -mt-6 opacity-10 pointer-events-none ${isAnulada ? 'text-red-900' : 'text-blue-900'}`}><BookOpen className="w-32 h-32" /></div>
                                 <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isAnulada ? 'text-red-800' : 'text-blue-800'}`}>
                                     <BookOpen className="w-4 h-4" /> Notas Originales en Base de Datos
                                 </h4>
                                 <div className={`relative z-10 font-mono text-sm leading-relaxed whitespace-pre-wrap ${isAnulada ? 'text-red-900' : 'text-blue-900'}`}>
                                     {displayNote}
                                 </div>
                            </div>

                            <div className="shadow-2xl bg-white print:shadow-none min-h-[11in] w-[8.5in] relative">
                                {isAnulada && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                                        <div className="transform -rotate-45 text-[8rem] font-black text-red-600 opacity-20 border-8 border-red-600 p-8 rounded-3xl">ANULADA</div>
                                    </div>
                                )}
                                <div ref={printComponentRef} className="relative z-10">
                                    <ConfirmationPrintTemplate data={partida} parrocoNombre={auxiliaryData?.parroco || 'PÁRROCO ENCARGADO'} cargo={'Párroco'} parroquiaInfo={auxiliaryData} />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white rounded-b-lg flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={onClose} className="border-gray-300">Cerrar</Button>
                            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2"><Printer className="w-4 h-4" /> Imprimir Partida</Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ViewConfirmationPartidaModal;