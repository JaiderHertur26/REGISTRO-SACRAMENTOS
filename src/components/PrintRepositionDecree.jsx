import React, { forwardRef, useState, useEffect } from 'react';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const PrintRepositionDecree = forwardRef(({ decreeData }, ref) => {
  const { getParrocos, getMisDatosList } = useAppData();
  const { user: authUser } = useAuth();

  const [chanceryData, setChanceryData] = useState({});
  const [targetParishInfo, setTargetParishInfo] = useState({ name: '', city: '', priest: '' });

  useEffect(() => {
      let isMounted = true;

      const fetchDataFromCloud = async () => {
          try {
              // 1. BUSCAR DATOS EXACTOS DE LA CANCILLERÍA
              let chanceryIdToUse = authUser?.chanceryId || authUser?.chancery_id;

              if (!chanceryIdToUse) {
                  let dioceseId = authUser?.dioceseId || authUser?.diocese_id;
                  
                  if (!dioceseId && authUser?.parishId) {
                      const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', authUser.parishId).single();
                      if (pData) dioceseId = pData.diocese_id;
                  }

                  if (dioceseId) {
                      const { data: chanceryRecord } = await supabase.from('chancelleries').select('id').eq('diocese_id', dioceseId).maybeSingle();
                      if (chanceryRecord) chanceryIdToUse = chanceryRecord.id;
                  }
              }

              if (chanceryIdToUse) {
                  const { data: misDatosCancilleria } = await supabase.from('mis_datos').select('payload').eq('entity_id', chanceryIdToUse).maybeSingle();

                  if (misDatosCancilleria && misDatosCancilleria.payload && isMounted) {
                      let p = misDatosCancilleria.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0];
                      setChanceryData(p || {});
                  }
              }

              // 2. BUSCAR DATOS DE LA PARROQUIA DESTINO
              let pId = decreeData?.targetParishId || decreeData?.parish_id || authUser?.parishId;

              if (pId) {
                  const { data: parishMisDatos } = await supabase.from('mis_datos').select('payload').eq('entity_id', pId).maybeSingle();
                  let pName = ''; let pCity = '';
                  
                  if (parishMisDatos && parishMisDatos.payload) {
                      let p = parishMisDatos.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0]; p = p || {};
                      pName = p.nombre || ''; pCity = p.ciudad || '';
                  }

                  if (isMounted) {
                      setTargetParishInfo({ name: pName.toUpperCase(), city: pCity.toUpperCase() });
                  }
              }
          } catch (err) {
              console.error("Error buscando datos en Supabase:", err);
          }
      };

      if (decreeData) fetchDataFromCloud();
      return () => { isMounted = false; };
  }, [authUser, decreeData]);

  if (!decreeData) return null;

  const {
    decreeNumber, numeroDecreto, decreeDate, fechaDecreto, targetName,
    newPartidaSummary = {}, datosNuevaPartida = {}, concepto, causa
  } = decreeData;

  const misDatosList = authUser?.parishId ? getMisDatosList(authUser.parishId) : [];
  const misDatosParroquia = misDatosList[0] || {}; 

  const orgData = {
    name: chanceryData.nombreCancilleria || chanceryData.nombre || 'CURIA ARZOBISPAL - CANCILLERÍA',
    address: chanceryData.direccion || '[Dirección no configurada]',
    phone: chanceryData.telefono || '[Teléfono no configurado]',
    city: chanceryData.ciudad || 'BARRANQUILLA',
    email: chanceryData.email || '[Email no configurado]'
  };

  const diocesisName = (chanceryData.diocesis || authUser?.dioceseName || 'DIÓCESIS').toUpperCase();
  const cancillerName = (chanceryData.canciller || chanceryData.nombreSacerdote || 'CANCILLER DIOCESANO').toUpperCase();
  const cargoName = (chanceryData.cargo || 'Canciller').toUpperCase();

  const parroquiaNombre = targetParishInfo.name || misDatosParroquia.nombre || authUser?.parishName || 'NUESTRA PARROQUIA';
  const ciudadParroquia = targetParishInfo.city || misDatosParroquia.ciudad || authUser?.city || 'CIUDAD';

  // 🚀 BUSCADOR INTELIGENTE DE VALORES
  const getVal = (key) => datosNuevaPartida[key] || decreeData[key] || newPartidaSummary[key] || '';

  const getFormattedSex = (val) => {
      const s = String(val || '').toUpperCase();
      if (s === '1' || s.includes('MASC')) return 'MASCULINO';
      if (s === '2' || s.includes('FEM')) return 'FEMENINO';
      return '---';
  };

  const getFormattedUnion = (val) => {
      const u = String(val || '').toUpperCase();
      if (u === '1' || u.includes('CATÓLICO') || u.includes('CATOLICO')) return 'MATRIMONIO CATÓLICO';
      if (u === '2' || u.includes('CIVIL')) return 'MATRIMONIO CIVIL';
      if (u === '3' || u.includes('LIBRE')) return 'UNIÓN LIBRE';
      if (u === '4' || u.includes('SOLTERA')) return 'MADRE SOLTERA';
      return u || 'OTRO CASO';
  };

  // 🚀 EVITA EL ERROR DE "0---" Rellenando solo si el valor es válido
  const pad = (val) => val && String(val).trim() !== '' && val !== '---' ? String(val).padStart(4, '0') : '----';

  const baptismRecord = {
    book: pad(getVal('book') || getVal('book_number') || getVal('numeroLibro') || getVal('Libro')),
    page: pad(getVal('page') || getVal('page_number') || getVal('folio')),
    entry: pad(getVal('entry') || getVal('entry_number') || getVal('numero') || getVal('numeroActa')),
    sacramentDate: getVal('sacramentDate') || getVal('fechaSacramento') || getVal('fecbau') || '---',
    firstName: (getVal('firstName') || getVal('nombres') || '').toUpperCase(),
    lastName: (getVal('lastName') || getVal('apellidos') || '').toUpperCase(),
    birthDate: getVal('birthDate') || getVal('fechaNacimiento') || getVal('fecnac') || '---',
    birthPlace: (getVal('placeOfBirth') || getVal('lugarNacimiento') || getVal('lugarNacimientoDetalle') || getVal('lugarn') || '---').toUpperCase(),
    father: (getVal('fatherName') || getVal('nombrePadre') || getVal('padre') || '---').toUpperCase(),
    mother: (getVal('motherName') || getVal('nombreMadre') || getVal('madre') || '---').toUpperCase(),
    sex: getFormattedSex(getVal('sex') || getVal('sexo')),
    unionType: getFormattedUnion(getVal('tipoUnionPadres') || getVal('tipohijo')),
    paternalGrandparents: (getVal('paternalGrandparents') || getVal('abuelosPaternos') || getVal('abuepat') || '---').toUpperCase(),
    maternalGrandparents: (getVal('maternalGrandparents') || getVal('abuelosMaternos') || getVal('abuemat') || '---').toUpperCase(),
    godparents: (getVal('godparents') || getVal('padrinos') || '---').toUpperCase(),
    minister: (getVal('minister') || getVal('ministro') || '---').toUpperCase(),
    daFe: (getVal('ministerFaith') || getVal('daFe') || getVal('da_fe') || 'PÁRROCO ENCARGADO').toUpperCase(),
  };

  const fullNameSubject = targetName?.toUpperCase() || `${baptismRecord.firstName} ${baptismRecord.lastName}`.trim() || '---';
  const finalDecreeNumber = decreeNumber || numeroDecreto || 'SN-000';
  const finalDecreeDate = decreeDate || fechaDecreto;
  const causaReposicion = (causa || concepto || 'PÉRDIDA O DETERIORO DEL ORIGINAL').toUpperCase();
  const emissionDateText = finalDecreeDate ? convertDateToSpanishTextNatural(finalDecreeDate) : '---';

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
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #reposition-print-area { width: 100% !important; height: auto !important; position: static !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>

      {/* --- ENCABEZADO CANÓNICO --- */}
      <div className="w-full">
          <div className="text-center mb-8 border-b-4 border-double border-black pb-4 relative">
            <h1 className="text-[15pt] font-black uppercase tracking-[0.2em] mb-1">{diocesisName}</h1>
            <h2 className="text-[11pt] font-bold uppercase tracking-widest text-gray-600">Oficina de Cancillería</h2>
            
            <div className="mt-4 inline-block border-2 border-black px-6 py-2 bg-gray-50 print:bg-gray-100">
               <span className="font-black uppercase tracking-[0.1em] text-[12pt]">Decreto de Reposición de Partida</span>
            </div>
            
            <div className="absolute right-0 top-0 text-[6pt] font-mono text-gray-400 text-right uppercase">
              CÓDIGO: CAL-ODC-022<br/>VERSIÓN: 001
            </div>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div className="w-2/3 text-[10pt] leading-tight pr-4">
               <p className="mb-1">Al Señor Cura Párroco de la Parroquia:</p>
               <p className="font-black text-[11pt] uppercase">{parroquiaNombre}</p>
               <p className="font-bold text-gray-600 italic uppercase">de {ciudadParroquia} — COLOMBIA.</p>
            </div>
            <div className="w-1/3 border-2 border-black p-3 bg-gray-50 print:bg-gray-100 text-right shadow-sm">
              <div className="font-black text-[7pt] uppercase tracking-widest text-gray-500 mb-1">Registro de Control</div>
              <div className="font-mono text-xl font-black tracking-tighter border-b border-black pb-1 mb-1">{finalDecreeNumber}</div>
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
              <DataRow label="Lugar Nacimiento" value={baptismRecord.birthPlace} />
              <DataRow label="Padre" value={baptismRecord.father} />
              <DataRow label="Madre" value={baptismRecord.mother} />
              <div className="flex gap-4">
                  <div className="w-[55%] flex items-end pr-1">
                      <span className="font-bold text-black uppercase tracking-widest text-[8pt] w-36 shrink-0">Tipo de Unión:</span>
                      <span className="font-mono flex-1 border-b border-gray-300 pl-1 uppercase text-[9pt] text-gray-800">{baptismRecord.unionType}</span>
                  </div>
                  <div className="w-[45%] flex items-end pl-1">
                      <span className="font-bold text-black uppercase tracking-widest text-[8pt] w-12 shrink-0">Sexo:</span>
                      <span className="font-mono flex-1 border-b border-gray-300 pl-1 uppercase text-[9pt] text-gray-800">{baptismRecord.sex}</span>
                  </div>
              </div>
              <DataRow label="Abuelos Paternos" value={baptismRecord.paternalGrandparents} />
              <DataRow label="Abuelos Maternos" value={baptismRecord.maternalGrandparents} />
              <DataRow label="Padrinos" value={baptismRecord.godparents} />
              <DataRow label="Sacerdote" value={baptismRecord.minister} />
              <DataRow label="Firma (Da Fe)" value={baptismRecord.daFe} bold />
            </div>
          </div>

          {/* --- DISPOSICIÓN LEGAL --- */}
          <div className="mb-4 relative border-2 border-black p-4 bg-gray-50 print:bg-gray-100 shadow-inner">
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
            <p className="font-black uppercase tracking-widest mb-1 text-gray-700">{orgData.name}</p>
            <p className="font-medium">
                {orgData.address} • Tel: {orgData.phone} • E-mail: {orgData.email}
            </p>
            <p className="font-bold mt-1 tracking-widest uppercase">{orgData.city} — COLOMBIA</p>
          </div>
      </div>
    </div>
  );
});

PrintRepositionDecree.displayName = 'PrintRepositionDecree';
export default PrintRepositionDecree;