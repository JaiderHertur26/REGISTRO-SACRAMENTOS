import React, { useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, X, FileText, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import VistaImprimibleDocumento from './VistaImprimibleDocumento';
import { obtenerParroquiaEmisoraInfo } from '@/utils/matrimonialNotificationAvisoHelpers';
import { useAppData } from '@/context/AppDataContext'; // 🚀 IMPORTADO PARA LA MÁQUINA DEL TIEMPO

// --- FUNCIONES DE FORMATEO Y TRADUCCIÓN ---
const formatearFecha = (fecha) => {
    if (!fecha) return '';
    try {
        const datePart = typeof fecha === 'string' && fecha.includes('T') ? fecha.split('T')[0] : fecha;
        if (typeof datePart === 'string' && datePart.includes('-')) {
            const [year, month, day] = datePart.split('-');
            const date = new Date(year, parseInt(month) - 1, day);
            if (!isNaN(date.getTime())) {
                return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
            }
        }
        const dateObj = new Date(fecha);
        if (!isNaN(dateObj.getTime())) {
            return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
        }
        return fecha;
    } catch (e) {
        return fecha;
    }
};

const resolverNombreCatalogo = (idOrName, keyCatalogo) => {
    if (!idOrName || typeof idOrName !== 'string') return idOrName || '';
    if (idOrName.length === 36 && idOrName.includes('-')) {
        try {
            const items = JSON.parse(localStorage.getItem(keyCatalogo) || '[]');
            const encontrado = items.find(i => i.id === idOrName);
            return encontrado ? (encontrado.name || encontrado.nombre || idOrName) : idOrName;
        } catch(e) {
            return idOrName;
        }
    }
    return idOrName;
};

const reemplazarVariablesNotificacion = (texto, datos) => {
    if (!texto) return '';
    let resultado = texto;
    const map = {
        '[FECHA_NOTIFICACION]': datos.fechaNotificacion,
        '[FECHA_MATRIMONIO]': datos.fechaMatrimonio,
        '[PARROQUIA_MATRIMONIO]': datos.parroquiaMatrimonio,
        '[DIOCESIS_MATRIMONIO]': datos.diocesisMatrimonio,
        '[NOMBRE_CONYUGE]': datos.nombreConyuge,
        '[LIBRO_MAT]': datos.libroMatrimonio,
        '[FOLIO_MAT]': datos.folioMatrimonio,
        '[NUMERO_MAT]': datos.numeroMatrimonio,
        '[FECHA_EXPEDICION]': datos.fechaExpedicion,
        '[MINISTRO]': datos.ministro, // 🚀 AÑADIDO
        '[DA_FE]': datos.ministro    // 🚀 AÑADIDO
    };
    for (const [variable, valor] of Object.entries(map)) {
        if (valor !== undefined && valor !== null && valor !== '') {
            resultado = resultado.split(variable).join(valor);
        }
    }
    return resultado;
};

const ModalVerAviso = ({ isOpen, onClose, aviso, documento, partida, onMarkAsViewed, onDeleteAviso, receptorInfo }) => {
    const printRef = useRef();
    const { getParrocos } = useAppData(); // 🚀 CEREBRO TEMPORAL

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Aviso_Matrimonial_${aviso?.consecutivo || 'Doc'}`
    });

    if (!isOpen || !aviso || !documento) return null;

    const isPending = aviso.status === 'pendiente';
    const emisorInfo = obtenerParroquiaEmisoraInfo(documento.parishId);

    // 🚀 EXTRACCIÓN Y TRADUCCIÓN DE DATOS PARA LA NOTA
    const marriageDate = documento.matrimonio?.fecha || documento.marriageDate;
    const rawMarriageParish = documento.matrimonio?.parroquia?.nombre || documento.matrimonio?.parroquia || documento.marriageParish;
    const rawMarriageDiocese = documento.matrimonio?.diocesis?.nombre || documento.matrimonio?.diocesis || documento.marriageDiocese;
    
    const marriageParish = resolverNombreCatalogo(rawMarriageParish, 'parishes');
    const marriageDiocese = resolverNombreCatalogo(rawMarriageDiocese, 'dioceses');

    const spouseName = documento.matrimonio?.conyuge?.nombre || documento.spouseName;
    const marriageBook = documento.matrimonio?.libro || documento.marriageBook;
    const marriageFolio = documento.matrimonio?.folio || documento.marriageFolio;
    const marriageNumber = documento.matrimonio?.numero || documento.marriageNumber;
    const fechaCreacion = documento.fechaCreacion || documento.createdAt || aviso.createdAt || new Date().toISOString();

    // 🚀 MÁQUINA DEL TIEMPO: BUSCAR AL PÁRROCO EMISOR EN LA FECHA DE CREACIÓN
    let finalDaFe = 'EL PÁRROCO';
    const parishId = emisorInfo?.id || documento.parishId;
    
    if (parishId && getParrocos) {
        const sacerdotes = getParrocos(parishId) || [];
        const dStr = fechaCreacion.includes('T') ? fechaCreacion : `${fechaCreacion}T12:00:00`;
        const fechaDoc = new Date(dStr);
        
        if (!isNaN(fechaDoc.getTime())) {
            const sacerdoteEpoca = sacerdotes.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                const inicio = new Date(iStr);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaDoc >= inicio && fechaDoc <= fin;
            });
            if (sacerdoteEpoca) {
                finalDaFe = `PBRO. ${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
            } else {
                const actual = sacerdotes.find(p => String(p.estado || p.Estado) === '1');
                if (actual) finalDaFe = `PBRO. ${actual.nombre || ''} ${actual.apellido || ''}`.trim().toUpperCase();
            }
        }
    }

    // 🚀 GENERADOR DEL TEXTO DE LA NOTA MARGINAL CON VARIABLES
    const getTextoNotaMarginal = () => {
        if (!documento.marginNoteText) return "No se registró el texto de la nota marginal al generar este documento.";
        const datosParaReemplazo = {
            fechaNotificacion: formatearFecha(fechaCreacion),
            fechaMatrimonio: formatearFecha(marriageDate),
            parroquiaMatrimonio: marriageParish?.toUpperCase(),
            diocesisMatrimonio: marriageDiocese?.toUpperCase(),
            nombreConyuge: spouseName?.toUpperCase(),
            libroMatrimonio: marriageBook,
            folioMatrimonio: marriageFolio,
            numeroMatrimonio: marriageNumber,
            fechaExpedicion: formatearFecha(new Date()),
            ministro: finalDaFe // 🚀 INYECTADO
        };
        return reemplazarVariablesNotificacion(documento.marginNoteText, datosParaReemplazo);
    };

    const DataRow = ({ label, value, highlight = false }) => (
        <div className={`flex justify-between py-2 border-b border-gray-100 last:border-0 ${highlight ? 'font-semibold text-blue-900 bg-blue-50 px-2 rounded -mx-2' : 'text-gray-700'}`}>
            <span className="text-gray-500 text-sm">{label}</span>
            <span className="text-sm text-right font-medium">{value || '-'}</span>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle de Aviso: ${aviso.consecutivo}`}>
            
            {/* HEADER ESTADO */}
            <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${isPending ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <div>
                    <h4 className={`font-bold ${isPending ? 'text-amber-800' : 'text-green-800'}`}>
                        {isPending ? 'Acción Requerida: Pendiente de Asentar' : 'Aviso Visto / Procesado'}
                    </h4>
                    <p className={`text-xs mt-1 ${isPending ? 'text-amber-700' : 'text-green-700'}`}>
                        {isPending 
                            ? 'Debe buscar la partida de bautismo y asentar la nota marginal de matrimonio.'
                            : `Marcado como visto el ${aviso.viewedAt ? new Date(aviso.viewedAt).toLocaleDateString() : '---'}`}
                    </p>
                </div>
                {isPending && (
                    <Button onClick={() => onMarkAsViewed(aviso)} className="bg-green-600 hover:bg-green-700 text-white shadow-sm flex gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Marcar como Visto
                    </Button>
                )}
            </div>

            <div className="space-y-6">
                
                {/* SECCIÓN 1: DATOS DEL AVISO */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600"/> 1. Información General
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Parroquia Emisora" value={emisorInfo?.name} />
                            <DataRow label="Fecha del Aviso" value={new Date(aviso.createdAt).toLocaleDateString()} />
                        </div>
                        <div>
                            <DataRow label="Generado por" value={documento.createdBy || 'Sistema'} />
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 2: PARTIDA BAUTISMO */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                        2. Identificación del Bautizado(a)
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <DataRow label="Nombre Completo" value={documento.personName} highlight />
                        <div className="grid grid-cols-3 gap-4 mt-2">
                            <DataRow label="Libro" value={documento.baptismBook} />
                            <DataRow label="Folio" value={documento.baptismFolio} />
                            <DataRow label="Número" value={documento.baptismNumber} />
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 3: DATOS MATRIMONIO */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                        3. Datos del Matrimonio Celebrado
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Cónyuge" value={spouseName} />
                            <DataRow label="Fecha Matrimonio" value={formatearFecha(marriageDate)} />
                            <DataRow label="Lugar de Celebración" value={[marriageParish, marriageDiocese].filter(Boolean).join(', ')} />
                        </div>
                        <div>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <span className="block text-xs font-semibold text-gray-500 mb-1">Registro Matrimonial:</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white p-1 border border-gray-200 rounded text-center text-xs"><span className="text-gray-400 block">Libro</span> {marriageBook || '-'}</div>
                                    <div className="bg-white p-1 border border-gray-200 rounded text-center text-xs"><span className="text-gray-400 block">Folio</span> {marriageFolio || '-'}</div>
                                    <div className="bg-white p-1 border border-gray-200 rounded text-center text-xs"><span className="text-gray-400 block">Número</span> {marriageNumber || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 4: NOTA MARGINAL */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                        4. Nota Marginal a Asentar
                    </h3>
                    <div className="bg-[#fffdf0] border border-[#e6debc] p-4 rounded-lg">
                        <p className="text-sm font-mono text-gray-800 leading-relaxed text-justify uppercase whitespace-pre-wrap">
                            {getTextoNotaMarginal()}
                        </p>
                    </div>
                </section>
            </div>

            {/* ACTIONS FOOTER */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 -mx-6 px-6 -mb-6 pb-6">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-100">
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </Button>
                    {onDeleteAviso && (
                        <Button variant="outline" onClick={() => onDeleteAviso(aviso)} className="flex items-center gap-2 border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                        </Button>
                    )}
                </div>
                
                <Button variant="outline" onClick={onClose} className="flex items-center gap-2 bg-white">
                    <X className="w-4 h-4" />
                    Cerrar
                </Button>
            </div>

            {/* HIDDEN PRINT VIEW */}
            <div style={{ display: 'none' }}>
                <div ref={printRef} className="print-section">
                    <VistaImprimibleDocumento 
                        aviso={aviso} 
                        documento={documento} 
                        partida={partida} 
                        emisorInfo={emisorInfo}
                        receptorInfo={receptorInfo}
                    />
                </div>
            </div>

        </Modal>
    );
};

export default ModalVerAviso;