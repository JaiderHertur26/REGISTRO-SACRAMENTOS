import React from 'react';
import { BookOpen } from 'lucide-react';

const BaptismTicket = ({ baptismData, parishInfo }) => {
    if (!baptismData) return null;

    // --- 1. FORMATEADORES ---
    const formatDate = (dateString) => {
        if (!dateString) return '__________________________';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return String(dateString).toUpperCase();
            return date.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC' 
            }).toUpperCase();
        } catch (e) {
            return String(dateString).toUpperCase();
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '__________';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '__________';
            return date.toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();
        } catch (e) { return '__________'; }
    };

    const formatList = (data) => {
        if (!data) return '__________________________';
        if (typeof data === 'string') return data.toUpperCase();
        if (Array.isArray(data)) {
            return data.map(item => (typeof item === 'object' ? (item.nombre || item.name) : item)).join(', ').toUpperCase();
        }
        return '__________________________';
    };

    // --- 2. COMPONENTE DE LÍNEA ESTILO MÁQUINA DE ESCRIBIR ---
    const FieldLine = ({ label, value, className = "" }) => (
        <div className={`flex items-baseline mb-1 ${className}`}>
            <span className="font-bold mr-2 whitespace-nowrap text-[10px]">{label}:</span>
            <span className="border-b border-black flex-grow font-normal italic px-2 min-h-[1.2em] text-[11px] uppercase">
                {value || ''}
            </span>
        </div>
    );

    const TicketHalf = ({ isArchive }) => {
        // Mapeo Resiliente de Información Parroquial
        const diocesis = (parishInfo?.diocesis || '__________________________').toUpperCase();
        const nombreP = (parishInfo?.nombre || parishInfo?.name || '__________________________').toUpperCase();
        const direccion = (parishInfo?.direccion || parishInfo?.address || '__________________________').toUpperCase();
        const telefono = parishInfo?.telefono || parishInfo?.phone || '';
        const ciudad = (parishInfo?.ciudad || parishInfo?.city || '__________________________').toUpperCase();

        // Mapeo de Datos del Bautizo
        const nroReg = baptismData.numeroRegistro || baptismData.registration_number || '_______';
        const bautizando = `${baptismData.nombres || baptismData.firstName || ''} ${baptismData.apellidos || baptismData.lastName || ''}`.trim();
        const sexo = (baptismData.sexo === 'M' || baptismData.sexo === 'MASCULINO') ? 'MASCULINO' : 'FEMENINO';
        const identificacion = baptismData.nuip || baptismData.identification || baptismData.serialRegistro || '_______';
        const regCivil = baptismData.oficinaRegistro || baptismData.civil_registry || '_______';
        const dirResidencia = baptismData.direccion || baptismData.address || '__________________________';

        // 🚀 LÓGICA DE FIRMA RESPONSABLE (Imagen 001)
        const nombrePadre = baptismData.nombrePadre || baptismData.fatherName;
        const nombreMadre = baptismData.nombreMadre || baptismData.motherName;
        const nombreResponsable = (nombrePadre && nombrePadre !== '---' && nombrePadre !== '') 
            ? nombrePadre 
            : (nombreMadre || '__________________________');

        return (
            <div className="flex-1 flex flex-col p-8 border-[3px] border-double border-black relative bg-white overflow-hidden m-1">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none"><BookOpen size={400} /></div>

                {/* ENCABEZADO JERÁRQUICO */}
                <div className="text-center mb-4 relative z-10">
                    <h1 className="text-base font-black tracking-widest uppercase mb-0.5">{diocesis}</h1>
                    <h2 className="text-lg font-black uppercase mb-0.5">{nombreP}</h2>
                    <p className="text-[9px] font-bold uppercase tracking-tight">
                        {direccion} {telefono && ` — TEL: ${telefono}`} — {ciudad}
                    </p>
                    <div className="mt-2 inline-block border border-black px-4 py-0.5 bg-white">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                            {isArchive ? 'BOLETA PARA ARCHIVO PARROQUIAL' : 'CONSTANCIA DE INSCRIPCIÓN (FAMILIA)'}
                        </span>
                    </div>
                </div>

                {/* CONTROL DE REGISTRO */}
                <div className="flex justify-between items-center mb-3 px-1 relative z-10">
                    <div className="text-xs font-black border-2 border-black p-1 px-3">
                        REGISTRO Nº: {nroReg}
                    </div>
                    <div className="text-[9px] font-bold">
                        FECHA TRÁMITE: {formatDate(new Date().toISOString())}
                    </div>
                </div>

                {/* CUERPO DEL DOCUMENTO */}
                <div className="space-y-0.5 relative z-10 flex-grow">
                    {!isArchive && (
                        <div className="border border-black bg-gray-50 p-1 mb-2 text-center rounded-sm">
                            <p className="text-[8px] font-bold uppercase leading-tight">Esta boleta NO es una partida de bautismo válida para trámites civiles o eclesiásticos.</p>
                        </div>
                    )}

                    <FieldLine label="BAUTIZANDO" value={bautizando} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FieldLine label="FECHA NAC." value={formatDate(baptismData.fechaNacimiento || baptismData.birthDate)} />
                        <FieldLine label="LUGAR NAC." value={baptismData.lugarNacimiento || baptismData.placeOfBirth} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FieldLine label="SEXO" value={sexo} />
                        <FieldLine label="NUIP / NIP" value={identificacion} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FieldLine label="PADRE" value={baptismData.nombrePadre} />
                        <FieldLine label="MADRE" value={baptismData.nombreMadre} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FieldLine label="DIRECCIÓN" value={dirResidencia} />
                        <FieldLine label="ESTADO CIVIL P." value={baptismData.tipoUnionPadres || baptismData.parentalUnion} />
                    </div>

                    <div className="grid grid-cols-1 gap-0.5 border-y border-black py-2 my-1 bg-gray-50/20">
                        <FieldLine label="ABUELOS PATER." value={formatList(baptismData.abuelosPaternos || baptismData.paternalGrandparents)} />
                        <FieldLine label="ABUELOS MATER." value={formatList(baptismData.abuelosMaternos || baptismData.maternalGrandparents)} />
                    </div>

                    <FieldLine label="PADRINOS" value={formatList(baptismData.padrinos || baptismData.godparents)} />

                    <div className="mt-2 pt-2 border-t border-dotted border-black">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2"><FieldLine label="FECHA BAUTISMO" value={formatDate(baptismData.fechaSacramento || baptismData.sacramentDate)} /></div>
                            <div><FieldLine label="HORA" value={formatTime(baptismData.fechaSacramento || baptismData.sacramentDate)} /></div>
                        </div>
                        <FieldLine label="MINISTRO" value={baptismData.ministro || baptismData.minister} />
                    </div>

                    {/* 🚀 NUEVA SECCIÓN DE FIRMA (POSICIÓN SOLICITADA) */}
                    <div className="mt-4">
                        <div className="flex items-end">
                            <span className="font-bold text-[10px] whitespace-nowrap mr-2">Firma responsable:</span>
                            <div className="border-b border-black flex-grow h-[1px]"></div>
                        </div>
                        <div className="pl-[115px] pt-1">
                            <span className="text-[11px] italic font-normal uppercase">
                                {nombreResponsable}
                            </span>
                        </div>
                    </div>

                    {!isArchive && (
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <FieldLine label="REG. CIVIL" value={regCivil} />
                            <div className="text-[8px] italic flex items-end pb-1">* Verifique los datos con el Registro Civil.</div>
                        </div>
                    )}
                </div>

                {/* PIE DE PÁGINA (SOLO TEXTO LEGAL) */}
                <div className="mt-4 flex justify-between items-end pb-1 relative z-10">
                    <div className="w-full text-[8px] font-bold leading-tight italic uppercase opacity-50">
                        {isArchive 
                            ? "* Uso interno. Verifique datos antes de asentar el acta definitiva."
                            : "* Presente este volante el día del bautismo. No es un documento legal."}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-[8.5in] h-[11in] bg-white text-black flex flex-col mx-auto print:m-0" 
             style={{ fontFamily: '"Courier New", Courier, monospace' }}>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            `}} />

            {/* MITAD SUPERIOR: ARCHIVO */}
            <TicketHalf isArchive={true} />

            {/* LÍNEA DE CORTE */}
            <div className="w-full border-t border-dashed border-black my-0"></div>

            {/* MITAD INFERIOR: FAMILIA */}
            <TicketHalf isArchive={false} />
        </div>
    );
};

export default BaptismTicket;