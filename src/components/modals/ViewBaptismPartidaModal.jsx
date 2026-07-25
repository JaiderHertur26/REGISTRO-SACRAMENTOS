import React, { useRef } from 'react';
import { 
    X, Printer, BookOpen, Fingerprint, 
    ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaptismPrintTemplate from '@/components/BaptismPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ViewBaptismPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const componenteImpresionRef = useRef();

    if (!isOpen || !partida) return null;

    // =========================================================================
    // 🧠 LÓGICA DE ESTADOS (Vinculada a BD_BautizosPage)
    // =========================================================================
    const notaVisual = partida.notaMarginal && partida.notaMarginal !== "---" 
        ? partida.notaMarginal 
        : "REGISTRO SIN NOTAS MARGINALES ADICIONALES (CERTIFICACIÓN ESTÁNDAR).";

    const estaAnulada = partida.tipoIdentidad === 'id_anulada_correccion' || partida.estado === 'anulada';
    const esReposicion = partida.tipoIdentidad === 'id_creada_reposicion';

    // =========================================================================
    // 🖨️ MOTOR DE IMPRESIÓN (Calidad Documental)
    // =========================================================================
    const ejecutarImpresion = () => {
        const contenido = componenteImpresionRef.current;
        if (!contenido) return;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Impresión Oficial - Sistema Parroquial</title>');
        
        // Inyectamos estilos para que la tipografía Courier se mantenga
        const estilos = document.querySelectorAll('style, link[rel="stylesheet"]');
        estilos.forEach(s => doc.write(s.outerHTML));
        
        // 🚀 MODIFICACIÓN CRUCIAL AQUÍ: Forzamos la impresión de fondos (las líneas de cuaderno)
        doc.write('</head><body style="margin:0; padding:0; background:white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">');
        
        doc.write(contenido.innerHTML);
        doc.write('</body></html>');
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 md:p-8">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-white/20"
                    >
                        {/* CABECERA DE CONTROL */}
                        <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-5">
                                <div className={cn(
                                    "p-3 rounded-2xl text-white shadow-lg",
                                    estaAnulada ? "bg-red-500 shadow-red-500/20" : "bg-[#4B7BA7] shadow-blue-900/20"
                                )}>
                                    <Fingerprint className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Inspección de Partida</h2>
                                        <div className="flex gap-2">
                                            {estaAnulada && <Badge color="red" icon={AlertCircle} label="Anulada" />}
                                            {esReposicion && <Badge color="amber" icon={ShieldCheck} label="Reposición" />}
                                            {!estaAnulada && <Badge color="green" icon={CheckCircle2} label="Vigente" />}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronizado con Base de Datos Central</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900">
                                <X className="w-7 h-7" />
                            </button>
                        </div>

                        {/* VISUALIZADOR DE DOCUMENTO */}
                        <div className="flex-1 overflow-y-auto bg-slate-200/50 p-6 md:p-12 flex flex-col items-center gap-10 custom-scrollbar">
                            
                            {/* Panel de Ubicación Física */}
                            <div className="w-full max-w-[8.5in] grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InfoCard 
                                    label="Ubicación en Archivo" 
                                    val={`Libro ${partida.Libro} • Folio ${partida.folio} • Acta ${partida.numero}`} 
                                    icon={BookOpen}
                                />
                                <div className="md:col-span-2 bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><AlertCircle className="w-4 h-4"/></div>
                                    <div className="flex-1">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nota Marginal Proyectada</span>
                                        <p className="text-[11px] font-bold text-gray-600 leading-relaxed italic line-clamp-2 uppercase">"{notaVisual}"</p>
                                    </div>
                                </div>
                            </div>

                            {/* EL DOCUMENTO (VISTA PREVIA DE IMPRESIÓN) */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-tr from-[#D4AF37]/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                <div className="relative shadow-[0_30px_100px_rgba(0,0,0,0.18)] bg-white w-full max-w-[8.5in] min-h-[11in] transform transition-transform duration-700">
                                    
                                    {estaAnulada && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden select-none">
                                            <div className="transform -rotate-45 text-[12rem] font-black text-red-600/5 border-[30px] border-red-600/5 p-20 rounded-[100px] uppercase tracking-tighter">
                                                Anulada
                                            </div>
                                        </div>
                                    )}

                                    {/* Componente de Impresión Final */}
                                    <div ref={componenteImpresionRef} className="print-root">
                                        {/* 🚀 Llama a nuestro componente ya actualizado con el Tipo de Unión */}
                                        <BaptismPrintTemplate 
                                            data={partida} 
                                            parroquiaInfo={auxiliaryData} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ACCIONES FINALES */}
                        <div className="px-10 py-8 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0">
                            <div className="flex items-center gap-6 text-left">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Estado de Integridad</span>
                                    <span className="text-xs font-bold text-green-500 flex items-center gap-1.5 uppercase">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Registro Firmado
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
                                <div className="hidden md:flex flex-col">
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Identificador Nube</span>
                                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-tighter">{partida.id?.substring(0, 20)}...</span>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full sm:w-auto">
                                <Button variant="ghost" onClick={onClose} className="px-10 py-7 rounded-2xl font-black uppercase text-[10px] text-gray-400 hover:text-gray-600">
                                    Cerrar Vista
                                </Button>
                                <Button 
                                    onClick={ejecutarImpresion} 
                                    className="flex-1 sm:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white shadow-xl shadow-blue-900/20 font-black px-12 py-7 rounded-2xl gap-3 transition-all transform active:scale-95 text-[11px] uppercase tracking-widest"
                                >
                                    <Printer className="w-5 h-5" /> Imprimir Acta
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// --- COMPONENTES AUXILIARES ---
const Badge = ({ color, icon: Icon, label }) => {
    const colors = {
        red: "bg-red-50 text-red-700 border-red-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        green: "bg-green-50 text-green-700 border-green-100"
    };
    return (
        <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1.5 shadow-sm", colors[color])}>
            <Icon className="w-3 h-3" /> {label}
        </div>
    );
};

const InfoCard = ({ label, val, icon: Icon }) => (
    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-center gap-4">
        <div className="bg-blue-50 p-2.5 rounded-xl text-[#4B7BA7]"><Icon className="w-4 h-4"/></div>
        <div className="text-left">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
            <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{val}</span>
        </div>
    </div>
);

export default ViewBaptismPartidaModal;