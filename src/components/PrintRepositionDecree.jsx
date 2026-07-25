import React, { forwardRef } from 'react';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';

const PrintRepositionDecree = forwardRef(({ decreeData }, ref) => {
  const { getParrocos, getMisDatosList } = useAppData();
  const { user: authUser } = useAuth();

  if (!decreeData) return null;

  const {
    decreeNumber,
    decreeDate,
    targetName,
    newPartidaSummary = {},
    datosNuevaPartida = {},
    concepto
  } = decreeData;

  // =========================================================================
  // 🏛️ IDENTIDAD OFICIAL (Single Source of Truth)
  // =========================================================================
  
  const targetParishId = decreeData.targetParishId || authUser?.parishId;
  const misDatosParroquia = getMisDatosList(targetParishId)[0] || {};
  
  // Buscamos la Cancillería en el almacén global
  const allMisDatos = JSON.parse(localStorage.getItem('mis_datos') || '[]');
  const chanceryData = allMisDatos.find(md => {
      const p = Array.isArray(md.payload) ? md.payload[0] : md.payload;
      return p?.cargo?.toLowerCase().includes('canciller') || p?.nombre?.toLowerCase().includes('cancillería');
  })?.payload || misDatosParroquia;

  const diocesisName = (chanceryData.diocesis || authUser?.dioceseName || 'DIÓCESIS').toUpperCase();
  const cancillerName = (chanceryData.canciller || chanceryData.nombreSacerdote || 'PBRO. CANCILLER').toUpperCase();
  const cargoName = (chanceryData.cargo || 'Canciller').toUpperCase();

  const parroquiaNombre = (misDatosParroquia.nombre || authUser?.parishName || 'NUESTRA PARROQUIA').toUpperCase();
  const ciudadParroquia = (misDatosParroquia.ciudad || authUser?.city || 'CIUDAD').toUpperCase();

  // =========================================================================
  // 🧬 NORMALIZACIÓN DE DATOS DE LA PARTIDA SUPLETORIA
  // =========================================================================
  
  const bd = datosNuevaPartida || newPartidaSummary || {};

  const getFormattedSex = (val) => {
      const s = String(val || '').toUpperCase();
      if (s === '1' || s.includes('MASC')) return 'MASCULINO';
      if (s === '2' || s.includes('FEM')) return 'FEMENINO';
      return '---';
  };

  const baptismRecord = {
    book: String(bd.book || bd.book_number || bd.numeroLibro || '---').padStart(4, '0'),
    page: String(bd.page || bd.page_number || bd.folio || '---').padStart(4, '0'),
    entry: String(bd.entry || bd.entry_number || bd.numero || bd.numeroActa || '---').padStart(4, '0'),
    sacramentDate: bd.sacramentDate || bd.fechaSacramento || '---',
    firstName: (bd.firstName || bd.nombres || '').toUpperCase(),
    lastName: (bd.lastName || bd.apellidos || '').toUpperCase(),
    birthDate: bd.birthDate || bd.fechaNacimiento || '---',
    birthPlace: (bd.placeOfBirth || bd.lugarNacimiento || bd.lugarNacimientoDetalle || '---').toUpperCase(),
    father: (bd.fatherName || bd.nombrePadre || '---').toUpperCase(),
    mother: (bd.motherName || bd.nombreMadre || '---').toUpperCase(),
    sex: getFormattedSex(bd.sex || bd.sexo),
    paternalGrandparents: (bd.paternalGrandparents || bd.abuelosPaternos || '---').toUpperCase(),
    maternalGrandparents: (bd.maternalGrandparents || bd.abuelosMaternos || '---').toUpperCase(),
    godparents: (bd.godparents || bd.padrinos || '---').toUpperCase(),
    minister: (bd.minister || bd.ministro || '---').toUpperCase(),
    daFe: (bd.ministerFaith || bd.daFe || 'PÁRROCO ENCARGADO').toUpperCase(),
    serialRegCivil: bd.serialRegCivil || bd.serialRegistro || '---',
    nuipNuit: bd.nuipNuit || bd.nuip || '---',
    oficinaRegistro: (bd.oficinaRegistro || '---').toUpperCase(),
    fechaExpedicion: bd.fechaExpedicion || bd.fechaExpedicionRegistro || '---'
  };

  const fullNameSubject = targetName?.toUpperCase() || `${baptismRecord.firstName} ${baptismRecord.lastName}`.trim() || '---';
  const causaReposicion = (concepto || 'PÉRDIDA O DETERIORO DEL ORIGINAL').toUpperCase();
  const emissionDateText = decreeDate ? convertDateToSpanishTextNatural(decreeDate) : '---';

  const DataRow = ({ label, value, bold }) => (
    <div className="flex items-end mb-1.5">
      <span className="font-bold text-black uppercase text-[8pt] w-36 shrink-0 tracking-tighter">{label}:</span>
      <span className={`font-mono flex-1 border-b border-gray-300 pl-2 uppercase text-[9pt] leading-none text-gray-800 ${bold ? 'font-black' : ''}`}>
        {value || '\u00A0'}
      </span>
    </div>
  );

  return (
    <div id="reposition-print-area" ref={ref} className="bg-white text-black font-serif p-12 max-w-[216mm] mx-auto min-h-[279mm] flex flex-col justify-between shadow-none print:p-4 box-border">
      <style>{`
        @media print {
          @page { margin: 10mm; size: letter; }
          body { background: white; }
          #reposition-print-area { width: 100% !important; height: auto !important; position: static !important; }
        }
      `}</style>

      {/* --- ENCABEZADO CANÓNICO --- */}
      <div className="w-full">
          <div className="text-center mb-8 border-b-4 border-double border-black pb-4 relative">
            <h1 className="text-[15pt] font-black uppercase tracking-[0.2em] mb-1">{diocesisName}</h1>
            <h2 className="text-[11pt] font-bold uppercase tracking-widest text-gray-600">Oficina de Cancillería</h2>
            
            <div className="mt-4 inline-block border-2 border-black px-6 py-2 bg-gray-50">
               <span className="font-black uppercase tracking-[0.1em] text-[12pt]">Decreto de Reposición de Partida</span>
            </div>
            
            <div className="absolute right-0 top-0 text-[6pt] font-mono text-gray-400 text-right uppercase">
              CÓDIGO: CAL-ODC-022<br/>VERSIÓN: 001
            </div>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div className="w-2/3 text-[10pt] leading-tight">
               <p className="mb-1">Al Señor Cura Párroco de:</p>
               <p className="font-black text-[11pt]">{parroquiaNombre}</p>
               <p className="font-bold text-gray-600 italic">{ciudadParroquia} — COLOMBIA</p>
            </div>
            <div className="w-1/3 border-2 border-black p-3 bg-gray-50 text-right shadow-sm">
              <div className="font-black text-[7pt] uppercase tracking-widest text-gray-500 mb-1">Registro de Control</div>
              <div className="font-mono text-xl font-black tracking-tighter border-b border-black pb-1 mb-1">{decreeNumber || 'SN-000'}</div>
              <div className="font-mono text-[7pt] uppercase font-bold text-gray-500">{emissionDateText}</div>
            </div>
          </div>

          <div className="mb-6 text-[10.5pt] leading-relaxed text-justify">
            <p>
              Por el presente documento, ante la comprobada pérdida, destrucción o deterioro del registro original por motivo de 
              <strong> {causaReposicion}</strong>, el Gobierno de la Diócesis, en uso de sus facultades, 
              <strong> AUTORIZA Y ORDENA</strong> asentar una <strong>PARTIDA SUPLETORIA DE BAUTISMO</strong> a nombre de:
            </p>
            <div className="text-center my-4">
                <span className="font-black text-[13pt] uppercase tracking-wider border-b-2 border-black px-8 py-1">{fullNameSubject}</span>
            </div>
          </div>

          {/* --- CUADRO TÉCNICO DEL NUEVO REGISTRO --- */}
          <div className="mb-6 border-2 border-black p-6 relative bg-gray-50/30">
            <div className="absolute -top-3 left-6 bg-white px-4 font-black text-[7.5pt] tracking-[0.2em] uppercase border border-black shadow-sm">
              Detalles a Asentar en el Libro Supletorio
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-6 border-b border-gray-300 pb-4">
              <div className="text-center"><span className="text-[7pt] font-black text-gray-400 uppercase block tracking-widest mb-1">Libro Supletorio</span><span className="font-mono font-black text-[14pt] bg-white px-3 border rounded">{baptismRecord.book}</span></div>
              <div className="text-center border-x border-gray-200"><span className="text-[7pt] font-black text-gray-400 uppercase block tracking-widest mb-1">Folio</span><span className="font-mono font-black text-[14pt] bg-white px-3 border rounded">{baptismRecord.page}</span></div>
              <div className="text-center"><span className="text-[7pt] font-black text-gray-400 uppercase block tracking-widest mb-1">Número</span><span className="font-mono font-black text-[14pt] bg-white px-3 border rounded">{baptismRecord.entry}</span></div>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <DataRow label="F. Bautismo" value={baptismRecord.sacramentDate} />
              <DataRow label="Nombres" value={baptismRecord.firstName} />
              <DataRow label="Apellidos" value={baptismRecord.lastName} />
              <DataRow label="F. Nacimiento" value={baptismRecord.birthDate} />
              <DataRow label="Padre" value={baptismRecord.father} />
              <DataRow label="Madre" value={baptismRecord.mother} />
              <div className="flex gap-4">
                  <div className="flex-1"><DataRow label="Abuelo Pat." value={baptismRecord.paternalGrandparents} /></div>
                  <div className="flex-1"><DataRow label="Abuelo Mat." value={baptismRecord.maternalGrandparents} /></div>
              </div>
              <DataRow label="Padrinos" value={baptismRecord.godparents} />
              <DataRow label="Sacerdote" value={baptismRecord.minister} />
              <DataRow label="Firma (Da Fe)" value={baptismRecord.daFe} bold />
              
              <div className="mt-2 pt-2 border-t border-dashed border-gray-300 grid grid-cols-2 gap-4">
                <DataRow label="Reg. Civil" value={baptismRecord.serialRegCivil} />
                <DataRow label="NUIP" value={baptismRecord.nuipNuit} />
              </div>
            </div>
          </div>

          {/* --- DISPOSICIÓN LEGAL --- */}
          <div className="mb-4 relative border-2 border-black p-4 bg-gray-50 shadow-inner">
             <div className="absolute -top-3 left-6 bg-white px-3 font-black text-[8pt] tracking-widest uppercase border border-black">
              Disposición
            </div>
            <p className="font-mono text-[9.5pt] leading-tight text-justify mt-1 font-bold uppercase text-gray-700">
              CÓPIESE FIELMENTE ESTA INFORMACIÓN EN EL LIBRO DE REGISTROS SUPLETORIOS DE LA PARROQUIA. EL PÁRROCO DARÁ FE DE LA EXACTITUD DEL ASENTAMIENTO BASÁNDOSE EN EL PRESENTE DECRETO.
            </p>
          </div>
      </div>

      {/* --- FIRMAS Y SELLOS --- */}
      <div className="w-full pt-8">
          <div className="flex justify-between items-end px-16 mb-10">
            <div className="text-center w-5/12">
              <div className="border-t-2 border-black pt-2 font-black uppercase text-[10pt] tracking-tighter">
                {cancillerName}
              </div>
              <div className="text-[8pt] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">
                 {cargoName}
              </div>
            </div>
            <div className="text-center">
              <div className="h-28 w-28 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-[7pt] font-black uppercase text-gray-300 tracking-widest text-center leading-none p-4">
                Sello Seco de<br/>Cancillería
              </div>
            </div>
          </div>

          {/* PIE DE PÁGINA OFICIAL */}
          <div className="w-full text-center text-[7.5pt] text-gray-500 border-t border-gray-200 pt-3">
            <p className="font-black uppercase tracking-widest mb-1 text-gray-700">{chanceryData.nombreCancilleria || diocesisName}</p>
            <p className="font-medium">
                {chanceryData.direccion} • Tel: {chanceryData.telefono} • {chanceryData.email}
            </p>
            <p className="font-bold mt-1 tracking-widest uppercase">Barranquilla, Atlántico — República de Colombia</p>
          </div>
      </div>
    </div>
  );
});

PrintRepositionDecree.displayName = 'PrintRepositionDecree';
export default PrintRepositionDecree;