import React, { useRef, useState, useEffect } from 'react';
import { 
    X, Printer, BookOpen, Fingerprint, 
    ShieldCheck, CheckCircle2, AlertCircle, Info,
    User, Users, MapPin, PenTool, AlertOctagon, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaptismPrintTemplate from '@/components/BaptismPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';

const InfoCard = ({ label, val, icon: Icon }) => (
    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-center gap-4">
        <div className="bg-blue-50 p-2.5 rounded-xl text-[#4B7BA7]"><Icon className="w-4 h-4"/></div>
        <div className="text-left">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
            <span className="text-xs font-black text-gray-800 uppercase tracking-tight line-clamp-1">{val}</span>
        </div>
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

const ViewBaptismPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const componenteImpresionRef = useRef();
    const { getParrocos } = useAppData(); 

    // 🚀 ESTADOS PARA LAS NOTAS MARGINALES A LA CARTA
    const [marginalNotes, setMarginalNotes] = useState([]);
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [templates, setTemplates] = useState({});

    const parishId = partida?.parishId || partida?.parish_id || auxiliaryData?.entity_id || auxiliaryData?.id;

    // 🚀 1. EL MOTOR DE BÚSQUEDA CRUZADA (MAGIA PURA)
    useEffect(() => {
        if (isOpen && parishId) {
            const storedData = localStorage.getItem(`marginalNotesTemplates_${parishId}`);
            if (storedData) setTemplates(JSON.parse(storedData));
        }
        
        if (isOpen && partida) {
            const fetchAllNotes = async () => {
                let allNotes = [];

                // A. Buscar Notas Manuales (Decretos, Anulaciones)
                if (partida.id) {
                    const { data: mnData, error: mnError } = await supabase
                        .from('marginal_notes')
                        .select('*')
                        .eq('sacrament_id', partida.id)
                        .order('created_at', { ascending: true });
                    
                    if (!mnError && mnData) {
                        allNotes = [...allNotes, ...mnData];
                    }
                }

                // B. BÚSQUEDA AUTOMÁTICA DE CONFIRMACIÓN (Cruce de Sacramentos)
                if (partida.nombres && partida.apellidos) {
                    const cleanNombres = partida.nombres.trim();
                    const cleanApellidos = partida.apellidos.trim();

                    const { data: confData, error: confError } = await supabase
                        .from('confirmations')
                        .select('*')
                        .eq('parish_id', parishId)
                        .ilike('nombres', cleanNombres)
                        .ilike('apellidos', cleanApellidos);

                    if (!confError && confData && confData.length > 0) {
                        // Rescatamos la plantilla inteligente
                        const storedTemplates = localStorage.getItem(`marginalNotesTemplates_${parishId}`);
                        const tempObj = storedTemplates ? JSON.parse(storedTemplates) : {};
                        const templateConf = tempObj.bautismo_confirmado || "EL [FECHA_CONFIRMACION] FUE CONFIRMADO(A) EN LA PARROQUIA [PARROQUIA_CONFIRMACION]. DIÓCESIS DE [DIOCESIS_CONFIRMACION]. L-[LIBRO_CONF], F-[FOLIO_CONF], N-[NUMERO_CONF].";

                        confData.forEach(conf => {
                            // Parseo seguro de fecha
                            const d = new Date((conf.celebration_date || '').includes('T') ? conf.celebration_date : `${conf.celebration_date}T12:00:00`);
                            const dateStr = !isNaN(d.getTime()) ? `${d.getDate()} DE ${d.toLocaleString('es-CO', { month: 'long' }).toUpperCase()} DE ${d.getFullYear()}` : conf.celebration_date;

                            // Inyección de variables
                            const content = templateConf
                                .replace('[FECHA_CONFIRMACION]', dateStr)
                                .replace('[PARROQUIA_CONFIRMACION]', (auxiliaryData?.nombre || 'ESTA PARROQUIA').toUpperCase())
                                .replace('[DIOCESIS_CONFIRMACION]', (auxiliaryData?.diocesis || 'ARQUIDIÓCESIS DE BARRANQUILLA').toUpperCase())
                                .replace('[LIBRO_CONF]', String(conf.book_number || '').padStart(4, '0'))
                                .replace('[FOLIO_CONF]', String(conf.folio || '').padStart(4, '0'))
                                .replace('[NUMERO_CONF]', String(conf.number || '').padStart(4, '0'));

                            allNotes.push({
                                id: `auto-conf-${conf.id}`,
                                note_type: 'CONFIRMACIÓN (CRUCE AUTOMÁTICO)',
                                note_date: conf.celebration_date,
                                content: content,
                                isAuto: true
                            });
                        });
                    }
                }

                setMarginalNotes(allNotes);
                // Marcamos todas por defecto
                setSelectedNotes(allNotes.map(n => n.id));
            };
            
            fetchAllNotes();
        }
    }, [isOpen, partida, parishId, auxiliaryData]);

    if (!isOpen || !partida) return null;

    // 🚀 2. CONSTRUCCIÓN DEL MENÚ A LA CARTA
    const baseNotaOriginal = partida.notaMarginal && partida.notaMarginal !== "---" ? partida.notaMarginal : "";
    const mandatoryNote = templates.certificacion_estandar || "LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO.";
    
    const selectedNotesContent = marginalNotes
        .filter(n => selectedNotes.includes(n.id))
        .map(n => n.content)
        .join(' // ');

    let finalNotaMarginalFormada = [];
    if (baseNotaOriginal) finalNotaMarginalFormada.push(baseNotaOriginal);
    if (selectedNotesContent) finalNotaMarginalFormada.push(selectedNotesContent);

    let finalNotaMarginal = '';
    if (finalNotaMarginalFormada.length > 0) {
        const cleanMandatory = mandatoryNote.replace(/SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA\.?/i, '').trim();
        finalNotaMarginal = `${finalNotaMarginalFormada.join(' // ')} // ${cleanMandatory}`.trim();
    } else {
        finalNotaMarginal = mandatoryNote;
    }

    // 🚀 3. RESOLVER EL "DA FE" HISTÓRICO
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
    
    // Inyectamos todo en el objeto que recibe el PDF
    const partidaParaImprimir = { ...partida, daFe: rawDaFe, notaMarginal: finalNotaMarginal };

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
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Impresión de Partida</h2>
                                        <div className="flex gap-2">
                                            {estaAnulada && <Badge color="red" icon={AlertCircle} label="Anulada" />}
                                            {esReposicion && <Badge color="amber" icon={ShieldCheck} label="Reposición" />}
                                            {!estaAnulada && <Badge color="green" icon={CheckCircle2} label="Vigente" />}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Configure las notas al margen antes de imprimir</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900">
                                <X className="w-7 h-7" />
                            </button>
                        </div>

                        {/* VISUALIZADOR Y CONFIGURADOR */}
                        <div className="flex-1 overflow-y-auto bg-slate-200/50 p-6 md:p-12 flex flex-col items-center gap-6 custom-scrollbar">
                            
                            {/* Panel de Ubicación Física */}
                            <div className="w-full max-w-[8.5in] grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoCard 
                                    label="Ubicación en Archivo" 
                                    val={`Libro ${partida.Libro} • Folio ${partida.folio} • Acta ${partida.numero}`} 
                                    icon={BookOpen}
                                />
                                <InfoCard 
                                    label="Bautizado" 
                                    val={`${partida.apellidos} ${partida.nombres}`} 
                                    icon={User}
                                />
                            </div>

                            {/* 🚀 SELECTOR INTELIGENTE DE NOTAS MARGINALES A LA CARTA */}
                            <div className="w-full max-w-[8.5in] bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] border border-gray-200 shadow-sm mt-2 mb-4">
                                <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-3">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><FileText className="w-4 h-4"/></div>
                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Configuración de Notas a Imprimir</h4>
                                </div>
                                
                                <div className="space-y-3">
                                    {baseNotaOriginal && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 opacity-60">
                                            <input type="checkbox" checked disabled className="mt-1 w-4 h-4 text-gray-400 rounded cursor-not-allowed" />
                                            <div className="flex-1">
                                                <span className="text-[10px] font-black uppercase text-gray-500 block mb-0.5">Nota Original de la Partida Física</span>
                                                <p className="text-[11px] font-bold text-gray-700 uppercase italic leading-relaxed">"{baseNotaOriginal}"</p>
                                            </div>
                                        </div>
                                    )}

                                    {marginalNotes.length > 0 ? (
                                        marginalNotes.map(note => (
                                            <label key={note.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#4B7BA7]/30 bg-blue-50/20 hover:bg-blue-50/50 cursor-pointer transition-colors shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedNotes.includes(note.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedNotes([...selectedNotes, note.id]);
                                                        else setSelectedNotes(selectedNotes.filter(id => id !== note.id));
                                                    }}
                                                    className="mt-1 w-4 h-4 text-[#4B7BA7] rounded focus:ring-[#4B7BA7] cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-black uppercase text-[#4B7BA7] block mb-0.5 border-b border-blue-100/50 pb-1 flex items-center gap-1.5">
                                                        {note.isAuto && <ShieldCheck className="w-3 h-3" />} {note.note_type}
                                                    </span>
                                                    <p className="text-xs font-bold text-gray-800 uppercase italic leading-relaxed mt-1">"{note.content}"</p>
                                                </div>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-[11px] font-bold text-gray-400 uppercase italic px-2">No se encontraron anexos ni cruces sacramentales para este bautizado.</p>
                                    )}
                                    
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                        <input type="checkbox" checked disabled className="mt-1 w-4 h-4 text-slate-400 rounded cursor-not-allowed opacity-50" />
                                        <div className="flex-1">
                                            <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Certificación (Obligatoria)</span>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase italic leading-relaxed">
                                                "{mandatoryNote}"
                                            </p>
                                        </div>
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
                                            data={partidaParaImprimir} // 🚀 El PDF recibe la súper Nota Marginal Concatenada
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
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Registro Preparado
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
                                    <Printer className="w-5 h-5" /> Imprimir Partida Oficial
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