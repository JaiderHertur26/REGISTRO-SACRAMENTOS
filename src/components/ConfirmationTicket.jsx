import React from 'react';
import { Scissors } from 'lucide-react';

const ConfirmationTicket = ({ confirmationData, parishInfo }) => {
  if (!confirmationData) return null;

  // Formatting helpers
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

  // Helper to safely render complex fields
  const formatList = (data) => {
      if (!data) return '';
      if (typeof data === 'string') return data;
      if (Array.isArray(data)) {
          return data.map(item => (typeof item === 'object' ? (item.name || JSON.stringify(item)) : item)).join(', ');
      }
      return '';
  };

  const Section = ({ title, content, className = "" }) => (
    <div className={`flex items-baseline mb-0.5 text-[10px] ${className}`}>
      <span className="font-bold uppercase mr-1 min-w-[90px] text-gray-800">{title}:</span>
      <span className="border-b border-gray-400 px-1 flex-grow font-medium text-black leading-tight">
        {typeof content === 'object' ? formatList(content) : (content || '_________________')}
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
      
      {/* ----------------- TOP SECTION (ARCHIVE) - 48% height ----------------- */}
      <div className="h-[48%] flex flex-col relative border border-gray-100 p-2">
        <div className="absolute top-2 right-2 border border-black px-1.5 py-0.5 bg-white z-10">
          <p className="text-[10px] font-bold">N° {confirmationData.numero || 'PEND'}</p>
        </div>

        <Header title="BOLETA PARA ARCHIVO PARROQUIAL - CONFIRMACIÓN" />

        <div className="grid grid-cols-2 gap-4 mb-2 mt-1">
            <Section title="Fecha Conf." content={formatDate(confirmationData.sacramentDate)} />
            <Section title="Ministro" content={confirmationData.minister} />
        </div>

        <div className="space-y-0.5 mb-2 border-t border-gray-100 pt-1">
            <h4 className="text-[9px] font-bold uppercase bg-gray-50 px-1 py-0.5 mb-0.5 text-center border border-gray-200">Datos del Confirmado</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <Section title="Apellidos" content={confirmationData.lastName} />
                <Section title="Nombres" content={confirmationData.firstName} />
                <Section title="Fecha Nac." content={formatDate(confirmationData.birthDate)} />
                <Section title="Lugar Nac." content={confirmationData.birthPlace} />
                <Section title="Sexo" content={confirmationData.sex === 'M' ? 'Masculino' : confirmationData.sex === 'F' ? 'Femenino' : confirmationData.sex} />
            </div>
        </div>

        <div className="space-y-0.5 mb-2">
            <h4 className="text-[9px] font-bold uppercase bg-gray-50 px-1 py-0.5 mb-0.5 text-center border border-gray-200">Padres</h4>
            <Section title="Padre" content={confirmationData.fatherName} />
            <Section title="Madre" content={confirmationData.motherName} />
        </div>

        <div className="grid grid-cols-1 gap-4 mb-1">
            <div>
                 <h4 className="text-[9px] font-bold uppercase bg-gray-50 px-1 py-0.5 mb-0.5 text-center border border-gray-200">Padrinos</h4>
                 <div className="text-[9px] border-b border-gray-300 min-h-[2.5em] p-0.5 leading-tight">
                    {formatList(confirmationData.godparents)}
                 </div>
            </div>
        </div>
        
        <div className="mt-auto flex justify-end pt-2">
            <div className="text-center w-32">
                <div className="border-b border-black mb-1 h-6"></div>
                <p className="text-[8px] font-bold uppercase">Firma Párroco / Ministro</p>
            </div>
        </div>
      </div>

      {/* ----------------- CUT LINE - 4% height ----------------- */}
      <div className="h-[4%] flex items-center justify-center relative my-1">
        <div className="absolute w-full border-t border-dashed border-gray-400"></div>
        <div className="bg-white px-2 z-10 flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase">
             <Scissors size={10} /> CORTE AQUÍ <Scissors size={10} />
        </div>
      </div>

      {/* ----------------- BOTTOM SECTION (FAMILY) - 48% height ----------------- */}
      <div className="h-[48%] flex flex-col relative border border-gray-100 p-2">
        <Header title="CONSTANCIA DE CONFIRMACIÓN (FAMILIA)" />
        
        <div className="border border-gray-300 bg-gray-50 p-1 mb-3 text-center">
            <p className="text-[8px] font-bold uppercase leading-tight">Esta boleta NO es una partida de confirmación válida para trámites civiles o eclesiásticos.</p>
            <p className="text-[8px] leading-tight">Conserve este documento para solicitar la partida oficial en el despacho parroquial.</p>
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex gap-2 text-[10px]">
                <span className="font-bold">No. Inscripción:</span>
                <span className="font-mono bg-gray-100 px-2 rounded-sm">{confirmationData.numero || 'PENDIENTE'}</span>
            </div>
            <div className="flex gap-2 text-[10px]">
                <span className="font-bold">Fecha Inscripción:</span>
                <span>{formatDate(confirmationData.inscriptionDate || confirmationData.createdAt)}</span>
            </div>
        </div>

        <div className="flex-grow space-y-1">
            <div className="text-center mb-3">
                <p className="text-[10px] italic mb-0.5">Certificamos que se ha inscrito la confirmación de:</p>
                <p className="text-base font-bold uppercase border-b border-black inline-block px-4">{confirmationData.firstName} {confirmationData.lastName}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-[10px]">
                 <div className="flex gap-1 items-baseline">
                    <span className="font-bold whitespace-nowrap">Nacido el:</span>
                    <span className="border-b border-gray-300 flex-1 pl-1">{formatDate(confirmationData.birthDate)}</span>
                 </div>
                 <div className="flex gap-1 items-baseline">
                    <span className="font-bold whitespace-nowrap">En:</span>
                    <span className="border-b border-gray-300 flex-1 pl-1 truncate">{confirmationData.birthPlace}</span>
                 </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-2 text-[10px]">
                <div>
                    <span className="font-bold block mb-0.5 bg-gray-50 text-center text-[9px] uppercase border border-gray-200">Padres</span>
                    <div className="flex gap-1 mb-1">
                        <span className="font-bold w-10 text-[9px]">Padre:</span>
                        <p className="border-b border-gray-300 flex-1 leading-none">{confirmationData.fatherName}</p>
                    </div>
                    <div className="flex gap-1">
                         <span className="font-bold w-10 text-[9px]">Madre:</span>
                        <p className="border-b border-gray-300 flex-1 leading-none">{confirmationData.motherName}</p>
                    </div>
                </div>
                 <div>
                    <span className="font-bold block mb-0.5 bg-gray-50 text-center text-[9px] uppercase border border-gray-200">Padrinos</span>
                    <p className="border-b border-gray-300 h-8 overflow-hidden text-[9px] leading-tight">{formatList(confirmationData.godparents)}</p>
                </div>
            </div>

             <div className="mt-2 text-[10px] flex gap-2">
                <span className="font-bold">Ministro:</span>
                <span className="border-b border-gray-300 flex-1">{confirmationData.minister}</span>
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

export default ConfirmationTicket;