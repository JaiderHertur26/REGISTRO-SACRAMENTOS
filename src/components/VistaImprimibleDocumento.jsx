import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const VistaImprimibleDocumento = forwardRef(({ aviso, documento, partida, emisorInfo, receptorInfo }, ref) => {
    
    // --- LÓGICA DE RESOLUCIÓN DE DATOS (SSOT) ---
    const resolveValue = (val) => String(val || '').toUpperCase().trim();

    // Traducir UUIDs si vienen en el documento
    const resolverNombre = (idOrName, key) => {
        if (!idOrName) return '---';
        if (idOrName.length === 36 && idOrName.includes('-')) {
            try {
                const items = JSON.parse(localStorage.getItem(key) || '[]');
                const found = items.find(i => i.id === idOrName);
                return resolveValue(found?.name || found?.nombre || idOrName);
            } catch(e) { return resolveValue(idOrName); }
        }
        return resolveValue(idOrName);
    };

    const doc = documento || {};
    const emisor = emisorInfo || {};
    const receptor = receptorInfo || {};

    // Datos del Matrimonio
    const marriageParish = resolverNombre(doc.matrimonio?.parroquia || doc.marriageParish, 'parishes');
    const marriageDiocese = resolverNombre(doc.matrimonio?.diocesis || doc.marriageDiocese, 'dioceses');
    const spouse = resolveValue(doc.matrimonio?.conyuge?.nombre || doc.spouseName);
    const mBook = resolveValue(doc.matrimonio?.libro || doc.marriageBook);
    const mFolio = resolveValue(doc.matrimonio?.folio || doc.marriageFolio);
    const mNumber = resolveValue(doc.matrimonio?.numero || doc.marriageNumber);

    const renderDataBox = (label, value) => (
        <div className="flex flex-col border-b border-black pb-1">
            <span className="text-[9px] font-black text-gray-500 tracking-widest">{label}</span>
            <span className="text-sm font-bold text-black uppercase">{value || '\u00A0'}</span>
        </div>
    );

    return (
        <div ref={ref} className="print-area bg-white text-black p-[0.75in] min-h-[11in] w-full mx-auto relative overflow-hidden" 
             style={{ fontFamily: '"Courier New", Courier, monospace', lineHeight: '1.2' }}>
            
            {/* MEMBRETE OFICIAL */}
            <div className="text-center mb-10 border-b-4 border-double border-black pb-6">
                <h1 className="text-xl font-black uppercase tracking-[0.2em] mb-1">{resolveValue(emisor.diocesis || 'ARQUIDIÓCESIS')}</h1>
                <h2 className="text-lg font-bold uppercase tracking-widest">{resolveValue(emisor.nombre || 'PARROQUIA')}</h2>
                <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-[0.3em]">NOTIFICACIÓN DE MATRIMONIO CANÓNICO</p>
                
                <div className="flex justify-between mt-6 px-4">
                    <div className="text-left">
                        <span className="text-[9px] font-black text-gray-400 block uppercase">Protocolo No.</span>
                        <span className="font-bold text-sm">{(aviso?.consecutivo || doc.consecutivo || '---').padStart(5, '0')}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-gray-400 block uppercase">Fecha de Emisión</span>
                        <span className="font-bold text-sm">{new Date().toLocaleDateString('es-ES').toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* CUERPO DEL COMUNICADO */}
            <div className="space-y-8">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Al Reverendo Padre:</p>
                    <h3 className="text-md font-black border-b-2 border-black inline-block pb-1">
                        PÁRROCO DE {resolveValue(receptor.nombre || doc.receiverParishName || 'LA PARROQUIA DE DESTINO')}
                    </h3>
                    <p className="text-xs font-bold text-gray-500 italic uppercase">{resolveValue(receptor.ciudad || 'CIUDAD')}</p>
                </div>

                <p className="text-sm text-justify leading-relaxed uppercase font-medium">
                    Por medio de la presente, tengo el honor de comunicarle que en los libros de esta parroquia se ha registrado el 
                    vínculo matrimonial de la persona cuyos datos se detallan a continuación, con el fin de que se digne realizar el 
                    asiento de la respectiva <strong>NOTA MARGINAL</strong> en su partida de Bautismo.
                </p>

                {/* BLOQUE I: DATOS DEL BAUTIZADO */}
                <section className="border-2 border-black p-6 relative">
                    <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black tracking-widest border border-black uppercase">
                        I. Identidad del Bautizado/a
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {renderDataBox("Nombres y Apellidos", resolveValue(doc.personName))}
                        <div className="grid grid-cols-3 gap-2">
                            {renderDataBox("Libro", resolveValue(doc.baptismBook))}
                            {renderDataBox("Folio", resolveValue(doc.baptismFolio))}
                            {renderDataBox("Acta", resolveValue(doc.baptismNumber))}
                        </div>
                    </div>
                </section>

                {/* BLOQUE II: DATOS DE LA CELEBRACIÓN */}
                <section className="border-2 border-black p-6 relative">
                    <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black tracking-widest border border-black uppercase">
                        II. Datos de la Celebración Matrimonial
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {renderDataBox("Contrajo Matrimonio con", spouse)}
                        {renderDataBox("Fecha de Matrimonio", resolveValue(doc.marriageDate))}
                        <div className="md:col-span-2">
                            {renderDataBox("Lugar de Celebración", `${marriageParish} - ${marriageDiocese}`)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:col-span-2">
                            {renderDataBox("Libro Matr.", mBook)}
                            {renderDataBox("Folio Matr.", mFolio)}
                            {renderDataBox("Acta Matr.", mNumber)}
                        </div>
                    </div>
                </section>

                {/* NOTA FINAL */}
                <div className="pt-4 italic text-[11px] text-gray-500 uppercase leading-tight">
                    Dado en {resolveValue(emisor.ciudad)}, a los {new Date().getDate()} días del mes de {new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()).toUpperCase()} del año {new Date().getFullYear()}.
                </div>
            </div>

            {/* ESPACIO DE FIRMA */}
            <div className="mt-20 flex flex-col items-center">
                <div className="w-72 border-b-2 border-black mb-2"></div>
                <span className="text-[11px] font-black uppercase tracking-widest">Párroco / Encargado</span>
                <div className="h-20 w-20 border-2 border-dashed border-gray-200 rounded-full mt-4 flex items-center justify-center text-[8px] font-bold text-gray-300 uppercase text-center p-2">
                    Sello Parroquial
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .print-area { padding: 0.75in !important; position: static !important; }
                }
            `}</style>
        </div>
    );
});

VistaImprimibleDocumento.displayName = 'VistaImprimibleDocumento';
export default VistaImprimibleDocumento;