import React, { useRef } from 'react';
import { 
    X, Printer, BookOpen, Fingerprint, 
    ShieldCheck, CheckCircle2, AlertCircle, Info,
    User, Users, MapPin, PenTool, AlertOctagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaptismPrintTemplate from '@/components/BaptismPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppData } from '@/context/AppDataContext'; // 🚀 Necesario para acceder a los sacerdotes

// --- COMPONENTE: PANEL DE DETALLES EXTENDIDO (INSPECCIÓN PARROQUIAL) ---
const InfoBox = ({ data, parishId, getParrocos }) => {
    if (!data) return null;
    
    const isReplacement = data.isSupplementary || data.tipoIdentidad === 'id_creada_reposicion';

    // Limpieza de Ministro
    const getResolvedMinistro = () => {
        let min = data.ministro;
        if (!min || !isNaN(Number(String(min).trim()))) return '---';
        min = String(min).replace(/^(PBRO\.?\s*|PADRE\s*|SACERDOTE\s*)/i, '').trim();
        return `PBRO. ${min}`;
    };

    // 🚀 RESOLUCIÓN INTELIGENTE DEL PÁRROCO QUE DA FE (MÁQUINA DEL TIEMPO)
    const getResolvedDaFe = () => {
        let rawDaFe = data.daFe || data.dafe || data.da_fe;
        
        // Si está vacío, es número (viejo sistema) o dice encargado
        if (!rawDaFe || rawDaFe === '---' || rawDaFe.includes('ENCARGADO') || !isNaN(Number(String(rawDaFe).trim()))) {
            
            // 1. Clonar desde Ministro si es válido
            let ministroRaw = data.ministro;
            if (ministroRaw && isNaN(Number(String(ministroRaw).trim()))) {
                rawDaFe = ministroRaw.toUpperCase();
            } 
            // 2. Máquina del Tiempo
            else if (parishId && getParrocos) {
                const sacerdotes = getParrocos(parishId) || [];
                if (data.fechaSacramento) {
                    const fechaSac = new Date(data.fechaSacramento.includes('T') ? data.fechaSacramento : `${data.fechaSacramento}T12:00:00`);
                    const sacerdoteEpoca = sacerdotes.find(s => {
                        if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                        const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                        const inicio = new Date(iStr);
                        const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                        return fechaSac >= inicio && fechaSac <= fin;
                    });
                    if (sacerdoteEpoca) rawDaFe = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
                }
                
                // 3. Fallback: Actual
                if (!rawDaFe || rawDaFe === '---' || !isNaN(Number(String(rawDaFe).trim()))) {
                    const actual = sacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
                    if (actual) rawDaFe = `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase();
                }
            }
        }
        
        if (!rawDaFe || !isNaN(Number(String(rawDaFe).trim()))) rawDaFe = 'EL PÁRROCO';
        rawDaFe = String(rawDaFe).replace(/^(PBRO\.?\s*|PADRE\s*|SACERDOTE\s*)/i, '').trim();
        return rawDaFe !== 'EL PÁRROCO' ? `PBRO. ${rawDaFe}` : rawDaFe;
    };

    return (
        <div className="mt-8 border border-slate-200/80 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
                <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                   <Info className="w-4 h-4 text-[#D4AF37]" /> Inspección de Registro Parroquial
                </h3>
                {isReplacement && (
                    <span className="bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <AlertOctagon className="w-3 h-3"/> Acta por Decreto
                    </span>
                )}
            </div>

            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Localización Física</span>
                        <span className="text-base font-black text-[#4B7BA7] font-mono bg-white px-4 py-2 rounded-xl border border-blue-100 inline-block shadow-sm">
                            L:{data.Libro} • F:{data.folio} • N:{data.numero}
                        </span>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Bautizado (Apellidos y Nombres)</span>
                        <span className="text-xl font-black text-slate-900 uppercase tracking-tight block">
                            {data.apellidos} {data.nombres}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DetailItem icon={MapPin} label="Lugar Nacimiento" value={data.lugarNacimiento} />
                    <DetailItem icon={User} label="Fecha Nacimiento" value={data.fechaNacimiento} />
                    <DetailItem icon={MapPin} label="Lugar Bautismo" value={data.lugarBautismo} />
                    <DetailItem icon={User} label="Fecha Bautismo" value={data.fechaSacramento} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50/20 p-6 rounded-[2rem] border border-blue-100/50 space-y-4">
                        <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-blue-600" /> Línea Paterna
                        </h4>
                        <DetailItem label="Padre" value={data.nombrePadre} />
                        <DetailItem label="Abuelos Paternos" value={data.abuelosPaternos} isItalic />
                    </div>
                    <div className="bg-pink-50/20 p-6 rounded-[2rem] border border-pink-100/50 space-y-4">
                        <h4 className="text-[10px] font-black text-pink-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-pink-600" /> Línea Materna
                        </h4>
                        <DetailItem label="Madre" value={data.nombreMadre} />
                        <DetailItem label="Abuelos Maternos" value={data.abuelosMaternos} isItalic />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <DetailItem icon={Users} label="Padrinos" value={data.padrinos} />
                    <DetailItem icon={PenTool} label="Ministro Celebrante" value={getResolvedMinistro()} />
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#D4AF37]" /> Párroco que Da Fe
                        </span>
                        <span className="text-xs font-black text-[#4B7BA7] uppercase bg-white px-3 py-1.5 rounded-xl border border-blue-100 inline-block shadow-sm">
                            {getResolvedDaFe()}
                        </span>
                    </div>
                </div>

                <div className="p-6 rounded-[2rem] border bg-amber-50/30 border-amber-200/60 shadow-sm">
                    <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" /> Nota Marginal
                    </h4>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed font-mono uppercase italic">
                        "{data.notaMarginal || 'SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.'}"
                    </p>
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ icon: Icon, label, value, isItalic = false }) => (
    <div className="space-y-1 text-left">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3 text-slate-400" />} {label}
        </span>
        <span className={`text-xs font-bold text-slate-800 uppercase block ${isItalic ? 'italic font-medium text-slate-500' : ''}`}>
            {value || '---'}
        </span>
    </div>
);

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


const ViewBaptismPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const componenteImpresionRef = useRef();
    const { getParrocos } = useAppData(); // 🚀 Importamos getParrocos

    if (!isOpen || !partida) return null;

    const parishId = partida.parishId || partida.parish_id || auxiliaryData?.entity_id || auxiliaryData?.id;

    // 🚀 OBTENEMOS EL "DA FE" HISTÓRICO PARA INYECTARLO AL PDF
    let rawDaFe = partida.daFe || partida.dafe || partida.da_fe;
    if (!rawDaFe || rawDaFe === '---' || rawDaFe.includes('ENCARGADO') || !isNaN(Number(String(rawDaFe).trim()))) {
        let ministroRaw = partida.ministro;
        if (ministroRaw && isNaN(Number(String(ministroRaw).trim()))) {
            rawDaFe = ministroRaw.toUpperCase();
        } else if (parishId && getParrocos) {
            const sacerdotes = getParrocos(parishId) || [];
            if (partida.fechaSacramento) {
                const fechaSac = new Date(partida.fechaSacramento.includes('T') ? partida.fechaSacramento : `${partida.fechaSacramento}T12:00:00`);
                const sacerdoteEpoca = sacerdotes.find(s => {
                    if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                    const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                    const inicio = new Date(iStr);
                    const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                    return fechaSac >= inicio && fechaSac <= fin;
                });
                if (sacerdoteEpoca) rawDaFe = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
            }
        }
    }
    
    // Inyectamos el Sacerdote Histórico calculado temporalmente al objeto partida para que el PDF lo lea
    const partidaParaImprimir = { ...partida, daFe: rawDaFe };

    const notaVisual = partida.notaMarginal && partida.notaMarginal !== "---" 
        ? partida.notaMarginal 
        : "REGISTRO SIN NOTAS MARGINALES ADICIONALES (CERTIFICACIÓN ESTÁNDAR).";

    const estaAnulada = partida.tipoIdentidad === 'id_anulada_correccion' || partida.estado === 'anulada';
    const esReposicion = partida.tipoIdentidad === 'id_creada_reposicion';

    const ejecutarImpresion = () => {
        const contenido = componenteImpresionRef.current;
        if (!contenido) return;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Impresión Oficial - Sistema Parroquial</title>');
        
        const estilos = document.querySelectorAll('style, link[rel="stylesheet"]');
        estilos.forEach(s => doc.write(s.outerHTML));
        
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
                                        <BaptismPrintTemplate 
                                            data={partidaParaImprimir} // 🚀 Pasamos el objeto con el Sacerdote Histórico Inyectado
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

export default ViewBaptismPartidaModal;