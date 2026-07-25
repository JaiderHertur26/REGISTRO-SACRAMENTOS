import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Printer, ExternalLink, X, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VistaImprimibleDocumento from '@/components/VistaImprimibleDocumento';

// Funciones de utilidad
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

// TRADUCTOR DE UUIDs A NOMBRES REALES
const resolverNombreCatalogo = (idOrName, keyCatalogo) => {
    if (!idOrName || typeof idOrName !== 'string') return idOrName || '';
    // Si tiene 36 caracteres y guiones, es un UUID
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
        '[FECHA_EXPEDICION]': datos.fechaExpedicion
    };
    for (const [variable, valor] of Object.entries(map)) {
        if (valor !== undefined && valor !== null && valor !== '') {
            resultado = resultado.split(variable).join(valor);
        }
    }
    return resultado;
};

const ModalVerDocumento = ({ isOpen, onClose, documento, emisorInfo, receptorInfo }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const printRef = useRef(null);

    if (!isOpen || !documento) return null;

    const handlePrint = () => {
        if (!documento) {
            toast({ title: 'Error', description: 'Documento no válido para imprimir.', variant: 'destructive' });
            return;
        }
        setTimeout(() => { window.print(); }, 100);
    };

    const handleAbrirPartida = () => {
        if (!documento?.baptismPartidaId) {
            toast({ title: 'Error', description: 'Error: No se puede abrir la partida - ID no encontrado', variant: 'destructive' });
            return;
        }
        navigate(`/parroquia/bautismo/${documento.baptismPartidaId}`);
        onClose();
    };

    const DataRow = ({ label, value, highlight = false }) => (
        <div className={`flex justify-between py-2 border-b border-gray-100 last:border-0 ${highlight ? 'font-semibold text-blue-900 bg-blue-50 px-2 rounded -mx-2' : 'text-gray-700'}`}>
            <span className="text-gray-500 text-sm">{label}</span>
            <span className="text-sm text-right font-medium">{value || '-'}</span>
        </div>
    );

    const isInterno = !documento.receiverParishId || documento.receiverParishId === documento.parishId;

    // Extracción Dual
    const marriageDate = documento.matrimonio?.fecha || documento.marriageDate;
    const rawMarriageParish = documento.matrimonio?.parroquia?.nombre || documento.matrimonio?.parroquia || documento.marriageParish;
    const rawMarriageDiocese = documento.matrimonio?.diocesis?.nombre || documento.matrimonio?.diocesis || documento.marriageDiocese;
    
    // APLICAMOS EL TRADUCTOR DE CÓDIGOS
    const marriageParish = resolverNombreCatalogo(rawMarriageParish, 'parishes');
    const marriageDiocese = resolverNombreCatalogo(rawMarriageDiocese, 'dioceses');

    const spouseName = documento.matrimonio?.conyuge?.nombre || documento.spouseName;
    const marriageBook = documento.matrimonio?.libro || documento.marriageBook;
    const marriageFolio = documento.matrimonio?.folio || documento.marriageFolio;
    const marriageNumber = documento.matrimonio?.numero || documento.marriageNumber;
    const fechaCreacion = documento.fechaCreacion || documento.createdAt;

    const getTextoNotaMarginal = () => {
        if (!documento.marginNoteText) return "No se registró el texto de la nota marginal al generar este documento.";
        const datosParaReemplazo = {
            fechaNotificacion: formatearFecha(fechaCreacion || new Date()),
            fechaMatrimonio: formatearFecha(marriageDate),
            parroquiaMatrimonio: marriageParish?.toUpperCase(),
            diocesisMatrimonio: marriageDiocese?.toUpperCase(),
            nombreConyuge: spouseName?.toUpperCase(),
            libroMatrimonio: marriageBook,
            folioMatrimonio: marriageFolio,
            numeroMatrimonio: marriageNumber,
            fechaExpedicion: formatearFecha(new Date())
        };
        return reemplazarVariablesNotificacion(documento.marginNoteText, datosParaReemplazo);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle de Respaldo: ${documento.consecutivo || 'Documento'}`}>
            <div className="mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200 flex items-start gap-3 no-print">
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-gray-900">Documento Guardado</h4>
                    <p className="text-xs mt-1 text-gray-600">
                        Generado el {new Date(fechaCreacion || Date.now()).toLocaleString()} por {documento.createdBy || 'Sistema'}
                    </p>
                </div>
            </div>

            <div className="space-y-6 no-print">
                {/* SECCIÓN 1: DATOS DEL DOCUMENTO */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600"/> 1. Información de Envío
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Parroquia Emisora" value={emisorInfo?.name || 'Esta parroquia'} />
                            <DataRow label="Estado" value={(documento.status || 'Generado').toUpperCase()} />
                        </div>
                        <div>
                            <DataRow label="Parroquia Receptora" value={isInterno ? 'Interno (Local)' : receptorInfo?.name} />
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
                        <div className="grid grid-cols-3 gap-4 mt-3">
                            <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-center">
                                <span className="text-gray-400 text-xs block uppercase">Libro</span> 
                                <span className="font-bold">{documento.baptismBook || '-'}</span>
                            </div>
                            <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-center">
                                <span className="text-gray-400 text-xs block uppercase">Folio</span> 
                                <span className="font-bold">{documento.baptismFolio || '-'}</span>
                            </div>
                            <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-center">
                                <span className="text-gray-400 text-xs block uppercase">Número</span> 
                                <span className="font-bold">{documento.baptismNumber || '-'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 3: DATOS MATRIMONIO */}
                <section>
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                        3. Datos de la Celebración del Matrimonio
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Cónyuge" value={spouseName} />
                            <DataRow label="Fecha Matrimonio" value={formatearFecha(marriageDate)} />
                            <DataRow label="Lugar" value={[marriageParish, marriageDiocese].filter(Boolean).join(', ')} />
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
                        4. Nota Marginal Generada
                    </h3>
                    <div className="bg-[#fffdf0] border border-[#e6debc] p-4 rounded-lg">
                        <p className="text-sm font-mono text-gray-800 leading-relaxed text-justify whitespace-pre-wrap uppercase">
                            {getTextoNotaMarginal()}
                        </p>
                    </div>
                </section>
            </div>

            {/* ACTIONS FOOTER */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex flex-wrap justify-between items-center bg-gray-50 -mx-6 px-6 -mb-6 pb-6 gap-3 no-print">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2 border-gray-300 text-gray-700 bg-white shadow-sm hover:bg-gray-50">
                        <Printer className="w-4 h-4" />
                        Imprimir Documento
                    </Button>
                    <Button variant="outline" onClick={handleAbrirPartida} className="flex items-center gap-2 text-green-700 border-green-200 bg-green-50 hover:bg-green-100 shadow-sm">
                        <ExternalLink className="w-4 h-4" />
                        Abrir Partida
                    </Button>
                </div>
                <Button variant="ghost" onClick={onClose} className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    Cerrar
                </Button>
            </div>

            {/* AREA EXCLUSIVA DE IMPRESIÓN */}
            <div ref={printRef}>
                <VistaImprimibleDocumento 
                    documento={documento}
                    emisorInfo={emisorInfo}
                    receptorInfo={receptorInfo}
                />
            </div>
        </Modal>
    );
};

export default ModalVerDocumento;