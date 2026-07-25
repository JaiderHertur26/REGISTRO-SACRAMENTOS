import React from 'react';
import { Scissors, Heart } from 'lucide-react';

const MatrimonioTicket = ({ data, parishInfo }) => {
  if (!data) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '_________________';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString || '_________________';
        
        return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC' 
        });
    } catch (e) {
        return dateString;
    }
  };

  const Section = ({ title, content, className = "" }) => (
    <div className={`flex items-baseline mb-0.5 text-[10px] ${className}`}>
      <span className="font-bold uppercase mr-1 min-w-[90px] text-gray-800">{title}:</span>
      <span className="border-b border-gray-400 px-1 flex-grow font-medium text-black leading-tight">
        {content || '_________________'}
      </span>
    </div>
  );

  const Header = ({ title }) => (
    <div className="text-center mb-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] border-b border-black inline-block pb-0.5 mb-1">{title}</h2>
      <h3 className="text-sm font-bold uppercase text-black">{parishInfo?.name || 'PARROQUIA'}</h3>
      <div className="text-[9px] text-gray-600 flex flex-col items-center leading-tight">
          <span>{parishInfo?.address || 'Dirección no disponible'}</span>
          <span>{parishInfo?.phone ? `Tel: ${parishInfo.phone}` : ''} {parishInfo?.city ? `- ${parishInfo.city}` : ''}</span>
      </div>
    </div>
  );

  return (
    <div className="w-[8.5in] h-[11in] bg-white text-black p-[0.3in] font-serif flex flex-col text-[10px] mx-auto print:m-0 print:p-[0.3in]">
      
      {/* ----------------- TOP SECTION (ARCHIVE) ----------------- */}
      <div className="h-[48%] flex flex-col relative border border-gray-100 p-2">
        <div className="absolute top-2 right-2 border border-black px-1.5 py-0.5 bg-white z-10">
          <p className="text-[10px] font-bold">N° {data.numero || 'PEND'}</p>
        </div>

        <Header title="BOLETA MATRIMONIO - ARCHIVO" />

        <div className="grid grid-cols-2 gap-4 mb-2 mt-1">
            <Section title="Fecha Matrimonio" content={formatDate(data.sacramentDate)} />
            <Section title="Ministro" content={data.minister} />
        </div>

        <div className="flex gap-4">
             <div className="flex-1 space-y-0.5 mb-2 border-t border-gray-100 pt-1">
                <h4 className="text-[9px] font-bold uppercase bg-blue-50 px-1 py-0.5 mb-0.5 text-center border border-blue-100">Datos del Novio</h4>
                <Section title="Nombres" content={data.groomName} />
                <Section title="Apellidos" content={data.groomSurname} />
                <Section title="Doc. ID" content={data.groomId} />
                <div className="pt-2">
                     <Section title="Padre" content={data.groomFather} />
                     <Section title="Madre" content={data.groomMother} />
                </div>
            </div>
            <div className="flex-1 space-y-0.5 mb-2 border-t border-gray-100 pt-1">
                <h4 className="text-[9px] font-bold uppercase bg-pink-50 px-1 py-0.5 mb-0.5 text-center border border-pink-100">Datos de la Novia</h4>
                <Section title="Nombres" content={data.brideName} />
                <Section title="Apellidos" content={data.brideSurname} />
                <Section title="Doc. ID" content={data.brideId} />
                 <div className="pt-2">
                     <Section title="Padre" content={data.brideFather} />
                     <Section title="Madre" content={data.brideMother} />
                </div>
            </div>
        </div>

        <div className="mb-1">
            <h4 className="text-[9px] font-bold uppercase bg-gray-50 px-1 py-0.5 mb-0.5 text-center border border-gray-200">Testigos</h4>
            <div className="grid grid-cols-2 gap-4">
                <Section title="Testigo 1" content={data.witnesses?.[0]?.name || data.witness1} />
                <Section title="Testigo 2" content={data.witnesses?.[1]?.name || data.witness2} />
            </div>
        </div>
        
        <div className="mt-auto flex justify-end pt-2">
            <div className="text-center w-32">
                <div className="border-b border-black mb-1 h-6"></div>
                <p className="text-[8px] font-bold uppercase">Firma Párroco / Ministro</p>
            </div>
        </div>
      </div>

      {/* ----------------- CUT LINE ----------------- */}
      <div className="h-[4%] flex items-center justify-center relative my-1">
        <div className="absolute w-full border-t border-dashed border-gray-400"></div>
        <div className="bg-white px-2 z-10 flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase">
             <Scissors size={10} /> CORTE AQUÍ <Scissors size={10} />
        </div>
      </div>

      {/* ----------------- BOTTOM SECTION (FAMILY) ----------------- */}
      <div className="h-[48%] flex flex-col relative border border-gray-100 p-2">
        <Header title="CONSTANCIA MATRIMONIO (FAMILIA)" />
        
        <div className="border border-gray-300 bg-gray-50 p-1 mb-3 text-center">
            <p className="text-[8px] font-bold uppercase leading-tight">Esta boleta NO es una partida válida para trámites civiles o eclesiásticos.</p>
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex gap-2 text-[10px]">
                <span className="font-bold">No. Inscripción:</span>
                <span className="font-mono bg-gray-100 px-2 rounded-sm">{data.numero || 'PENDIENTE'}</span>
            </div>
            <div className="flex gap-2 text-[10px]">
                <span className="font-bold">Fecha Inscripción:</span>
                <span>{formatDate(data.inscriptionDate || data.createdAt)}</span>
            </div>
        </div>

        <div className="flex-grow space-y-1">
            <div className="text-center mb-4">
                <p className="text-[10px] italic mb-2">Certificamos que han contraído Matrimonio Eclesiástico:</p>
                <div className="flex items-center justify-center gap-4">
                    <p className="text-sm font-bold uppercase border-b border-black px-2">{data.groomName} {data.groomSurname}</p>
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    <p className="text-sm font-bold uppercase border-b border-black px-2">{data.brideName} {data.brideSurname}</p>
                </div>
            </div>
            
            <div className="text-center mb-4">
                 <p className="text-[10px]">Celebrado el día <span className="font-bold">{formatDate(data.sacramentDate)}</span></p>
                 <p className="text-[10px]">Ante el ministro <span className="font-bold uppercase">{data.minister}</span></p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2 text-[10px]">
                <div className="text-[9px] flex gap-1">
                    <span className="font-bold">Registro Civil:</span>
                    <span className="border-b border-gray-300 flex-1">{data.registryEntity || '_______'}</span>
                </div>
                 <div className="text-[9px] flex gap-1">
                    <span className="font-bold">Serial:</span>
                    <span className="border-b border-gray-300 flex-1">{data.registrySerial || '_______'}</span>
                </div>
            </div>
        </div>

        <div className="mt-auto pt-2 flex justify-between items-end">
            <div className="text-[8px] text-gray-500 w-1/2 leading-tight">
                <p>Nota: Verifique los datos cuidadosamente. Cualquier error ortográfico o de fecha debe ser notificado antes de asentar el libro oficial.</p>
            </div>
            <div className="text-center w-32">
                <div className="border-b border-black mb-1 h-6"></div>
                <p className="text-[8px] font-bold uppercase">Firma / Sello Parroquial</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MatrimonioTicket;